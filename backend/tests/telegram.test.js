import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "telegram-regression-test-secret-only";
process.env.TELEGRAM_CONFIG_ENCRYPTION_KEY = "telegram-test-encryption-key-only";
const directory = mkdtempSync(resolve(tmpdir(), "wikiacc-telegram-"));
const backendDir = fileURLToPath(new URL("..", import.meta.url));
process.env.DATABASE_URL = `file:${resolve(directory, "test.db")}`;
execFileSync(process.execPath, [resolve(backendDir, "scripts/apply-schema.js")], { cwd: backendDir, env: process.env });
const { buildApp } = await import("../src/app.js");
const { updateTelegramSettings, getTelegramSettings, configurationFingerprint } = await import("../src/modules/telegram/settings.js");
const { enqueueTelegramEvent } = await import("../src/modules/telegram/events.js");
const { processTelegramQueueBatch } = await import("../src/modules/telegram/queue.js");
const { validateTelegramBaseUrl, sendTelegramMessage } = await import("../src/modules/telegram/client.js");
const { createOrder, submitOrderFieldValues } = await import("../src/modules/orders/service.js");
const { createTicket, addTicketMessage } = await import("../src/modules/tickets/service.js");
const { initiateJibitPayment, verifyJibitPayment, reconcileStaleJibitPayments } = await import("../src/modules/payments/service.js");
const { updateAdminShareboxSettings } = await import("../src/modules/sharebox/settings.js");
const { runShareboxFulfillmentBatch } = await import("../src/modules/sharebox/fulfillment.js");
const { ShareboxApiError } = await import("../src/modules/sharebox/client.js");
const TOKEN = "123456789:TEST_TOKEN_ONLY_abcdefghijklmnopqrstuvwxyz";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const success = () => json({ ok: true, result: { message_id: 123 } });
const event = (key = "test") => ({ category: "ORDER", eventType: "ORDER_PAID", key, text: "Test notification", referenceType: "ORDER", referenceId: "test-order" });
let app, user, admin, cookie, userCookie, product, sequence = 0;
const fetchImpl = vi.fn(async (url) => url.endsWith("getMe") ? json({ ok: true, result: { id: 123456789, is_bot: true } }) : success());
const purchases = new Map();
const jibitClient = {
  createPurchase: vi.fn(async (input) => {
    const purchaseId = String(++sequence);
    purchases.set(purchaseId, { ...input, purchaseId, status: "PENDING" });
    return { purchaseId, redirectUrl: `https://pay.example.com/${purchaseId}` };
  }),
  verifyPurchase: vi.fn(async (id) => ({ status: purchases.get(id).status })),
  getPurchase: vi.fn(async (id) => purchases.get(id)),
};
async function configure(values = {}) {
  return updateTelegramSettings(app.prisma, { enabled: true, baseUrl: "https://tg.example.com/telegram", botToken: TOKEN, destinationChatId: "123456789", ...values });
}
async function directOrder() {
  const result = await initiateJibitPayment(app.prisma, user.id, { productId: product.id }, {
    client: jibitClient, callbackBaseUrl: "https://shop.example.com/api/v1/payments/jibit/callback",
  });
  return app.prisma.paymentAttempt.findUnique({ where: { id: result.payment.attemptId } });
}

beforeAll(async () => {
  app = await buildApp({ logger: false, enableJibitReconciliation: false, telegramFetch: fetchImpl });
  user = await app.prisma.user.create({ data: { name: "Customer", email: "telegram-user@test.local", wallet: { create: { balance: 100000 } } } });
  admin = await app.prisma.user.create({ data: { name: "Admin", role: "ADMIN", email: "telegram-admin@test.local" } });
  cookie = `wikiacc_session=${app.jwt.sign({ id: admin.id, role: "ADMIN" })}`;
  userCookie = `wikiacc_session=${app.jwt.sign({ id: user.id, role: "USER" })}`;
  product = await app.prisma.product.create({ data: { title: "Test product", slug: "telegram-product", type: "CUSTOM_FORM", price: 100 } });
});
afterAll(async () => { await app?.close(); rmSync(directory, { recursive: true, force: true }); });
beforeEach(async () => {
  await app.prisma.telegramQueueJob.deleteMany();
  await app.prisma.telegramSettings.deleteMany();
  await app.prisma.paymentAttempt.updateMany({ where: { status: { in: ["CREATED", "PENDING", "REVIEW_REQUIRED"] } }, data: { status: "EXPIRED" } });
  fetchImpl.mockClear();
});

