import { z } from "zod";
import { MAX_TOMAN } from "../pricing/calculator.js";
import { safeWallexErrorCode, WallexError } from "./wallex-client.js";

export const DEFAULT_RATE_TOMAN = 270000;
export const pricingSettingsSchema = z.object({
  fallbackRateToman: z.number().int().min(10001).max(MAX_TOMAN).optional(),
  staleAfterSeconds: z.number().int().min(120).max(86400).optional(),
  alertCooldownSeconds: z.number().int().min(120).max(86400).optional(),
}).strict();
export async function getPricingSettings(prisma) {
  return await prisma.pricingSettings.findUnique({ where: { id: "default" } }) ?? {
    id: "default", fallbackRateToman: DEFAULT_RATE_TOMAN, staleAfterSeconds: 300, alertCooldownSeconds: 1800,
  };
}
export function updatePricingSettings(prisma, input) {
  const data = pricingSettingsSchema.parse(input);
  return prisma.pricingSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
}
export async function getEffectiveRate(prisma, { now = new Date() } = {}) {
  const [settings, latest, state] = await Promise.all([
    getPricingSettings(prisma),
    prisma.exchangeRate.findFirst({ where: { source: "WALLEX", symbol: "USDTTMN", rateToman: { gt: 10000, lte: MAX_TOMAN } }, orderBy: [{ fetchedAt: "desc" }, { id: "desc" }] }),
    prisma.exchangeRateSyncState.findUnique({ where: { id: "USD_TOMAN" } }),
  ]);
  const fallbackValid = Number.isInteger(settings.fallbackRateToman) && settings.fallbackRateToman > 10000 && settings.fallbackRateToman <= MAX_TOMAN;
  const stale = !latest || now.getTime() - latest.fetchedAt.getTime() >= settings.staleAfterSeconds * 1000;
  return {
    rateToman: latest?.rateToman ?? (fallbackValid ? settings.fallbackRateToman : DEFAULT_RATE_TOMAN),
    source: latest?.source ?? (settings.createdAt && fallbackValid ? "FALLBACK" : "DEFAULT"),
    symbol: "USDTTMN", status: latest ? stale ? "STALE" : "FRESH" : settings.createdAt && fallbackValid ? "FALLBACK" : "DEFAULT",
    stale, fetchedAt: latest?.fetchedAt ?? null,
    lastAttemptAt: state?.lastAttemptAt ?? null,
    lastSuccessAt: state?.lastSuccessAt ?? latest?.fetchedAt ?? null,
    lastErrorCode: state?.lastErrorCode ?? null,
    staleAfterSeconds: settings.staleAfterSeconds,
  };
}
// Network I/O is outside transactions. A scheduler can inject a fenced transaction
// so a crashed/expired owner cannot commit a late provider response.
export async function synchronizeRate(prisma, client, { now = () => new Date(), signal, transaction = (fn) => prisma.$transaction(fn) } = {}) {
  const startedAt = now();
  await transaction((tx) => tx.exchangeRateSyncState.upsert({ where: { id: "USD_TOMAN" }, create: { id: "USD_TOMAN", lastAttemptAt: startedAt }, update: { lastAttemptAt: startedAt } }));
  let result;
  try {
    result = await client.fetchRate({ signal });
    if (result.source !== "WALLEX" || result.symbol !== "USDTTMN" || !Number.isInteger(result.rateToman) || result.rateToman <= 10000 || result.rateToman > MAX_TOMAN) throw new WallexError("WALLEX_INVALID_RESPONSE");
  } catch (error) {
    const errorCode = safeWallexErrorCode(error);
    await transaction((tx) => tx.exchangeRateSyncState.update({ where: { id: "USD_TOMAN" }, data: { lastErrorCode: errorCode } }));
    return { ok: false, errorCode };
  }
  const fetchedAt = now();
  await transaction(async (tx) => {
    const rate = await tx.exchangeRate.create({ data: { ...result, fetchedAt } });
    await tx.exchangeRateSyncState.update({ where: { id: "USD_TOMAN" }, data: { lastSuccessAt: fetchedAt, lastErrorCode: null } });
    // Thirty days of samples; always retain the just-persisted last good rate.
    await tx.exchangeRate.deleteMany({ where: { id: { not: rate.id }, fetchedAt: { lt: new Date(fetchedAt.getTime() - 30 * 86400000) } } });
  });
  return { ok: true, ...result, fetchedAt };
}
