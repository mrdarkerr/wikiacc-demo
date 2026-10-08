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
    env: { ...process.env, DATABASE_URL: `file:${path}`, PRICING_MIGRATION_OFFLINE_ACK: "1", ...extra }, encoding: "utf8",
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
});
