import { randomUUID } from "node:crypto";
import { enqueueTelegramEvent } from "../telegram/events.js";
import { getEffectiveRate, getPricingSettings } from "./service.js";
import { safeWallexErrorCode } from "./wallex-client.js";

// Caller supplies a transaction (or scheduler's fenced transaction).
// Incident and queue state commit together; restart does not create duplicates.
export async function checkRateHealth(tx, { now = new Date(), errorCode } = {}) {
  const state = await tx.exchangeRateSyncState.upsert({ where: { id: "USD_TOMAN" }, create: { id: "USD_TOMAN", updatedAt: now }, update: {} });
  const rate = await getEffectiveRate(tx, { now });
  const settings = await getPricingSettings(tx);
  const failed = errorCode ?? rate.lastErrorCode;
  // Give a first fetch time to start, but a never-started job must also alarm.
  const bootstrapAt = state.lastAttemptAt ?? state.updatedAt;
  if (!failed && !rate.fetchedAt && !state.incidentId && now.getTime() - bootstrapAt.getTime() < settings.staleAfterSeconds * 1000) return rate;
  if (failed || rate.stale) {
    const incidentId = state.incidentId ?? randomUUID();
    const started = state.incidentStartedAt ?? now;
    if (!state.lastAlertAt || now.getTime() - state.lastAlertAt.getTime() >= settings.alertCooldownSeconds * 1000) {
      const event = await enqueueTelegramEvent(tx, {
        category: "EXCHANGE_RATE", eventType: "EXCHANGE_RATE_STALE",
        key: `${incidentId}:${now.getTime()}`, referenceType: "EXCHANGE_RATE", referenceId: incidentId,
        text: ["⚠️ اختلال به‌روزرسانی نرخ دلار ویکی‌اکانت", `کد: ${failed ? safeWallexErrorCode({ code: failed }) : "EXCHANGE_RATE_STALE"}`,
          `نرخ مورد استفاده: ${rate.rateToman.toLocaleString("fa-IR")} تومان`, `منبع: ${rate.source}`,
          `آخرین دریافت معتبر: ${rate.fetchedAt?.toISOString() ?? "ندارد"}`,
          "خرید با آخرین نرخ معتبر یا نرخ پشتیبان ادامه دارد."].join("\n"),
      });
      await tx.exchangeRateSyncState.update({ where: { id: "USD_TOMAN" }, data: { incidentId, incidentStartedAt: started, ...(event ? { lastAlertAt: now } : {}) } });
    }
  } else if (state.incidentId) {
    if (state.lastAlertAt) await enqueueTelegramEvent(tx, {
      category: "EXCHANGE_RATE", eventType: "EXCHANGE_RATE_RECOVERED", key: state.incidentId,
      referenceType: "EXCHANGE_RATE", referenceId: state.incidentId,
      text: `✅ به‌روزرسانی نرخ دلار بازیابی شد\nنرخ: ${rate.rateToman.toLocaleString("fa-IR")} تومان\nمنبع: WALLEX / USDTTMN`,
    });
    await tx.exchangeRateSyncState.update({ where: { id: "USD_TOMAN" }, data: { incidentId: null, incidentStartedAt: null, lastAlertAt: null } });
  }
  return rate;
}
