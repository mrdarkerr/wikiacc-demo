import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { sendTelegramMessage, safeTelegramErrorCode, TelegramApiError } from "./client.js";
import { categoryFields, configurationFingerprint, getTelegramSettings, telegramCredentials } from "./settings.js";

export function adminLink(job, webAppUrl = env.WEB_APP_URL) {
  const section = { ORDER: "orders", TICKET: "tickets" }[job.referenceType];
  if (!section || !job.referenceId) return undefined;
  const url = new URL(`/admin/${section}/${encodeURIComponent(job.referenceId)}`, webAppUrl);
  return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
}

async function claimJob(prisma, settings, now, leaseMs) {
  const categories = Object.entries(categoryFields).filter(([, field]) => settings[field]).map(([category]) => category);
  const eligible = { category: { in: categories }, OR: [
    { status: "PENDING", availableAt: { lte: now } },
    { status: "PROCESSING", leaseExpiresAt: { lte: now } },
  ] };
  const candidate = await prisma.telegramQueueJob.findFirst({
    where: eligible, orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
  });
  if (!candidate) return null;
  const leaseToken = randomUUID();
  const result = await prisma.telegramQueueJob.updateMany({
    where: { id: candidate.id, ...eligible },
    data: { status: "PROCESSING", leaseToken, leaseExpiresAt: new Date(now.getTime() + leaseMs) },
  });
  return result.count === 1 ? { ...candidate, leaseToken } : null;
}

function owned(job) { return { id: job.id, status: "PROCESSING", leaseToken: job.leaseToken }; }

export async function processTelegramQueueBatch(prisma, {
  fetchImpl, timeoutMs = env.TELEGRAM_REQUEST_TIMEOUT_MS, now = new Date(),
  leaseMs = 60000, webAppUrl = env.WEB_APP_URL,
} = {}) {
  // Deliberately one send per worker tick: a single channel does not need a high-throughput queue.
  const summary = { claimed: 0, sent: 0, failed: 0, retried: 0 };
  const settings = await getTelegramSettings(prisma);
  if (!settings?.enabled || (settings.cooldownUntil && settings.cooldownUntil > now)) return summary;
  const job = await claimJob(prisma, settings, now, Math.max(leaseMs, timeoutMs + 10000));
  if (!job) return summary;
  summary.claimed = 1;
  const latest = await getTelegramSettings(prisma);
  if (!latest?.enabled || !latest[categoryFields[job.category]] || (latest.cooldownUntil && latest.cooldownUntil > now)) {
    await prisma.telegramQueueJob.updateMany({ where: owned(job), data: { status: "PENDING", leaseToken: null, leaseExpiresAt: null } });
    return summary;
  }
  const attempts = job.attempts + 1;
  try {
    if (configurationFingerprint(latest) !== job.configFingerprint) {
      throw new TelegramApiError("TELEGRAM_CONFIGURATION_CHANGED");
    }
    if (job.attempts >= job.maxAttempts) throw new TelegramApiError("TELEGRAM_REQUEST_FAILED");
    const started = await prisma.telegramQueueJob.updateMany({ where: owned(job), data: { attempts } });
    if (!started.count) return summary;
    const result = await sendTelegramMessage({
      ...telegramCredentials(latest), text: job.messageText, buttonUrl: adminLink(job, webAppUrl),
    }, { fetchImpl, timeoutMs });
    const saved = await prisma.telegramQueueJob.updateMany({ where: owned(job), data: {
      status: "SENT", sentAt: new Date(), providerMessageId: result.messageId,
      lastErrorCode: null, failedAt: null, leaseToken: null, leaseExpiresAt: null,
    } });
    summary.sent = saved.count;
  } catch (error) {
    const code = safeTelegramErrorCode(error);
    const terminal = attempts >= job.maxAttempts || [
      "TELEGRAM_HTTP_400", "TELEGRAM_HTTP_401", "TELEGRAM_HTTP_403", "TELEGRAM_HTTP_404",
      "TELEGRAM_CONFIG_REQUIRED", "TELEGRAM_TOKEN_UNREADABLE", "TELEGRAM_CONFIGURATION_CHANGED",
      "TELEGRAM_BASE_URL_INVALID", "TELEGRAM_BASE_URL_UNSAFE",
    ].includes(code);
    const delayMs = error.retryAfterSeconds
      ? Math.max(1000, error.retryAfterSeconds * 1000)
      : Math.min(3600000, 15000 * 2 ** Math.min(attempts - 1, 8));
    const saved = await prisma.telegramQueueJob.updateMany({ where: owned(job), data: {
      status: terminal ? "FAILED" : "PENDING", attempts, lastErrorCode: code,
      failedAt: terminal ? new Date() : null,
      availableAt: new Date(now.getTime() + delayMs), leaseToken: null, leaseExpiresAt: null,
    } });
    // Pause all due jobs for this destination when Telegram rate-limits it.
    if (code === "TELEGRAM_RATE_LIMITED") {
      await prisma.telegramSettings.updateMany({ where: {
        id: latest.id, baseUrl: latest.baseUrl, destinationChatId: latest.destinationChatId,
        botTokenFingerprint: latest.botTokenFingerprint,
      }, data: { cooldownUntil: new Date(now.getTime() + delayMs) } });
      await prisma.telegramQueueJob.updateMany({ where: {
        status: "PENDING", configFingerprint: job.configFingerprint,
        availableAt: { lt: new Date(now.getTime() + delayMs) },
      }, data: { availableAt: new Date(now.getTime() + delayMs) } });
    }
    summary[terminal ? "failed" : "retried"] = saved.count;
  }
  return summary;
}

export function startTelegramQueueWorker(prisma, { intervalMs = 5000, logger, ...options } = {}) {
  let stopped = false;
  let timer;
  let running;
  const run = async () => {
    if (stopped) return;
    running = processTelegramQueueBatch(prisma, options);
    try { await running; }
    catch { logger?.error?.("Telegram queue cycle failed; no credentials or payload logged"); }
    finally {
      running = undefined;
      if (!stopped) { timer = setTimeout(run, intervalMs); timer.unref?.(); }
    }
  };
  timer = setTimeout(run, 0);
  timer.unref?.();
  return { async stop() { stopped = true; clearTimeout(timer); await running?.catch(() => {}); } };
}
