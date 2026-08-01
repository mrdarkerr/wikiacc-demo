import { sendPatternSms } from "./service.js";

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;
const RETRY_BASE_DELAY_MS = 15_000;

function retryDelay(attempts) {
  return Math.min(
    MAX_RETRY_DELAY_MS,
    RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1),
  );
}

function errorSummary(error) {
  const code = error?.code ? `${error.code}: ` : "";
  return `${code}${error?.message ?? "Unknown SMS queue error"}`.slice(0, 2_000);
}

async function recoverStaleJobs(prisma, now, lockTimeoutMs) {
  const staleBefore = new Date(now.getTime() - lockTimeoutMs);
  await prisma.smsQueueJob.updateMany({
    where: {
      lockedAt: { lt: staleBefore },
      status: "PROCESSING",
    },
    data: {
      availableAt: now,
      lockedAt: null,
      status: "PENDING",
    },
  });
}

async function claimJobs(prisma, { batchSize, lockTimeoutMs, now }) {
  await recoverStaleJobs(prisma, now, lockTimeoutMs);

  const candidates = await prisma.smsQueueJob.findMany({
    where: {
      availableAt: { lte: now },
      status: "PENDING",
    },
    orderBy: [
      { availableAt: "asc" },
      { sequence: "asc" },
      { createdAt: "asc" },
    ],
    take: batchSize,
  });

  const claimed = [];
  for (const candidate of candidates) {
    const result = await prisma.smsQueueJob.updateMany({
      where: {
        id: candidate.id,
        status: "PENDING",
      },
      data: {
        attempts: { increment: 1 },
        lockedAt: now,
        status: "PROCESSING",
      },
    });

    if (result.count === 1) {
      claimed.push(
        await prisma.smsQueueJob.findUniqueOrThrow({
          where: { id: candidate.id },
        }),
      );
    }
  }
  return claimed;
}

async function markSent(prisma, job, result, now) {
  await prisma.smsQueueJob.update({
    where: { id: job.id },
    data: {
      failedAt: null,
      lastError: null,
      lockedAt: null,
      providerMessageId:
        result.providerMessageId === undefined ||
        result.providerMessageId === null
          ? null
          : String(result.providerMessageId),
      sentAt: now,
      status: "SENT",
    },
  });
}

async function markFailedAttempt(prisma, job, error, now) {
  const exhausted = job.attempts >= job.maxAttempts;
  await prisma.smsQueueJob.update({
    where: { id: job.id },
    data: exhausted
      ? {
          failedAt: now,
          lastError: errorSummary(error),
          lockedAt: null,
          status: "FAILED",
        }
      : {
          availableAt: new Date(now.getTime() + retryDelay(job.attempts)),
          lastError: errorSummary(error),
          lockedAt: null,
          status: "PENDING",
        },
  });
  return exhausted;
}

export async function processSmsQueueBatch(
  prisma,
  {
    batchSize = DEFAULT_BATCH_SIZE,
    fetchImpl,
    lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
    now = new Date(),
    timeoutMs,
  } = {},
) {
  const jobs = await claimJobs(prisma, { batchSize, lockTimeoutMs, now });
  const summary = {
    claimed: jobs.length,
    failed: 0,
    retried: 0,
    sent: 0,
  };

  for (const job of jobs) {
    try {
      const result = await sendPatternSms(
        prisma,
        {
          attributes: JSON.parse(job.attributesJson),
          numberFormat: job.numberFormat,
          patternCode: job.patternCode,
          recipient: job.recipient,
        },
        { fetchImpl, timeoutMs },
      );
      await markSent(prisma, job, result, new Date());
      summary.sent += 1;
    } catch (error) {
      const exhausted = await markFailedAttempt(prisma, job, error, new Date());
      summary[exhausted ? "failed" : "retried"] += 1;
    }
  }

  return summary;
}

export function startSmsQueueWorker(
  prisma,
  {
    batchSize = DEFAULT_BATCH_SIZE,
    fetchImpl,
    lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS,
    logger,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs,
  } = {},
) {
  let stopped = false;
  let timer;
  let running;

  const schedule = (delay) => {
    if (stopped) return;
    timer = setTimeout(run, delay);
    timer.unref?.();
  };

  const run = async () => {
    if (stopped) return;
    running = processSmsQueueBatch(prisma, {
      batchSize,
      fetchImpl,
      lockTimeoutMs,
      timeoutMs,
    });
    try {
      await running;
    } catch (error) {
      logger?.error?.({ err: error }, "SMS queue worker failed");
    } finally {
      running = undefined;
      schedule(pollIntervalMs);
    }
  };

  schedule(0);

  return {
    async stop() {
      stopped = true;
      clearTimeout(timer);
      await running;
    },
  };
}
