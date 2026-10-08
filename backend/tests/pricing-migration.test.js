import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import initSqlJs from "sql.js";
import { describe, it, expect } from "vitest";

const require = createRequire(import.meta.url);
const SQL = await initSqlJs({ locateFile: () => require.resolve("sql.js/dist/sql-wasm.wasm") });
const script = resolve("scripts/apply-pricing-migration.js");
function fixture() {
  const dir = mkdtempSync(resolve(tmpdir(), "wikiacc-pricing-migration-"));
  const path = resolve(dir, "old.db");
  const db = new SQL.Database();
  db.run(`CREATE TABLE Product(id TEXT PRIMARY KEY, price INTEGER NOT NULL);
    CREATE TABLE "Order"(id TEXT PRIMARY KEY, totalAmount INTEGER NOT NULL);
    CREATE TABLE OrderItem(id TEXT PRIMARY KEY, priceSnapshot INTEGER NOT NULL);
    CREATE TABLE TelegramSettings(id TEXT PRIMARY KEY);
    CREATE TABLE Wallet(id TEXT PRIMARY KEY, balance INTEGER NOT NULL);
    CREATE TABLE PaymentAttempt(id TEXT PRIMARY KEY, providerAmountRial INTEGER NOT NULL);
    INSERT INTO Product VALUES ('product', 123456);
    INSERT INTO "Order" VALUES ('order', 246912);
    INSERT INTO OrderItem VALUES ('item', 123456);
    INSERT INTO Wallet VALUES ('wallet', 999);
    INSERT INTO PaymentAttempt VALUES ('payment', 2469120);`);
  writeFileSync(path, db.export()); db.close();
  return { dir, path, run: (extra = {}) => execFileSync(process.execPath, [script], {
    env: { ...process.env, DATABASE_URL: `file:${path}`, PRICING_MIGRATION_OFFLINE_ACK: "1", ...extra }, encoding: "utf8", stdio: "pipe",
  }) };
}
describe("pricing additive migration", () => {
  it("preserves existing money and adds unknown historical snapshots atomically", () => {
    const f = fixture();
    try {
      const output = f.run();
      expect(output).toContain("Pricing schema added");
      const backupPath = JSON.parse(output.split("BACKUP=")[1].trim());
      expect(statSync(backupPath).mode & 0o777).toBe(0o600);
      const backupDb = new SQL.Database(readFileSync(backupPath));
      expect(backupDb.exec("SELECT price FROM Product")[0].values).toEqual([[123456]]);
      backupDb.close();
      const db = new SQL.Database(readFileSync(f.path));
      expect(db.exec("SELECT price,priceCurrency,basePrice,profitValue FROM Product")[0].values).toEqual([[123456, "TOMAN", "123456", "0"]]);
      expect(db.exec("SELECT priceSnapshot,profitTomanSnapshot,exchangeRateSnapshot FROM OrderItem")[0].values).toEqual([[123456, null, null]]);
      expect(db.exec("SELECT balance FROM Wallet")[0].values).toEqual([[999]]);
      expect(db.exec("SELECT providerAmountRial FROM PaymentAttempt")[0].values).toEqual([[2469120]]);
      expect(db.exec("SELECT fallbackRateToman FROM PricingSettings")[0].values).toEqual([[270000]]);
      expect(db.exec("PRAGMA integrity_check")[0].values).toEqual([["ok"]]);
      db.close();
      expect(f.run()).toContain("already applied");
    } finally { rmSync(f.dir, { recursive: true, force: true }); }
  });
  it("refuses missing offline acknowledgement and partial upgrades without touching original data", () => {
    const f = fixture();
    try {
      const original = readFileSync(f.path);
      expect(() => f.run({ PRICING_MIGRATION_OFFLINE_ACK: "0" })).toThrow(/Stop backend writers/);
      expect(readFileSync(f.path)).toEqual(original);
      const db = new SQL.Database(original);
      db.run("ALTER TABLE Product ADD COLUMN priceCurrency TEXT DEFAULT 'TOMAN'");
      writeFileSync(f.path, db.export()); db.close();
      const partial = readFileSync(f.path);
      expect(() => f.run()).toThrow(/Partial pricing schema/);
      expect(readFileSync(f.path)).toEqual(partial);
    } finally { rmSync(f.dir, { recursive: true, force: true }); }
  });
  it("migrates the full prior domain schema while preserving every original column and row", () => {
    const f = fixture();
    try {
      // Fixed prior-revision schema, independent of the implementation under test.
      // Contains no customer records; all rows below are synthetic.
      const db = new SQL.Database();
      db.run(readFileSync(new URL("./fixtures/pre-pricing-schema.sql", import.meta.url), "utf8"));
      db.run(`INSERT INTO User(id,name,role,updatedAt) VALUES ('buyer','Synthetic buyer','USER',CURRENT_TIMESTAMP);
        INSERT INTO Wallet(id,userId,balance,updatedAt) VALUES ('wallet','buyer',987654,CURRENT_TIMESTAMP);
        INSERT INTO Product(id,slug,title,type,price,updatedAt) VALUES ('product','fixture-product','Synthetic product','CUSTOM_FORM',123456,CURRENT_TIMESTAMP);
        INSERT INTO "Order"(id,userId,totalAmount,paymentStatus,paymentMethod,updatedAt) VALUES ('order','buyer',246912,'PAID','JIBIT',CURRENT_TIMESTAMP);
        INSERT INTO OrderItem(id,orderId,productId,titleSnapshot,priceSnapshot,productTypeSnapshot,quantity) VALUES ('item','order','product','Old title',123456,'CUSTOM_FORM',2);
        INSERT INTO PaymentAttempt(id,orderId,clientReferenceNumber,providerAmountRial,reconcileAfter,updatedAt) VALUES ('payment','order','fixture-reference',2469120,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
        INSERT INTO Ticket(id,userId,subject,updatedAt) VALUES ('ticket','buyer','Synthetic ticket',CURRENT_TIMESTAMP);
        INSERT INTO TelegramSettings(id,updatedAt) VALUES ('default',CURRENT_TIMESTAMP);`);
      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0].values.flat();
      const queries = tables.map((table) => {
        const originalColumns = db.exec(`PRAGMA table_info("${table}")`)[0].values.map((row) => `"${row[1]}"`);
        return `SELECT ${originalColumns.join(",")} FROM "${table}"`;
      });
      const before = queries.map((query) => db.exec(query));
      writeFileSync(f.path, db.export()); db.close();
      f.run();
      const migrated = new SQL.Database(readFileSync(f.path));
      expect(queries.map((query) => migrated.exec(query))).toEqual(before);
      expect(migrated.exec("PRAGMA foreign_key_check")).toEqual([]);
      migrated.close();
      expect(f.run()).toContain("already applied");
    } finally { rmSync(f.dir, { recursive: true, force: true }); }
  });
});
