import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(__dirname, "..");
const prismaDir = resolve(backendDir, "prisma");
const prismaBin = resolve(
  backendDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

function resolveSqlitePath(databaseUrl) {
  if (!databaseUrl?.startsWith("file:")) {
    throw new Error("DATABASE_URL must be a SQLite file: URL");
  }

  const rawPath = databaseUrl.slice("file:".length);
  if (isAbsolute(rawPath)) {
    return rawPath;
  }

  return resolve(prismaDir, rawPath);
}

const databasePath = resolveSqlitePath(
  process.env.DATABASE_URL ?? "file:./dev.db",
);

const prismaArgs = [
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ];

const sql = execFileSync(
  process.platform === "win32" ? "cmd.exe" : prismaBin,
  process.platform === "win32" ? ["/c", prismaBin, ...prismaArgs] : prismaArgs,
  {
    cwd: backendDir,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  },
);

const wasmDir = dirname(require.resolve("sql.js/dist/sql-wasm.wasm"));
const SQL = await initSqlJs({
  locateFile: (file) => join(wasmDir, file),
});

const database = new SQL.Database();
database.run("PRAGMA foreign_keys = OFF;");
database.run(sql);
database.run("PRAGMA foreign_keys = ON;");

const output = database.export();
database.close();

const databaseDir = dirname(databasePath);
if (!existsSync(databaseDir)) {
  mkdirSync(databaseDir, { recursive: true });
}

writeFileSync(databasePath, Buffer.from(output));
console.log(`SQLite schema applied to ${databasePath}`);
