import { beforeEach, afterAll, describe, it, expect, vi } from "vitest";
import { createTestDatabase } from "./helpers/database.js";
const db = createTestDatabase("scheduler");
afterAll(() => db.close());
beforeEach(() => db.prisma.scheduledJob.deleteMany());
describe("durable periodic jobs", () => {
  it("runs named jobs initially and exactly when their interval is due", async () => {
    const { createScheduler } = await import("../src/modules/jobs/scheduler.js");
    let now = new Date("2026-10-08T08:00:00Z");
    const handler = vi.fn(async () => {});
    const scheduler = createScheduler(db.prisma, { now: () => now });
    scheduler.register({ name: "rates", intervalMs: 120000, handler });
    await scheduler.runDue();
    await scheduler.runDue();
    expect(handler).toHaveBeenCalledTimes(1);
    now = new Date(now.getTime() + 120000);
    await scheduler.runDue();
    expect(handler).toHaveBeenCalledTimes(2);
    expect(await db.prisma.scheduledJob.findUnique({ where: { name: "rates" } })).toMatchObject({ runCount: 2, failureCount: 0, leaseToken: null, lastSuccessAt: now });
    await scheduler.stop();
  });
  it("excludes concurrent workers with an atomic database lease", async () => {
    const { createScheduler } = await import("../src/modules/jobs/scheduler.js");
    const now = () => new Date("2026-10-08T08:00:00Z");
    let release; const gate = new Promise((resolve) => { release = resolve; });
    const handler = vi.fn(async () => gate);
    const first = createScheduler(db.prisma, { now });
    const second = createScheduler(db.prisma, { now });
    first.register({ name: "rates", intervalMs: 120000, handler });
    second.register({ name: "rates", intervalMs: 120000, handler });
    // Separate workers share a job row; keep the first handler active.
    const run = first.runDue();
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await second.runDue();
    expect(handler).toHaveBeenCalledTimes(1);
    release(); await run;
    await first.stop(); await second.stop();
  });
  it("fences an expired owner and recovers a persisted abandoned job after restart", async () => {
    const { createScheduler } = await import("../src/modules/jobs/scheduler.js");
    const now = new Date("2026-10-08T08:00:00Z");
    await db.prisma.scheduledJob.create({ data: { name: "rates", nextRunAt: now, leaseToken: "dead-worker", leaseExpiresAt: new Date(now.getTime() - 1) } });
    const handler = vi.fn(async ({ withLease }) => {
      await db.prisma.scheduledJob.update({ where: { name: "rates" }, data: { leaseToken: "replacement-owner" } });
      await expect(withLease((tx) => tx.exchangeRate.create({ data: { rateToman: 270000 } }))).rejects.toMatchObject({ code: "JOB_LEASE_LOST" });
    });
    const scheduler = createScheduler(db.prisma, { now: () => now });
    scheduler.register({ name: "rates", intervalMs: 120000, handler });
    await scheduler.runDue();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(await db.prisma.scheduledJob.findUnique({ where: { name: "rates" } })).toMatchObject({ leaseToken: "replacement-owner" });
    expect(await db.prisma.exchangeRate.count()).toBe(0);
    await scheduler.stop();
  });
  it("rolls back a withLease write when the job times out inside its callback", async () => {
    const { createScheduler } = await import("../src/modules/jobs/scheduler.js");
    let wrote, release;
    const written = new Promise((resolve) => { wrote = resolve; });
    const gate = new Promise((resolve) => { release = resolve; });
    let leaseResult;
    const scheduler = createScheduler(db.prisma);
    scheduler.register({ name: "delayed-write", intervalMs: 120000, timeoutMs: 200, handler: ({ withLease, signal }) => {
      leaseResult = withLease(async (tx) => {
        await tx.exchangeRate.create({ data: { rateToman: 270000 } });
        wrote();
        await gate;
      }).then(() => "committed", (error) => error.code);
      signal.addEventListener("abort", release, { once: true });
      return leaseResult;
    } });
    const run = scheduler.runDue();
    await written;
    await run;
    expect(await leaseResult).toBe("JOB_LEASE_LOST");
    expect(await db.prisma.exchangeRate.count()).toBe(0);
    expect(await db.prisma.scheduledJob.findUnique({ where: { name: "delayed-write" } })).toMatchObject({ lastErrorCode: "JOB_TIMEOUT", leaseToken: null });
    await scheduler.stop();
  });
  it("keeps the lease and defers timeout logging until a committed transaction settles", async () => {
    const { createScheduler } = await import("../src/modules/jobs/scheduler.js");
    let release, committed;
    const settlementGate = new Promise((resolve) => { release = resolve; });
    const committedTransaction = new Promise((resolve) => { committed = resolve; });
    // Hold only promise settlement; the real Prisma transaction has already committed.
    const prisma = new Proxy(db.prisma, {
      get(target, key) {
        if (key === "$transaction") return async (...args) => {
          const result = await target.$transaction(...args);
          committed();
          await settlementGate;
          return result;
        };
        return Reflect.get(target, key);
      },
    });
    const logger = { warn: vi.fn() };
    let aborted;
    const abortEvent = new Promise((resolve) => { aborted = resolve; });
    const scheduler = createScheduler(prisma, { logger });
    scheduler.register({ name: "commit-settlement", intervalMs: 120000, timeoutMs: 200,
      handler: ({ withLease, signal }) => {
        signal.addEventListener("abort", aborted, { once: true });
        return withLease((tx) => tx.exchangeRate.create({ data: { rateToman: 270001 } }));
      },
    });
    let resolved = false;
    const run = scheduler.runDue().then(() => { resolved = true; });
    let committedRateCount;
    try {
      await committedTransaction;
      await abortEvent;
      const job = await db.prisma.scheduledJob.findUnique({ where: { name: "commit-settlement" } });
      expect(logger.warn).not.toHaveBeenCalled();
      expect(job.leaseToken).not.toBeNull();
      expect(job.failureCount).toBe(0);
      expect(resolved).toBe(false);
    } finally {
      release();
      try {
        await run;
        await scheduler.stop();
        committedRateCount = await db.prisma.exchangeRate.count({ where: { rateToman: 270001 } });
      } finally {
        await db.prisma.exchangeRate.deleteMany({ where: { rateToman: 270001 } });
      }
    }
    expect(logger.warn).toHaveBeenCalledWith({ job: "commit-settlement", errorCode: "JOB_TIMEOUT" }, "Scheduled job failed");
    expect(await db.prisma.scheduledJob.findUnique({ where: { name: "commit-settlement" } })).toMatchObject({
      leaseToken: null, failureCount: 1, lastErrorCode: "JOB_TIMEOUT",
    });
    expect(committedRateCount).toBe(1);
  });
  it("rolls back when a lease expires during a withLease callback", async () => {
    const { createScheduler } = await import("../src/modules/jobs/scheduler.js");
    let now = new Date("2026-10-08T08:00:00Z");
    let leaseResult;
    const scheduler = createScheduler(db.prisma, { now: () => now });
    scheduler.register({ name: "expired-inside", intervalMs: 120000, handler: ({ withLease }) => {
      leaseResult = withLease(async (tx) => {
        await tx.exchangeRate.create({ data: { rateToman: 270000 } });
        now = new Date(now.getTime() + 36000);
      }).then(() => "committed", (error) => error.code);
      return leaseResult;
    } });
    await scheduler.runDue();
    expect(await leaseResult).toBe("JOB_LEASE_LOST");
    expect(await db.prisma.exchangeRate.count()).toBe(0);
    await scheduler.stop();
  });
  it.each([
    { timeoutMs: 200, errorCode: "JOB_TIMEOUT" },
    { timeoutMs: 30000, errorCode: "JOB_TRANSACTION_TIMEOUT" },
  ])("releases a stalled withLease transaction so stop remains bounded ($timeoutMs ms)", async ({ timeoutMs, errorCode }) => {
    const { createScheduler } = await import("../src/modules/jobs/scheduler.js");
    let wrote, release;
    const written = new Promise((resolve) => { wrote = resolve; });
    const stalledCallback = new Promise((resolve) => { release = resolve; });
    const scheduler = createScheduler(db.prisma);
    scheduler.register({ name: "stalled-lease", intervalMs: 120000, timeoutMs, handler: ({ withLease }) =>
      withLease(async (tx) => {
        await tx.exchangeRate.create({ data: { rateToman: 270000 } });
        wrote();
        // Deliberately does not cooperate with abort. Release is test cleanup only.
        await stalledCallback;
      }),
    });
    const run = scheduler.runDue();
    await written;
    let guard;
    try {
      await Promise.race([
        scheduler.stop(),
        new Promise((_, reject) => { guard = setTimeout(() => reject(new Error("stop waited on stalled transaction")), 2500); }),
      ]);
    } finally { clearTimeout(guard); release(); await run; }
    await run;
    expect(await db.prisma.exchangeRate.count()).toBe(0);
    expect(await db.prisma.scheduledJob.findUnique({ where: { name: "stalled-lease" } })).toMatchObject({ lastErrorCode: errorCode, leaseToken: null });
  });
  it("bounds stalled handlers without stopping other jobs or permitting late writes", async () => {
    const { createScheduler } = await import("../src/modules/jobs/scheduler.js");
    let context;
    const scheduler = createScheduler(db.prisma);
    scheduler.register({ name: "stalled", intervalMs: 120000, timeoutMs: 20, handler: (ctx) => { context = ctx; return new Promise(() => {}); } });
    const good = vi.fn(async () => {});
    scheduler.register({ name: "good", intervalMs: 120000, handler: good });
    await scheduler.runDue();
    expect(good).toHaveBeenCalledTimes(1);
    expect(await db.prisma.scheduledJob.findUnique({ where: { name: "stalled" } })).toMatchObject({ failureCount: 1, lastErrorCode: "JOB_TIMEOUT", leaseToken: null });
    await expect(context.withLease(() => {})).rejects.toMatchObject({ code: "JOB_LEASE_LOST" });
    await scheduler.stop();
    await scheduler.runDue(); expect(good).toHaveBeenCalledTimes(1);
  });
});
