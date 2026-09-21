import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(__dirname, "..");

describe("ShareBox additive migration", () => {
  it("never restores an unrelated backup when preflight refuses a filename collision", async () => {
    const wasmDir = dirname(require.resolve("sql.js/dist/sql-wasm.wasm"));
    const SQL = await initSqlJs({ locateFile: (file) => join(wasmDir, file) });
    const directory = await mkdtemp(join(tmpdir(), "sharebox-migration-collision-"));
    const databasePath = join(directory, "fixture.db");
    try {
      const fixture = new SQL.Database();
      fixture.run(`
        CREATE TABLE Product (id TEXT PRIMARY KEY);
        CREATE TABLE OrderItem (id TEXT PRIMARY KEY);
        CREATE TABLE DeliveryItem (id TEXT PRIMARY KEY);
        CREATE TABLE OrderDelivery (id TEXT PRIMARY KEY);
        INSERT INTO Product VALUES ('preserve-original');
      `);
      const original = Buffer.from(fixture.export());
      fixture.close();
      await writeFile(databasePath, original);
      const sentinelPath = `${databasePath}.pre-sharebox-1.bak`;
      await writeFile(sentinelPath, "unrelated existing file");
      expect(() => execFileSync(process.execPath, [
        "--import", "data:text/javascript,Date.now%3D()%3D%3E1",
        resolve(backendDir, "scripts/apply-sharebox-migration.js"),
      ], {
        cwd: backendDir,
        env: { ...process.env, DATABASE_URL: `file:${databasePath}`, SHAREBOX_MIGRATION_OFFLINE_ACK: "1" },
        stdio: "pipe",
      })).toThrow(/Refusing to overwrite existing backup/);
      expect(await readFile(databasePath)).toEqual(original);
      expect(await readFile(sentinelPath, "utf8")).toBe("unrelated existing file");
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("runs the guarded migration script against a real fixture and creates a private backup", async () => {
    const wasmDir = dirname(require.resolve("sql.js/dist/sql-wasm.wasm"));
    const SQL = await initSqlJs({ locateFile: (file) => join(wasmDir, file) });
    const directory = await mkdtemp(join(tmpdir(), "sharebox-migration-"));
    const databasePath = join(directory, "fixture.db");
    try {
      const fixture = new SQL.Database();
      fixture.run(`
        CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "slug" TEXT, "title" TEXT, "type" TEXT, "price" INTEGER);
        CREATE TABLE "OrderItem" ("id" TEXT PRIMARY KEY);
        CREATE TABLE "DeliveryItem" ("id" TEXT PRIMARY KEY, "content" TEXT);
        CREATE TABLE "OrderDelivery" (
          "id" TEXT PRIMARY KEY, "orderItemId" TEXT NOT NULL, "deliveryItemId" TEXT NOT NULL,
          "contentSnapshot" TEXT NOT NULL, "deliveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX "OrderDelivery_deliveryItemId_key" ON "OrderDelivery"("deliveryItemId");
        INSERT INTO "Product" VALUES ('product-1', 'legacy', 'Legacy', 'INSTANT_DELIVERY', 100);
        INSERT INTO "OrderItem" VALUES ('item-1');
        INSERT INTO "DeliveryItem" VALUES ('inventory-1', 'KEEP');
        INSERT INTO "OrderDelivery" ("id", "orderItemId", "deliveryItemId", "contentSnapshot")
          VALUES ('delivery-1', 'item-1', 'inventory-1', 'KEEP');
      `);
      await writeFile(databasePath, Buffer.from(fixture.export()));
      fixture.close();

      execFileSync(process.execPath, [resolve(backendDir, "scripts/apply-sharebox-migration.js")], {
        cwd: backendDir,
        env: {
          ...process.env,
          DATABASE_URL: `file:${databasePath}`,
          SHAREBOX_MIGRATION_OFFLINE_ACK: "1",
        },
        stdio: "pipe",
      });
      const migrated = new SQL.Database(await readFile(databasePath));
      expect(migrated.exec(`SELECT "contentSnapshot" FROM "OrderDelivery"`)[0].values).toEqual([
        ["KEEP"],
      ]);
      expect(migrated.exec(`PRAGMA foreign_key_check`)).toEqual([]);
      migrated.close();
      const backupName = (await readdir(directory)).find((name) => name.endsWith(".bak"));
      expect(backupName).toBeTruthy();
      expect((await stat(join(directory, backupName))).mode & 0o777).toBe(0o600);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it("preserves existing product, order delivery, and inventory fixtures", async () => {
    const wasmDir = dirname(require.resolve("sql.js/dist/sql-wasm.wasm"));
    const SQL = await initSqlJs({ locateFile: (file) => join(wasmDir, file) });
    const db = new SQL.Database();
    db.run(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE "Product" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "slug" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "price" INTEGER NOT NULL
      );
      CREATE TABLE "OrderItem" (
        "id" TEXT NOT NULL PRIMARY KEY
      );
      CREATE TABLE "DeliveryItem" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "content" TEXT NOT NULL
      );
      CREATE TABLE "OrderDelivery" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "orderItemId" TEXT NOT NULL,
        "deliveryItemId" TEXT NOT NULL,
        "contentSnapshot" TEXT NOT NULL,
        "deliveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OrderDelivery_orderItemId_fkey"
          FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id")
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "OrderDelivery_deliveryItemId_fkey"
          FOREIGN KEY ("deliveryItemId") REFERENCES "DeliveryItem" ("id")
          ON DELETE RESTRICT ON UPDATE CASCADE
      );
      CREATE UNIQUE INDEX "OrderDelivery_deliveryItemId_key"
        ON "OrderDelivery"("deliveryItemId");
      INSERT INTO "Product" VALUES ('product-1', 'legacy', 'Legacy', 'INSTANT_DELIVERY', 100);
      INSERT INTO "OrderItem" VALUES ('item-1');
      INSERT INTO "DeliveryItem" VALUES ('inventory-1', 'LEGACY-LICENSE');
      INSERT INTO "OrderDelivery" (
        "id", "orderItemId", "deliveryItemId", "contentSnapshot"
      ) VALUES ('delivery-1', 'item-1', 'inventory-1', 'LEGACY-LICENSE');
    `);

    const migration = await readFile(
      resolve(
        backendDir,
        "prisma/migrations/20260921190000_add_sharebox_fulfillment/migration.sql",
      ),
      "utf8",
    );
    db.run(migration);

    const product = db.exec(
      `SELECT "id", "slug", "shareboxCategoryId" FROM "Product" WHERE "id"='product-1'`,
    )[0].values[0];
    expect(product).toEqual(["product-1", "legacy", null]);
    const delivery = db.exec(
      `SELECT "id", "orderItemId", "deliveryItemId", "contentSnapshot", "shareboxFulfillmentId"
       FROM "OrderDelivery" WHERE "id"='delivery-1'`,
    )[0].values[0];
    expect(delivery).toEqual([
      "delivery-1",
      "item-1",
      "inventory-1",
      "LEGACY-LICENSE",
      null,
    ]);
    expect(
      db.exec(`SELECT COUNT(*) FROM "ShareboxSettings"`)[0].values[0][0],
    ).toBe(0);
    expect(db.exec("PRAGMA foreign_key_check")).toEqual([]);
    db.close();
  });

  it("rolls back every schema change when the migration errors", async () => {
    const wasmDir = dirname(require.resolve("sql.js/dist/sql-wasm.wasm"));
    const SQL = await initSqlJs({ locateFile: (file) => join(wasmDir, file) });
    const db = new SQL.Database();
    db.run(`
      CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "slug" TEXT, "title" TEXT, "type" TEXT, "price" INTEGER);
      CREATE TABLE "OrderItem" ("id" TEXT PRIMARY KEY);
      CREATE TABLE "DeliveryItem" ("id" TEXT PRIMARY KEY, "content" TEXT);
      CREATE TABLE "OrderDelivery" (
        "id" TEXT PRIMARY KEY, "orderItemId" TEXT NOT NULL, "deliveryItemId" TEXT NOT NULL,
        "contentSnapshot" TEXT NOT NULL, "deliveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX "OrderDelivery_deliveryItemId_key" ON "OrderDelivery"("deliveryItemId");
      INSERT INTO "Product" VALUES ('keep-me', 'legacy', 'Legacy', 'INSTANT_DELIVERY', 100);
    `);
    const migration = await readFile(
      resolve(backendDir, "prisma/migrations/20260921190000_add_sharebox_fulfillment/migration.sql"),
      "utf8",
    );
    const broken = migration.replace("COMMIT;", "THIS IS INVALID SQL;\nCOMMIT;");
    expect(() => db.run(broken)).toThrow();
    // The production runner closes the failed sqlite connection and restores its
    // byte-for-byte backup; explicitly ending this in-memory connection proves
    // that every DDL statement was still inside the transaction.
    db.run("ROLLBACK;");
    expect(db.exec(`SELECT "id" FROM "Product"`)[0].values).toEqual([["keep-me"]]);
    expect(db.exec(`PRAGMA table_info("Product")`)[0].values.map((row) => row[1])).not.toContain(
      "shareboxCategoryId",
    );
    expect(db.exec(`SELECT name FROM sqlite_master WHERE name='ShareboxFulfillment'`)).toEqual([]);
    db.close();
  });
});
