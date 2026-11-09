import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
if (process.env.SUPERIP_MIGRATION_OFFLINE_ACK !== "1") throw new Error("Stop backend writers and verify a SQLite backup before setting SUPERIP_MIGRATION_OFFLINE_ACK=1");
const prisma = new PrismaClient();
try {
  await prisma.$transaction(async (tx) => {
    const columns = await tx.$queryRawUnsafe('PRAGMA table_info("Product")');
    if (!columns.length) throw new Error("Existing product database required");
    const existing = columns.find(column => column.name === "superipMinAmount");
    if (existing) {
      if (existing.type !== "INTEGER" || Number(existing.notnull) !== 1 || String(existing.dflt_value) !== "1000") throw new Error("Unexpected minimum column definition");
      console.log("Product minimum schema already applied");
      return;
    }
    const sql = readFileSync(new URL("../prisma/migrations/20261109002000_superip_product_minimum/migration.sql", import.meta.url), "utf8");
    await tx.$executeRawUnsafe(sql.trim());
    if ((await tx.$queryRawUnsafe("PRAGMA foreign_key_check")).length) throw new Error("Foreign key validation failed");
    console.log("Product minimum schema applied");
  });
} finally { await prisma.$disconnect(); }
