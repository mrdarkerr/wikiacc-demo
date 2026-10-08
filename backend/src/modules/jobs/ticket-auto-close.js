import { closeUnansweredTicketBatch } from "../tickets/auto-close.js";

export function registerTicketAutoCloseJob(scheduler, {
  enabled = true, inactivityHours = 48, intervalSeconds = 300, logger,
} = {}) {
  scheduler.register({ name: "ticket-auto-close", enabled,
    intervalMs: intervalSeconds * 1000,
    handler: async ({ withLease, now }) => {
      const closedAt = now();
      const cutoff = new Date(closedAt.getTime() - inactivityHours * 60 * 60 * 1000);
      let afterId, closedCount = 0, batchSize = 100;
      // Bounded transactions avoid holding SQLite's write lock for a full sweep.
      // A fixed cutoff keeps the entire cycle consistent and retry-idempotent.
      while (true) {
        let batch;
        try {
          batch = await withLease((tx) => closeUnansweredTicketBatch(tx, { cutoff, closedAt, afterId, batchSize }));
        } catch (error) {
          // A timed-out transaction rolls back completely. Retry the same cursor
          // with less work; never hide lost leases or other infrastructure errors.
          if (batchSize > 1 && ["JOB_TRANSACTION_TIMEOUT", "P2028"].includes(error?.code)) {
            batchSize = Math.max(1, Math.floor(batchSize / 2));
            continue;
          }
          throw error;
        }
        closedCount += batch.closedCount;
        if (!batch.hasMore) break;
        afterId = batch.afterId;
      }
      if (closedCount) logger?.info?.({ job: "ticket-auto-close", closedCount }, "Inactive tickets closed");
    },
  });
}
