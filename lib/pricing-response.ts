import { ApiError } from "./api-error";
import type { ExchangeRate, PricingQuote, PricingSettings, PricingStatus } from "../types/api";

type RecordValue = Record<string, unknown>;
function record(value: unknown): value is RecordValue { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function integer(value: unknown, min = 0, max = 2147483647): value is number { return Number.isInteger(value) && (value as number) >= min && (value as number) <= max; }
function date(value: unknown) { return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value))); }
function invalid(): never { throw new ApiError(502, "ساختار پاسخ قیمت‌گذاری معتبر نیست.", { error: { code: "API_INVALID_RESPONSE", message: "ساختار پاسخ قیمت‌گذاری معتبر نیست." } }); }
function rate(value: unknown): value is ExchangeRate {
  return record(value) && integer(value.rateToman, 10001) && ["WALLEX", "FALLBACK", "DEFAULT"].includes(String(value.source))
    && value.symbol === "USDTTMN" && ["FRESH", "STALE", "FALLBACK", "DEFAULT"].includes(String(value.status))
    && typeof value.stale === "boolean" && ["fetchedAt", "lastAttemptAt", "lastSuccessAt"].every((key) => date(value[key]))
    && (value.lastErrorCode === null || typeof value.lastErrorCode === "string") && integer(value.staleAfterSeconds, 120, 86400);
}
export function pricingQuoteResponse(value: unknown): { pricing: PricingQuote } {
  if (!record(value) || !record(value.pricing)) return invalid();
  const p = value.pricing;
  if (!["TOMAN", "USD"].includes(String(p.priceCurrency)) || typeof p.basePrice !== "string" || typeof p.profitValue !== "string"
    || !["TOMAN", "USD", "PERCENT"].includes(String(p.profitType)) || !integer(p.quantity, 1, 10) || !rate(p.exchangeRate)
    || !["baseToman", "profitToman", "unitPrice", "totalAmount", "totalProfit"].every((key) => integer(p[key]))) return invalid();
  return value as { pricing: PricingQuote };
}
export function pricingStatusResponse(value: unknown): PricingStatus {
  if (!record(value) || !rate(value.exchangeRate) || !Array.isArray(value.jobs)) return invalid();
  for (const job of value.jobs) if (!record(job) || typeof job.name !== "string" || typeof job.nextRunAt !== "string" || !date(job.nextRunAt)
    || !["leaseExpiresAt", "lastStartedAt", "lastFinishedAt", "lastSuccessAt"].every((key) => date(job[key]))
    || !(job.lastErrorCode === null || typeof job.lastErrorCode === "string") || !integer(job.runCount) || !integer(job.failureCount)) return invalid();
  return value as PricingStatus;
}
export function pricingSettingsResponse(value: unknown): { settings: PricingSettings } {
  if (!record(value) || !record(value.settings)) return invalid();
  const s = value.settings;
  if (s.id !== "default" || !integer(s.fallbackRateToman, 10001) || !integer(s.staleAfterSeconds, 120, 86400) || !integer(s.alertCooldownSeconds, 120, 86400)) return invalid();
  return value as { settings: PricingSettings };
}