describe.sequential("Telegram settings and API", () => {
  it("defaults OFF and does not queue or send events", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/admin/telegram/settings", headers: { cookie } });
    expect(response.json().data.settings).toMatchObject({ enabled: false, hasBotToken: false, destinationChatId: null });
    await enqueueTelegramEvent(app.prisma, event());
    expect(await app.prisma.telegramQueueJob.count()).toBe(0);
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl })).claimed).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("guards every settings, queue, test and retry route", async () => {
    for (const [method, path, payload] of [["GET", "settings"], ["PATCH", "settings", { enabled: false }], ["GET", "jobs"], ["POST", "test", { mode: "message" }], ["POST", "jobs/missing/retry", { useCurrentConfiguration: true }]]) {
      expect((await app.inject({ method, url: `/api/v1/admin/telegram/${path}`, payload })).statusCode).toBe(401);
      expect((await app.inject({ method, url: `/api/v1/admin/telegram/${path}`, payload, headers: { cookie: userCookie } })).statusCode).toBe(403);
    }
  });
  it("encrypts token, never returns it, preserves it when omitted and accepts signed numeric IDs", async () => {
    const response = await app.inject({ method: "PATCH", url: "/api/v1/admin/telegram/settings", headers: { cookie }, payload: { enabled: true, botToken: TOKEN, destinationChatId: "-1001234567890", baseUrl: "https://tg.example.com/prefix/" } });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain(TOKEN);
    expect(response.json().data.settings).toMatchObject({ hasBotToken: true, baseUrl: "https://tg.example.com/prefix" });
    const stored = await getTelegramSettings(app.prisma);
    expect(stored.botTokenEncrypted).not.toContain(TOKEN);
    await updateTelegramSettings(app.prisma, { enabled: false });
    expect((await getTelegramSettings(app.prisma)).botTokenEncrypted).toBe(stored.botTokenEncrypted);
    const read = await app.inject({ method: "GET", url: "/api/v1/admin/telegram/settings", headers: { cookie } });
    expect(read.body).not.toContain(stored.botTokenEncrypted);
    expect(read.headers["cache-control"]).toBe("no-store");
  });
  it("validates configuration and refuses enabling incomplete settings", async () => {
    await expect(updateTelegramSettings(app.prisma, { enabled: true })).rejects.toMatchObject({ code: "TELEGRAM_CONFIG_REQUIRED" });
    for (const destinationChatId of ["@admin", "1e9", " 123", "0", "9007199254740992"]) {
      const response = await app.inject({ method: "PATCH", url: "/api/v1/admin/telegram/settings", headers: { cookie }, payload: { destinationChatId } });
      expect(response.statusCode).toBe(400);
    }
  });
  it("tests stored settings even while disabled without enabling automatic sends", async () => {
    await configure({ enabled: false });
    for (const mode of ["connection", "message"]) {
      const response = await app.inject({ method: "POST", url: "/api/v1/admin/telegram/test", headers: { cookie }, payload: { mode } });
      expect(response.statusCode).toBe(200);
    }
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((await getTelegramSettings(app.prisma)).enabled).toBe(false);
  });
});

