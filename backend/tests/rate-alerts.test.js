import { beforeEach, afterAll, describe, it, expect } from "vitest";
import { createTestDatabase } from "./helpers/database.js";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "pricing-alerts-test-key-not-production";
const db = createTestDatabase("rate-alerts");
afterAll(() => db.close());
beforeEach(async () => {
  await db.prisma.exchangeRate.deleteMany(); await db.prisma.exchangeRateSyncState.deleteMany();
  await db.prisma.telegramQueueJob.deleteMany(); await db.prisma.telegramSettings.deleteMany();
});
describe("exchange-rate Telegram incidents", () => {
  it("alerts after startup grace when the rate job has never recorded an attempt", async () => {
    const { checkRateHealth } = await import("../src/modules/exchange-rates/alerts.js");
    const { updateTelegramSettings } = await import("../src/modules/telegram/settings.js");
    await updateTelegramSettings(db.prisma, { enabled: true, destinationChatId: "123456789", botToken: "123456789:startup_grace_fixture_only_abcdef" });
    const at = new Date("2026-10-08T08:00:00Z");
    for (const elapsed of [0, 299000]) {
      await db.prisma.$transaction((tx) => checkRateHealth(tx, { now: new Date(at.getTime() + elapsed) }));
      expect(await db.prisma.telegramQueueJob.count()).toBe(0);
    }
    await db.prisma.$transaction((tx) => checkRateHealth(tx, { now: new Date(at.getTime() + 300000) }));
    expect(await db.prisma.telegramQueueJob.count()).toBe(1);
    await db.prisma.$transaction((tx) => checkRateHealth(tx, { now: new Date(at.getTime() + 420000) }));
    expect(await db.prisma.telegramQueueJob.count()).toBe(1);
    expect(await db.prisma.exchangeRateSyncState.findUnique({ where: { id: "USD_TOMAN" } })).toMatchObject({ lastAttemptAt: null });
  });
  it("deduplicates persistent failures across restarts and queues one recovery", async () => {
    const { checkRateHealth } = await import("../src/modules/exchange-rates/alerts.js");
    const { updateTelegramSettings } = await import("../src/modules/telegram/settings.js");
    const { synchronizeRate } = await import("../src/modules/exchange-rates/service.js");
    await updateTelegramSettings(db.prisma, { enabled: true, destinationChatId: "123456789", botToken: "123456789:rate_alert_fixture_only_abcdef" });
    const at = new Date("2026-10-08T08:00:00Z");
    const failed = { fetchRate: async () => { throw new Error("offline"); } };
    await synchronizeRate(db.prisma, failed, { now: () => at });
    await db.prisma.$transaction((tx) => checkRateHealth(tx, { now: at, errorCode: "WALLEX_REQUEST_FAILED" }));
    await db.prisma.$transaction((tx) => checkRateHealth(tx, { now: new Date(at.getTime() + 120000), errorCode: "WALLEX_REQUEST_FAILED" }));
    expect(await db.prisma.telegramQueueJob.count()).toBe(1);
    await synchronizeRate(db.prisma, { fetchRate: async () => ({ rateToman: 270000, source: "WALLEX", symbol: "USDTTMN" }) }, { now: () => new Date(at.getTime() + 240000) });
    await db.prisma.$transaction((tx) => checkRateHealth(tx, { now: new Date(at.getTime() + 240000) }));
    expect((await db.prisma.telegramQueueJob.findMany()).map((j) => j.eventType).sort()).toEqual(["EXCHANGE_RATE_RECOVERED", "EXCHANGE_RATE_STALE"]);
    expect(await db.prisma.exchangeRateSyncState.findUnique({ where: { id: "USD_TOMAN" } })).toMatchObject({ incidentId: null });
  });
  it("detects a stopped sync job by rate age, sends cooldown reminders and honors the category toggle", async () => {
    const { checkRateHealth } = await import("../src/modules/exchange-rates/alerts.js");
    const { updateTelegramSettings } = await import("../src/modules/telegram/settings.js");
    const { processTelegramQueueBatch } = await import("../src/modules/telegram/queue.js");
    await updateTelegramSettings(db.prisma, { enabled: true, destinationChatId: "123456789", botToken: "123456789:rate_alert_fixture_only_abcdef" });
    const at = new Date("2026-10-08T08:00:00Z");
    await db.prisma.exchangeRate.create({ data: { rateToman: 270000, fetchedAt: new Date(at.getTime() - 600000) } });
    await db.prisma.$transaction((tx) => checkRateHealth(tx, { now: at }));
    await db.prisma.$transaction((tx) => checkRateHealth(tx, { now: new Date(at.getTime() + 120000) }));
    expect(await db.prisma.telegramQueueJob.count()).toBe(1);
    await db.prisma.$transaction((tx) => checkRateHealth(tx, { now: new Date(at.getTime() + 1800000) }));
    expect(await db.prisma.telegramQueueJob.count()).toBe(2);
    const transport = { fetchImpl: async () => new Response(JSON.stringify({ ok: true, result: { message_id: 42 } })) };
    const delivered = await processTelegramQueueBatch(db.prisma, transport);
    const next = await processTelegramQueueBatch(db.prisma, transport);
    expect(delivered.sent + next.sent).toBe(2);
    await updateTelegramSettings(db.prisma, { exchangeRateEventsEnabled: false });
    await db.prisma.$transaction((tx) => checkRateHealth(tx, { now: new Date(at.getTime() + 3600000) }));
    expect(await db.prisma.telegramQueueJob.count()).toBe(2);
  });
});
