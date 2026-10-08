import { afterAll, it, expect, vi } from "vitest";
import { createTestDatabase } from "./helpers/database.js";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "pricing-jobs-test-secret-only";
const db = createTestDatabase("pricing-jobs");
let app;
afterAll(async () => { await app?.close(); await db.close(); });
it("registers the 120-second Wallex job and stores its result without requests starting test workers", async () => {
  const { buildApp } = await import("../src/app.js");
  const fetchRate = vi.fn(async () => ({ rateToman: 270000, source: "WALLEX", symbol: "USDTTMN" }));
  app = await buildApp({ prisma: db.prisma, logger: false, wallexClient: { fetchRate }, enableJibitReconciliation: false });
  expect(fetchRate).not.toHaveBeenCalled();
  await app.scheduler.runDue();
  expect(fetchRate).toHaveBeenCalledTimes(1);
  expect(await db.prisma.exchangeRate.count()).toBe(1);
  const job = await db.prisma.scheduledJob.findUnique({ where: { name: "wallex-usd-toman" } });
  expect(job.nextRunAt.getTime() - job.lastStartedAt.getTime()).toBe(120000);
  expect(job.lastErrorCode).toBe(null);
});