describe.sequential("Telegram transport and durable queue", () => {
  it("preserves endpoint path, token syntax, destination and safe plain-text payload", async () => {
    const fetch = vi.fn(async () => success());
    await sendTelegramMessage({ baseUrl: "https://tg.example.com/telegram/", botToken: TOKEN, chatId: "-1001234567890", text: "<literal>", buttonUrl: "https://shop.example.com/admin/orders/123" }, { fetchImpl: fetch });
    expect(fetch.mock.calls[0][0]).toBe(`https://tg.example.com/telegram/bot${TOKEN}/sendMessage`);
    const options = fetch.mock.calls[0][1];
    expect(options.redirect).toBe("error");
    expect(JSON.parse(options.body)).toMatchObject({ chat_id: "-1001234567890", text: "<literal>", reply_markup: { inline_keyboard: [[{ text: "مشاهده در پنل", url: "https://shop.example.com/admin/orders/123" }]] } });
    expect(JSON.parse(options.body).parse_mode).toBeUndefined();
  });
  it("rejects unsafe endpoints and masks transport/upstream errors", async () => {
    for (const url of ["http://tg.example.com", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://[::ffff:127.0.0.1]", "https://169.254.169.254", "https://metadata.google.internal", "https://user:pass@tg.example.com", "https://tg.example.com?q=token", "https://tg.example.com/#token"]) {
      expect(() => validateTelegramBaseUrl(url)).toThrow();
    }
    await expect(sendTelegramMessage({ baseUrl: "https://tg.example.com", botToken: TOKEN, chatId: "1", text: "x" }, { fetchImpl: async () => { throw new Error(`secret ${TOKEN}`); } })).rejects.toMatchObject({ code: "TELEGRAM_REQUEST_FAILED", message: "Telegram request failed" });
  });
  it("deduplicates persisted events and never re-sends SENT jobs", async () => {
    await configure();
    await enqueueTelegramEvent(app.prisma, event());
    await enqueueTelegramEvent(app.prisma, event());
    expect(await app.prisma.telegramQueueJob.count()).toBe(1);
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl })).sent).toBe(1);
    await processTelegramQueueBatch(app.prisma, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const job = await app.prisma.telegramQueueJob.findFirst();
    expect(job).toMatchObject({ status: "SENT", attempts: 1, providerMessageId: "123", leaseToken: null });
    const response = await app.inject({ method: "POST", url: `/api/v1/admin/telegram/jobs/${job.id}/retry`, headers: { cookie }, payload: { useCurrentConfiguration: true } });
    expect(response.statusCode).toBe(409);
  });
  it("pauses disabled categories and resumes only pending messages", async () => {
    await configure();
    await enqueueTelegramEvent(app.prisma, event());
    await updateTelegramSettings(app.prisma, { enabled: false });
    await processTelegramQueueBatch(app.prisma, { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    await updateTelegramSettings(app.prisma, { enabled: true, orderEventsEnabled: false });
    await processTelegramQueueBatch(app.prisma, { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    await updateTelegramSettings(app.prisma, { orderEventsEnabled: true });
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl })).sent).toBe(1);
  });
  it("persists 429 cooldown including new messages and retries after the deadline", async () => {
    await configure();
    await enqueueTelegramEvent(app.prisma, event());
    const now = new Date();
    const limited = vi.fn(async () => json({ ok: false, error_code: 429, description: `unsafe ${TOKEN}`, parameters: { retry_after: 120 } }, 429));
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl: limited, now })).retried).toBe(1);
    const job = await app.prisma.telegramQueueJob.findFirst();
    expect(job.lastErrorCode).toBe("TELEGRAM_RATE_LIMITED");
    expect(job.availableAt.getTime()).toBe(now.getTime() + 120000);
    await enqueueTelegramEvent(app.prisma, event("new"));
    await processTelegramQueueBatch(app.prisma, { fetchImpl, now: new Date(now.getTime() + 1000) });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl, now: new Date(now.getTime() + 121000) })).sent).toBe(1);
  });
  it("clears cooldown when retargeting and ignores an old in-flight 429", async () => {
    await configure();
    await enqueueTelegramEvent(app.prisma, event());
    await processTelegramQueueBatch(app.prisma, { fetchImpl: async () => json({ ok: false, error_code: 429, parameters: { retry_after: 3600 } }, 429) });
    await updateTelegramSettings(app.prisma, { destinationChatId: "222222222" });
    expect((await getTelegramSettings(app.prisma)).cooldownUntil).toBeNull();
    await enqueueTelegramEvent(app.prisma, event("new-config"));
    const switchDuringSend = async () => {
      await updateTelegramSettings(app.prisma, { destinationChatId: "333333333" });
      return json({ ok: false, error_code: 429, parameters: { retry_after: 3600 } }, 429);
    };
    await processTelegramQueueBatch(app.prisma, { fetchImpl: switchDuringSend });
    expect((await getTelegramSettings(app.prisma)).cooldownUntil).toBeNull();
    await enqueueTelegramEvent(app.prisma, event("third-config"));
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl })).sent).toBe(1);
  });
  it("records terminal errors and supports explicit failed-only replay", async () => {
    await configure();
    await enqueueTelegramEvent(app.prisma, event());
    await processTelegramQueueBatch(app.prisma, { fetchImpl: async () => json({ ok: false, error_code: 403, description: TOKEN }, 403) });
    const job = await app.prisma.telegramQueueJob.findFirst();
    expect(job).toMatchObject({ status: "FAILED", lastErrorCode: "TELEGRAM_HTTP_403" });
    expect(JSON.stringify(job)).not.toContain(TOKEN);
    const response = await app.inject({ method: "POST", url: `/api/v1/admin/telegram/jobs/${job.id}/retry`, headers: { cookie }, payload: { useCurrentConfiguration: true } });
    expect(response.statusCode).toBe(200);
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl })).sent).toBe(1);
  });
  it("requires explicit replay before sending old data to a changed destination", async () => {
    await configure();
    await enqueueTelegramEvent(app.prisma, event());
    await updateTelegramSettings(app.prisma, { destinationChatId: "987654321" });
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl })).failed).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await app.prisma.telegramQueueJob.findFirst()).lastErrorCode).toBe("TELEGRAM_CONFIGURATION_CHANGED");
  });
  it("recovers expired leases and fences stale completion", async () => {
    await configure();
    const job = await enqueueTelegramEvent(app.prisma, event());
    await app.prisma.telegramQueueJob.update({ where: { id: job.id }, data: { status: "PROCESSING", leaseToken: "old", leaseExpiresAt: new Date(0) } });
    const fetch = async () => {
      await app.prisma.telegramQueueJob.update({ where: { id: job.id }, data: { leaseToken: "replacement-owner" } });
      return success();
    };
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl: fetch })).sent).toBe(0);
    expect((await app.prisma.telegramQueueJob.findUnique({ where: { id: job.id } })).leaseToken).toBe("replacement-owner");
  });
  it("bounds response bodies and request timeouts", async () => {
    const credentials = { baseUrl: "https://tg.example.com", botToken: TOKEN, chatId: "1", text: "x" };
    await expect(sendTelegramMessage(credentials, { fetchImpl: async () => new Response("x".repeat(70000)) })).rejects.toMatchObject({ code: "TELEGRAM_INVALID_RESPONSE" });
    await expect(sendTelegramMessage(credentials, { timeoutMs: 10, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }) })).rejects.toMatchObject({ code: "TELEGRAM_TIMEOUT" });
  });
  it("backs off temporary errors and exhausts bounded retries", async () => {
    await configure();
    const job = await enqueueTelegramEvent(app.prisma, event());
    const now = new Date();
    const unavailable = async () => json({ ok: false, error_code: 503 }, 503);
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl: unavailable, now })).retried).toBe(1);
    expect((await app.prisma.telegramQueueJob.findFirst()).availableAt.getTime()).toBe(now.getTime() + 15000);
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl, now })).claimed).toBe(0);
    await app.prisma.telegramQueueJob.update({ where: { id: job.id }, data: { attempts: 7, availableAt: new Date(0) } });
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl: unavailable })).failed).toBe(1);
    expect((await app.prisma.telegramQueueJob.findFirst()).attempts).toBe(8);
  });
  it("does not send one claimed job twice across concurrent processors", async () => {
    await configure();
    await enqueueTelegramEvent(app.prisma, event());
    const fetch = vi.fn(async () => { await new Promise((done) => setTimeout(done, 10)); return success(); });
    await Promise.all([processTelegramQueueBatch(app.prisma, { fetchImpl: fetch }), processTelegramQueueBatch(app.prisma, { fetchImpl: fetch })]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await app.prisma.telegramQueueJob.findFirst()).status).toBe("SENT");
  });
  it("resumes an expired persisted lease after restart", async () => {
    await configure();
    const job = await enqueueTelegramEvent(app.prisma, event());
    await app.prisma.telegramQueueJob.update({ where: { id: job.id }, data: { status: "PROCESSING", attempts: 1, leaseToken: "crashed-worker", leaseExpiresAt: new Date(0) } });
    expect((await processTelegramQueueBatch(app.prisma, { fetchImpl })).sent).toBe(1);
    expect((await app.prisma.telegramQueueJob.findFirst()).attempts).toBe(2);
  });
  it("keeps enqueue atomic with the business transaction", async () => {
    await configure();
    await expect(app.prisma.$transaction(async (tx) => { await enqueueTelegramEvent(tx, event()); throw new Error("rollback"); })).rejects.toThrow("rollback");
    expect(await app.prisma.telegramQueueJob.count()).toBe(0);
  });
});

