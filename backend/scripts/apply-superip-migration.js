import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
if (process.env.SUPERIP_MIGRATION_OFFLINE_ACK !== "1")
  throw new Error(
    "Stop backend writers and take a verified SQLite backup, then set SUPERIP_MIGRATION_OFFLINE_ACK=1",
  );
const prisma = new PrismaClient();
try {
  await prisma.$transaction(async (tx) => {
    const tables = await tx.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('SuperipSettings','SuperipFulfillment')",
    );
    if (tables.length === 2) {
      await tx.superipSettings.count();
      await tx.superipFulfillment.count();
      console.log("SuperIP schema already applied");
      return;
    }
    if (tables.length)
      throw new Error("Partial SuperIP schema; refusing migration");
    const orderTable = await tx.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='OrderItem'",
    );
    if (!orderTable.length)
      throw new Error("Existing WikiAcc database required");
    const sql = readFileSync(
      new URL(
        "../prisma/migrations/20261108233000_add_superip_wallet/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    for (const statement of sql
      .split(";")
      .map((x) => x.trim())
      .filter(Boolean))
      await tx.$executeRawUnsafe(statement);
    const errors = await tx.$queryRawUnsafe("PRAGMA foreign_key_check");
    if (errors.length) throw new Error("Foreign key validation failed");
    console.log("SuperIP additive schema applied");
  });
} finally {
  await prisma.$disconnect();
}
