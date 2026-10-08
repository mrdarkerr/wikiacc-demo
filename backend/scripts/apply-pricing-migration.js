import "dotenv/config";
import { existsSync, readFileSync, openSync, closeSync, unlinkSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

// For legacy installations without a complete Prisma migration history.
// Writers must be stopped; never use apply-schema.js on an existing database.
if (process.env.PRICING_MIGRATION_OFFLINE_ACK !== "1") {
  throw new Error("Stop backend writers and set PRICING_MIGRATION_OFFLINE_ACK=1; this script makes a private SQLite backup");
}
const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:") || url.includes("?")) throw new Error("Explicit existing SQLite DATABASE_URL without query is required");
const raw = url.slice(5);
const path = isAbsolute(raw) ? raw : resolve(backendDir, "prisma", raw);
if (!existsSync(path)) throw new Error("Existing database was not found");
const prisma = new PrismaClient({ datasourceUrl: `file:${path}` });
const columns = {
  Product: ["priceCurrency", "basePrice", "profitType", "profitValue"],
  OrderItem: ["priceCurrencySnapshot", "basePriceSnapshot", "profitTypeSnapshot", "profitValueSnapshot", "exchangeRateSnapshot", "rateSourceSnapshot", "rateFetchedAtSnapshot", "baseTomanSnapshot", "profitTomanSnapshot", "totalProfitSnapshot"],
  TelegramSettings: ["exchangeRateEventsEnabled"],
  PricingSettings: ["id", "fallbackRateToman", "staleAfterSeconds", "alertCooldownSeconds", "createdAt", "updatedAt"],
  ExchangeRate: ["id", "source", "symbol", "rateToman", "fetchedAt"],
  ExchangeRateSyncState: ["id", "lastAttemptAt", "lastSuccessAt", "lastErrorCode", "incidentId", "incidentStartedAt", "lastAlertAt", "updatedAt"],
  ScheduledJob: ["name", "nextRunAt", "leaseToken", "leaseExpiresAt", "lastStartedAt", "lastFinishedAt", "lastSuccessAt", "lastErrorCode", "runCount", "failureCount", "updatedAt"],
};
async function schemaState() {
  let present = 0, total = 0;
  for (const [table, expected] of Object.entries(columns)) {
    // Table names are fixed source constants, never input.
    const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
    const names = new Set(rows.map((row) => row.name));
    for (const name of expected) { total++; if (names.has(name)) present++; }
  }
  return { present, total };
}
async function verify(tx) {
  for (const [name, table, fields] of [
    ["ExchangeRate_fetchedAt_idx", "ExchangeRate", ["fetchedAt"]],
    ["ScheduledJob_nextRunAt_leaseExpiresAt_idx", "ScheduledJob", ["nextRunAt", "leaseExpiresAt"]],
  ]) {
    const indexes = await tx.$queryRawUnsafe(`PRAGMA index_list("${table}")`);
    const parts = await tx.$queryRawUnsafe(`PRAGMA index_info("${name}")`);
    if (!indexes.some((i) => i.name === name && Number(i.partial) === 0) || JSON.stringify(parts.map((p) => p.name)) !== JSON.stringify(fields)) {
      throw new Error("Partial pricing schema: invalid required index");
    }
  }
  const integrity = await tx.$queryRawUnsafe("PRAGMA integrity_check");
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") throw new Error("SQLite integrity check failed");
  if ((await tx.$queryRawUnsafe("PRAGMA foreign_key_check")).length) throw new Error("SQLite foreign key check failed");
}
try {
  const product = await prisma.$queryRawUnsafe('PRAGMA table_info("Product")');
  const item = await prisma.$queryRawUnsafe('PRAGMA table_info("OrderItem")');
  const tables = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type='table'");
  if (!product.some((p) => p.name === "price") || !item.some((p) => p.name === "priceSnapshot") || !tables.some((t) => t.name === "TelegramSettings")) {
    throw new Error("Unexpected database schema");
  }
  const state = await schemaState();
  if (state.present === state.total) {
    await verify(prisma);
    await prisma.pricingSettings.findFirst();
    await prisma.exchangeRate.findFirst();
    await prisma.exchangeRateSyncState.findFirst();
    await prisma.scheduledJob.findFirst();
    console.log("Pricing schema already applied; no changes made.");
  } else {
    if (state.present) throw new Error("Partial pricing schema; reconcile before retrying");
    const backup = `${path}.pricing-backup-${randomUUID()}.sqlite`;
    closeSync(openSync(backup, "wx", 0o600));
    try { await prisma.$executeRawUnsafe("VACUUM INTO ?", backup); }
    catch (error) { unlinkSync(backup); throw error; }
    const sql = readFileSync(resolve(backendDir, "prisma/migrations/20261008080000_add_dynamic_pricing/migration.sql"), "utf8");
    await prisma.$transaction(async (tx) => {
      for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
      await verify(tx);
    }, { timeout: 30000 });
    console.log("Pricing schema added atomically; existing amounts preserved.");
    console.log(`BACKUP=${JSON.stringify(backup)}`);
  }
} finally { await prisma.$disconnect(); }