describe.sequential("Telegram commerce and support hooks", () => {
  it("queues paid wallet orders and later admin delivery, with safe payloads", async () => {
    await configure();
    const order = await createOrder(app.prisma, user.id, { productId: product.id, note: "private-password" });
    const paid = await app.prisma.telegramQueueJob.findFirst();
    expect(paid).toMatchObject({ eventType: "ORDER_PAID", referenceId: order.id });
    expect(paid.messageText).toContain("Test product");
    expect(paid.messageText).not.toContain("private-password");
    expect(fetchImpl).not.toHaveBeenCalled();
    const response = await app.inject({ method: "PATCH", url: `/api/v1/admin/orders/${order.id}/status`, headers: { cookie }, payload: { status: "DELIVERED" } });
    expect(response.statusCode).toBe(200);
    expect(await app.prisma.telegramQueueJob.count({ where: { eventType: "ORDER_DELIVERED" } })).toBe(1);
  });
  it("combines instant paid and delivered into one message without delivery secrets", async () => {
    await configure();
    const pool = await app.prisma.deliveryPool.create({ data: { slug: "telegram-pool", title: "Pool", items: { create: { content: "SECRET_LICENSE" } } } });
    const instant = await app.prisma.product.create({ data: { slug: "telegram-instant", title: "Instant", price: 100, type: "INSTANT_DELIVERY", deliveryPoolId: pool.id } });
    const order = await createOrder(app.prisma, user.id, { productId: instant.id });
    expect(order.status).toBe("DELIVERED");
    const jobs = await app.prisma.telegramQueueJob.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].messageText).toContain("خرید و تحویل موفق");
    expect(jobs[0].messageText).not.toContain("SECRET_LICENSE");
  });
  it("queues new tickets and customer replies but not admin replies or private ticket text", async () => {
    await configure();
    const ticket = await createTicket(app.prisma, user.id, { subject: "private subject", body: "secret password", priority: "HIGH" });
    await addTicketMessage(app.prisma, user.id, ticket.id, { body: "another private token" });
    await addTicketMessage(app.prisma, admin.id, ticket.id, { body: "admin reply" }, true);
    const jobs = await app.prisma.telegramQueueJob.findMany();
    expect(jobs.map((job) => job.eventType).sort()).toEqual(["TICKET_CREATED", "TICKET_CUSTOMER_REPLY"]);
    expect(JSON.stringify(jobs)).not.toContain("secret password");
    expect(JSON.stringify(jobs)).not.toContain("private subject");
  });
  it("notifies when missing order fields become actionable", async () => {
    await configure();
    const custom = await app.prisma.product.create({ data: { title: "Fields", slug: "telegram-fields", type: "CUSTOM_FORM", price: 100,
      fields: { create: { key: "account", label: "Account", type: "TEXT", required: true } } } });
    const order = await createOrder(app.prisma, user.id, { productId: custom.id });
    expect(order.status).toBe("PENDING_INFO");
    await submitOrderFieldValues(app.prisma, user.id, order.id, { fieldValues: { account: "private-email" } });
    const job = await app.prisma.telegramQueueJob.findFirst({ where: { eventType: "ORDER_STATUS_CHANGED" } });
    expect(job.messageText).toContain("نیازمند اقدام ادمین");
    expect(job.messageText).not.toContain("private-email");
  });
  it("queues direct purchase only after verified payment and deduplicates callback replay", async () => {
    await configure();
    const attempt = await directOrder();
    expect(await app.prisma.telegramQueueJob.count()).toBe(0);
    purchases.get(attempt.providerPurchaseId).status = "SUCCESSFUL";
    await verifyJibitPayment(app.prisma, jibitClient, attempt);
    await verifyJibitPayment(app.prisma, jibitClient, attempt);
    const jobs = await app.prisma.telegramQueueJob.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ eventType: "ORDER_PAID", referenceId: attempt.orderId });
  });
  it("alerts mismatched payments without treating them as paid", async () => {
    await configure();
    const attempt = await directOrder();
    Object.assign(purchases.get(attempt.providerPurchaseId), { status: "SUCCESSFUL", amount: 99999 });
    expect((await verifyJibitPayment(app.prisma, jibitClient, attempt)).status).toBe("review");
    await verifyJibitPayment(app.prisma, jibitClient, attempt);
    const jobs = await app.prisma.telegramQueueJob.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].eventType).toBe("PAYMENT_REVIEW_REQUIRED");
  });
  it("alerts initiation/verification/reconciliation failures without secrets or polling spam", async () => {
    await configure();
    jibitClient.createPurchase.mockRejectedValueOnce(Object.assign(new Error(TOKEN), { code: "JIBIT_UNAVAILABLE" }));
    await expect(directOrder()).rejects.toThrow(TOKEN);
    const attempt = await directOrder();
    const broken = { ...jibitClient, getPurchase: async () => { throw Object.assign(new Error(TOKEN), { code: "JIBIT_UNAVAILABLE" }); } };
    for (let count = 0; count < 2; count++) await expect(verifyJibitPayment(app.prisma, broken, attempt)).rejects.toThrow(TOKEN);
    await app.prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { reconcileAfter: new Date(0) } });
    await reconcileStaleJibitPayments(app.prisma, broken);
    const jobs = await app.prisma.telegramQueueJob.findMany();
    expect(jobs.map((job) => job.eventType).sort()).toEqual(["PAYMENT_INITIATION_FAILED", "PAYMENT_RECONCILIATION_FAILED", "PAYMENT_VERIFICATION_FAILED"]);
    expect(JSON.stringify(jobs)).not.toContain(TOKEN);
  });
  it("alerts stale payment attempts that lost their provider purchase ID", async () => {
    await configure();
    const attempt = await directOrder();
    await app.prisma.paymentAttempt.update({ where: { id: attempt.id }, data: { providerPurchaseId: null, status: "CREATED", reconcileAfter: new Date(0) } });
    await reconcileStaleJibitPayments(app.prisma, jibitClient);
    await reconcileStaleJibitPayments(app.prisma, jibitClient);
    const jobs = await app.prisma.telegramQueueJob.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ eventType: "PAYMENT_RECONCILIATION_FAILED", referenceId: attempt.orderId });
    expect(jobs[0].messageText).toContain("JIBIT_PURCHASE_ID_MISSING");
  });
  it("alerts terminal ShareBox failures and later completion", async () => {
    await configure();
    await updateAdminShareboxSettings(app.prisma, { enabled: true, apiKey: "sbx_test_only" }, "https://sharebox.example.com");
    await app.prisma.user.update({ where: { id: user.id }, data: { phone: "09120000123" } });
    const sharebox = await app.prisma.product.create({ data: { slug: "telegram-sharebox", title: "ShareBox", type: "SHAREBOX", price: 100, shareboxCategoryId: "category-test", shareboxCategoryName: "Test" } });
    const order = await createOrder(app.prisma, user.id, { productId: sharebox.id }, { shareboxBaseUrl: "https://sharebox.example.com" });
    const client = { origin: "https://sharebox.example.com", issueLicense: async () => { throw new ShareboxApiError("secret upstream", { code: "API_KEY_INVALID" }); } };
    await runShareboxFulfillmentBatch(app.prisma, client);
    expect(await app.prisma.telegramQueueJob.count({ where: { eventType: "SHAREBOX_REVIEW_REQUIRED" } })).toBe(1);
    await app.prisma.shareboxFulfillment.updateMany({ where: { orderItem: { orderId: order.id } }, data: { status: "RETRY", nextAttemptAt: new Date(0) } });
    client.issueLicense = async (_key, body) => ({ license_key: "PRIVATE_LICENSE", license: { id: "receipt", category_id: body.category_id, reference: body.reference, label: `${body.customer_name} | ${body.customer_phone}`, issued_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString() } });
    await runShareboxFulfillmentBatch(app.prisma, client);
    expect(await app.prisma.telegramQueueJob.count({ where: { eventType: "ORDER_DELIVERED" } })).toBe(1);
    expect(JSON.stringify(await app.prisma.telegramQueueJob.findMany())).not.toContain("PRIVATE_LICENSE");
  });
});

