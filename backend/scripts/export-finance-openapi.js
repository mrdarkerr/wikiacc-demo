import { writeFile } from "node:fs/promises";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "openapi-export-no-live-auth-secret";
const { buildApp } = await import("../src/app.js");
const app = await buildApp({ logger: false, enableJibitReconciliation: false });
try {
  await app.ready();
  const full = app.swagger();
  const document = { ...full, info: { ...full.info, title: "WikiAcc Admin Finance API" },
    paths: Object.fromEntries(Object.entries(full.paths).filter(([path]) => path.startsWith("/api/v1/admin/finance/"))) };
  await writeFile(new URL("../../docs/openapi-finance.json", import.meta.url), `${JSON.stringify(document, null, 2)}\n`);
  console.log(`Exported ${Object.keys(document.paths).length} real Swagger paths (no DB reads, no workers).`);
} finally { await app.close(); }
