import { randomUUID } from "node:crypto";

const jobError = (code) => Object.assign(new Error(code), { code });
const safeError = (error) => /^[A-Z][A-Z0-9_]{0,79}$/.test(error?.code ?? "") ? error.code : "JOB_FAILED";

// Handlers do network work outside the transaction, then use withLease for every
// durable side effect. Timeout/lease fencing prevents a late owner from writing.
export function createScheduler(prisma, { now = () => new Date(), tickMs = 1000, logger } = {}) {
  const registry = new Map();
  let timer, cycle, stopped = false;
  if (!Number.isInteger(tickMs) || tickMs < 1 || tickMs > 60000) throw new Error("Invalid scheduler tick");

  async function execute(job) {
    const startedAt = now();
    await prisma.scheduledJob.upsert({ where: { name: job.name }, create: { name: job.name, nextRunAt: startedAt }, update: {} });
    const token = randomUUID();
    const claimed = await prisma.scheduledJob.updateMany({
      where: { name: job.name, nextRunAt: { lte: startedAt }, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: startedAt } }] },
      data: { leaseToken: token, leaseExpiresAt: new Date(startedAt.getTime() + job.timeoutMs + 5000),
        lastStartedAt: startedAt, nextRunAt: new Date(startedAt.getTime() + job.intervalMs), runCount: { increment: 1 } },
    });
    if (!claimed.count) return;
    const controller = new AbortController();
    let timeout;
    const activeTransactions = new Set();
    const withLease = (fn) => {
      if (controller.signal.aborted) return Promise.reject(jobError("JOB_LEASE_LOST"));
      const transaction = prisma.$transaction(async (tx) => {
        if (controller.signal.aborted) throw jobError("JOB_LEASE_LOST");
        const at = now();
        const held = await tx.scheduledJob.updateMany({
          where: { name: job.name, leaseToken: token, leaseExpiresAt: { gt: at } }, data: { updatedAt: at },
        });
        if (!held.count) throw jobError("JOB_LEASE_LOST");
        // Prisma's timeout expires the DB transaction, but it cannot settle an
        // uncooperative JavaScript callback. Bound that callback explicitly too.
        let callbackTimer, abortCallback, result;
        const aborted = new Promise((_, reject) => {
          abortCallback = () => reject(jobError("JOB_LEASE_LOST"));
          controller.signal.addEventListener("abort", abortCallback, { once: true });
          if (controller.signal.aborted) abortCallback();
        });
        try {
          result = await Promise.race([
            Promise.resolve().then(() => {
              if (controller.signal.aborted) throw jobError("JOB_LEASE_LOST");
              return fn(tx);
            }),
            aborted,
            new Promise((_, reject) => { callbackTimer = setTimeout(() => reject(jobError("JOB_TRANSACTION_TIMEOUT")), 1000); }),
          ]);
        } finally {
          clearTimeout(callbackTimer);
          controller.signal.removeEventListener("abort", abortCallback);
        }
        if (controller.signal.aborted) throw jobError("JOB_LEASE_LOST");
        const finishedAt = now();
        const stillHeld = await tx.scheduledJob.updateMany({
          where: { name: job.name, leaseToken: token, leaseExpiresAt: { gt: finishedAt } }, data: { updatedAt: finishedAt },
        });
        if (controller.signal.aborted || !stillHeld.count) throw jobError("JOB_LEASE_LOST");
        return result;
      }, { timeout: 1000 });
      activeTransactions.add(transaction);
      transaction.then(
        () => activeTransactions.delete(transaction),
        () => activeTransactions.delete(transaction),
      );
      return transaction;
    };
    let errorCode = null;
    try {
      await Promise.race([
        Promise.resolve().then(() => job.handler({ signal: controller.signal, withLease, now })),
        new Promise((_, reject) => { timeout = setTimeout(() => { controller.abort(); reject(jobError("JOB_TIMEOUT")); }, job.timeoutMs); }),
      ]);
    } catch (error) {
      errorCode = safeError(error);
    } finally {
      clearTimeout(timeout);
      controller.abort();
      // An atomic commit submitted before abort cannot be revoked. Wait for its
      // transaction promise to settle while this owner still holds the lease.
      await Promise.allSettled([...activeTransactions]);
      if (errorCode) logger?.warn?.({ job: job.name, errorCode }, "Scheduled job failed");
      const finishedAt = now();
      await prisma.scheduledJob.updateMany({
        where: { name: job.name, leaseToken: token },
        data: { leaseToken: null, leaseExpiresAt: null, lastFinishedAt: finishedAt, lastErrorCode: errorCode,
          ...(errorCode ? { failureCount: { increment: 1 } } : { lastSuccessAt: finishedAt }) },
      });
    }
  }
  function runDue() {
    if (stopped) return Promise.resolve();
    if (cycle) return cycle;
    cycle = Promise.all([...registry.values()].filter((job) => job.enabled).map(async (job) => {
      try { await execute(job); }
      catch (error) { logger?.error?.({ job: job.name, errorCode: safeError(error) }, "Scheduled job infrastructure failure"); }
    })).finally(() => { cycle = null; });
    return cycle;
  }
  return {
    register({ name, intervalMs, timeoutMs = 30000, enabled = true, handler }) {
      if (!/^[a-z][a-z0-9-]{0,79}$/.test(name) || registry.has(name) || !Number.isSafeInteger(intervalMs) || intervalMs < 1 || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3600000 || typeof handler !== "function") throw new Error("Invalid or duplicate scheduled job");
      registry.set(name, { name, intervalMs, timeoutMs, enabled, handler });
    },
    runDue,
    start() {
      if (stopped) throw new Error("Scheduler is stopped");
      if (timer) return;
      timer = setInterval(() => { void runDue(); }, tickMs);
      timer.unref?.();
      void runDue();
    },
    async stop() { stopped = true; clearInterval(timer); await cycle; },
  };
}