describe.sequential("Additive migration", () => {
  it("upgrades an existing DB without changing domain rows and is repeatable", async () => {
    const userCount = await app.prisma.user.count();
    const orderCount = await app.prisma.order.count();
    await app.prisma.$executeRawUnsafe('DROP TABLE "TelegramQueueJob"');
    await app.prisma.$executeRawUnsafe('DROP TABLE "TelegramSettings"');
    const args = [resolve(backendDir, "scripts/apply-telegram-migration.js")];
    expect(() => execFileSync(process.execPath, args, { cwd: backendDir, env: { ...process.env, TELEGRAM_MIGRATION_OFFLINE_ACK: "0" }, stdio: "pipe" })).toThrow();
    for (let count = 0; count < 2; count++) {
      execFileSync(process.execPath, args, { cwd: backendDir, env: { ...process.env, TELEGRAM_MIGRATION_OFFLINE_ACK: "1" } });
    }
    expect(await app.prisma.user.count()).toBe(userCount);
    expect(await app.prisma.order.count()).toBe(orderCount);
    expect(await getTelegramSettings(app.prisma)).toBeNull();
    await configure({ enabled: false });
    expect(configurationFingerprint(await getTelegramSettings(app.prisma))).toMatch(/^[a-f0-9]{64}$/);
    await app.prisma.$executeRawUnsafe('DROP INDEX "TelegramQueueJob_dedupeKey_key"');
    expect(() => execFileSync(process.execPath, args, { cwd: backendDir, env: { ...process.env, TELEGRAM_MIGRATION_OFFLINE_ACK: "1" }, stdio: "pipe" })).toThrow();
  });
});
