import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

// Additive migration for installations bootstrapped without Prisma migration history.
// Prefer prisma migrate deploy on installations with a complete migration history.
if (process.env.TELEGRAM_MIGRATION_OFFLINE_ACK !== "1") {
  throw new Error("Stop backend writers, take a verified SQLite backup, then set TELEGRAM_MIGRATION_OFFLINE_ACK=1");
}
const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("file:")) throw new Error("DATABASE_URL must explicitly select an existing SQLite database");
const rawPath = databaseUrl.slice(5).split("?")[0];
const databasePath = isAbsolute(rawPath) ? rawPath : resolve(backendDir, "prisma", rawPath);
const { existsSync } = await import("node:fs");
if (!existsSync(databasePath)) throw new Error("Existing database was not found");
const prisma = new PrismaClient({ datasourceUrl: `file:${databasePath}` });
try {
  const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'");
  const names = new Set(tables.map((table) => table.name));
  if (!names.has("Order") || !names.has("SmsQueueJob")) throw new Error("Unexpected database schema");
  if (names.has("TelegramSettings") || names.has("TelegramQueueJob")) {
    if (!(names.has("TelegramSettings") && names.has("TelegramQueueJob"))) throw new Error("Partial Telegram schema; reconcile before retrying");
    // Validate against the generated client rather than treating two table names as proof of compatibility.
    await prisma.telegramSettings.findFirst();
    await prisma.telegramQueueJob.findFirst();
    const indexes = await prisma.$queryRawUnsafe('PRAGMA index_list("TelegramQueueJob")');
    const dedupe = indexes.find((index) => index.name === "TelegramQueueJob_dedupeKey_key");
    const columns = await prisma.$queryRawUnsafe('PRAGMA index_info("TelegramQueueJob_dedupeKey_key")');
    if (Number(dedupe?.unique) !== 1 || Number(dedupe?.partial) !== 0 || columns.length !== 1 || columns[0].name !== "dedupeKey") {
      throw new Error("Partial Telegram schema: required unique dedupeKey index is missing or invalid");
    }
    console.log("Telegram schema already applied; no changes made.");
  } else {
    const sql = readFileSync(resolve(backendDir, "prisma/migrations/20260922120000_add_telegram_notifications/migration.sql"), "utf8");
    await prisma.$transaction(async (tx) => {
      for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) {
        await tx.$executeRawUnsafe(statement);
      }
      const integrity = await tx.$queryRawUnsafe("PRAGMA integrity_check");
      if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") throw new Error("SQLite integrity check failed");
    });
    console.log("Telegram tables added atomically; existing tables untouched. Integration defaults OFF.");
  }
} finally { await prisma.$disconnect(); }
