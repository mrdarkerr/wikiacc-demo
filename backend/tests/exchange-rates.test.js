import { afterAll, beforeEach, describe, it, expect } from "vitest";
import { createTestDatabase } from "./helpers/database.js";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "pricing-test-secret-not-production";
const db = createTestDatabase("exchange-rates");
afterAll(() => db.close());
beforeEach(async () => {
  await db.prisma.exchangeRate.deleteMany();
  await db.prisma.exchangeRateSyncState.deleteMany();
  await db.prisma.pricingSettings.deleteMany();
});
describe("persisted exchange rates", () => {
  it("uses latest successful rate during outages before admin fallback and built-in default", async () => {
    const { getEffectiveRate, updatePricingSettings, synchronizeRate } = await import("../src/modules/exchange-rates/service.js");
    const now = new Date("2026-10-08T08:00:00Z");
    expect(await getEffectiveRate(db.prisma, { now })).toMatchObject({ rateToman: 270000, source: "DEFAULT", status: "DEFAULT" });
    await updatePricingSettings(db.prisma, { fallbackRateToman: 280000 });
    expect(await getEffectiveRate(db.prisma, { now })).toMatchObject({ rateToman: 280000, source: "FALLBACK", status: "FALLBACK" });
    await synchronizeRate(db.prisma, { fetchRate: async () => ({ rateToman: 266641, source: "WALLEX", symbol: "USDTTMN" }) }, { now: () => now });
    expect(await getEffectiveRate(db.prisma, { now })).toMatchObject({ rateToman: 266641, status: "FRESH", lastSuccessAt: now });
    const later = new Date(now.getTime() + 600000);
    await synchronizeRate(db.prisma, { fetchRate: async () => { throw new Error("offline"); } }, { now: () => later });
    expect(await getEffectiveRate(db.prisma, { now: later })).toMatchObject({ rateToman: 266641, status: "STALE", lastSuccessAt: now, lastAttemptAt: later, lastErrorCode: "WALLEX_REQUEST_FAILED" });
    expect(await db.prisma.exchangeRate.count()).toBe(1);
  });
  it("counts unchanged quotes as fresh successful fetches and retains a bounded history", async () => {
    const { synchronizeRate, getEffectiveRate } = await import("../src/modules/exchange-rates/service.js");
    let time = new Date("2026-09-01T00:00:00Z");
    const client = { fetchRate: async () => ({ rateToman: 270000, source: "WALLEX", symbol: "USDTTMN" }) };
    await synchronizeRate(db.prisma, client, { now: () => time });
    time = new Date("2026-10-08T08:00:00Z");
    await synchronizeRate(db.prisma, client, { now: () => time });
    expect(await getEffectiveRate(db.prisma, { now: time })).toMatchObject({ status: "FRESH", lastSuccessAt: time });
    expect(await db.prisma.exchangeRate.count()).toBe(1);
  });
  it("rejects invalid admin settings and invalid client rates", async () => {
    const { updatePricingSettings, synchronizeRate } = await import("../src/modules/exchange-rates/service.js");
    for (const input of [{ fallbackRateToman: 0 }, { fallbackRateToman: 270000.5 }, { staleAfterSeconds: 1 }, { alertCooldownSeconds: 0 }, { secret: true }]) expect(() => updatePricingSettings(db.prisma, input)).toThrow();
    expect(await synchronizeRate(db.prisma, { fetchRate: async () => ({ rateToman: -1, source: "WALLEX", symbol: "USDTTMN" }) })).toMatchObject({ ok: false, errorCode: "WALLEX_INVALID_RESPONSE" });
    expect(await db.prisma.exchangeRate.count()).toBe(0);
  });
});
