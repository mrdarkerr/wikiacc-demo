import "dotenv/config";

import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(__dirname, "..");
const prismaDir = resolve(backendDir, "prisma");
const migrationFile = resolve(
  prismaDir,
  "migrations/20260921190000_add_sharebox_fulfillment/migration.sql",
);
const prismaBin = resolve(
  backendDir,
  "node_modules/.bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);
const databaseUrl = process.env.DATABASE_URL;
if (process.env.SHAREBOX_MIGRATION_OFFLINE_ACK !== "1") {
  throw new Error(
    "Refusing to migrate without SHAREBOX_MIGRATION_OFFLINE_ACK=1; stop every backend process using this SQLite database first",
  );
}
if (!databaseUrl?.startsWith("file:")) {
  throw new Error("DATABASE_URL must be a SQLite file: URL");
}
const rawPath = databaseUrl.slice("file:".length).split("?")[0];
const databasePath = isAbsolute(rawPath) ? rawPath : resolve(prismaDir, rawPath);
const executeDatabaseUrl = `file:${databasePath}`;
if (!existsSync(databasePath)) {
  throw new Error("Refusing to migrate: the existing SQLite database was not found");
}

const prisma = new PrismaClient();
const tableExists = async (name) => {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    name,
  );
  return rows.length === 1;
};
const columnNames = async (table) => {
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
  return new Set(rows.map((row) => row.name));
};
const scalarCount = async (table) => {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS count FROM "${table}"`,
  );
  return Number(rows[0].count);
};

let backupPath;
let migrationStarted = false;
process.umask(0o077);
try {
  for (const table of ["Product", "OrderItem", "OrderDelivery", "DeliveryItem"]) {
    if (!(await tableExists(table))) {
      throw new Error(`Refusing to migrate: required table ${table} is missing`);
    }
  }
  const productColumns = await columnNames("Product");
  const deliveryColumns = await columnNames("OrderDelivery");
  const newTables = await Promise.all([
    tableExists("ShareboxSettings"),
    tableExists("ShareboxFulfillment"),
  ]);
  const fullyApplied =
    productColumns.has("shareboxCategoryId") &&
    productColumns.has("shareboxCategoryName") &&
    deliveryColumns.has("shareboxFulfillmentId") &&
    newTables.every(Boolean);
  const partiallyApplied =
    productColumns.has("shareboxCategoryId") ||
    productColumns.has("shareboxCategoryName") ||
    deliveryColumns.has("shareboxFulfillmentId") ||
    newTables.some(Boolean);
  if (fullyApplied) {
    console.log("ShareBox schema is already applied; no changes made.");
    process.exitCode = 0;
  } else if (partiallyApplied) {
    throw new Error(
      "Refusing to migrate a partially applied ShareBox schema; restore/reconcile it first",
    );
  } else {
    const before = {
      products: await scalarCount("Product"),
      orderItems: await scalarCount("OrderItem"),
      orderDeliveries: await scalarCount("OrderDelivery"),
      deliveryItems: await scalarCount("DeliveryItem"),
    };
    backupPath = `${databasePath}.pre-sharebox-${Date.now()}.bak`;
    if (existsSync(backupPath)) {
      throw new Error(`Refusing to overwrite existing backup ${backupPath}`);
    }
    const checkpoint = await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
    if (Number(checkpoint[0]?.busy) !== 0 || Number(checkpoint[0]?.log) > 0) {
      throw new Error(
        "Refusing to migrate: SQLite WAL could not be checkpointed; confirm all backend processes are stopped",
      );
    }
    const escapedBackupPath = backupPath.replaceAll("'", "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${escapedBackupPath}'`);
    chmodSync(backupPath, 0o600);
    await prisma.$disconnect();

    migrationStarted = true;
    execFileSync(
      process.platform === "win32" ? "cmd.exe" : prismaBin,
      process.platform === "win32"
        ? ["/c", prismaBin, "db", "execute", "--file", migrationFile, "--url", executeDatabaseUrl]
        : ["db", "execute", "--file", migrationFile, "--url", executeDatabaseUrl],
      { cwd: backendDir, stdio: "inherit" },
    );

    const verify = new PrismaClient();
    try {
      const after = {};
      for (const [key, table] of [
        ["products", "Product"],
        ["orderItems", "OrderItem"],
        ["orderDeliveries", "OrderDelivery"],
        ["deliveryItems", "DeliveryItem"],
      ]) {
        const rows = await verify.$queryRawUnsafe(
          `SELECT COUNT(*) AS count FROM "${table}"`,
        );
        after[key] = Number(rows[0].count);
      }
      const foreignKeyErrors = await verify.$queryRawUnsafe("PRAGMA foreign_key_check");
      if (JSON.stringify(after) !== JSON.stringify(before) || foreignKeyErrors.length) {
        throw new Error(
          "Post-migration verification failed; restore the database from the reported backup",
        );
      }
    } finally {
      await verify.$disconnect();
    }
    console.log(`ShareBox schema applied. Safety backup: ${backupPath}`);
  }
} catch (error) {
  await prisma.$disconnect().catch(() => {});
  if (migrationStarted && backupPath && existsSync(backupPath)) {
    copyFileSync(backupPath, databasePath);
    throw new Error(
      `ShareBox migration failed and the original database was restored from ${backupPath}: ${error.message}`,
      { cause: error },
    );
  }
  throw error;
} finally {
  await prisma.$disconnect().catch(() => {});
}
