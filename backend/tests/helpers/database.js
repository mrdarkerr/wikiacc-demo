import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

export function createTestDatabase(label) {
  const directory = mkdtempSync(resolve(tmpdir(), `wikiacc-${label}-`));
  const backendDir = fileURLToPath(new URL("../..", import.meta.url));
  const databaseUrl = `file:${resolve(directory, "test.db")}`;
  execFileSync(process.execPath, [resolve(backendDir, "scripts/apply-schema.js")], {
    cwd: backendDir, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe",
  });
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  return { prisma, databaseUrl, directory, async close() { await prisma.$disconnect(); rmSync(directory, { recursive: true, force: true }); } };
}
