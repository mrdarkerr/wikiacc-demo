import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
const testDatabaseName = `sharebox-test-${process.pid}.db`;
process.env.DATABASE_URL = `file:./${testDatabaseName}`;
process.env.JWT_SECRET = "sharebox-test-secret-with-enough-length";
process.env.SMS_CONFIG_ENCRYPTION_KEY =
  "sharebox-test-encryption-secret-with-enough-length";
process.env.COOKIE_SECURE = "false";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(__dirname, "..");
const testDbPath = resolve(backendDir, "prisma", testDatabaseName);
if (existsSync(testDbPath)) unlinkSync(testDbPath);
execFileSync(process.execPath, [resolve(backendDir, "scripts", "apply-schema.js")], {
  cwd: backendDir,
  env: process.env,
  stdio: "inherit",
});

const { buildApp } = await import("../src/app.js");
const { ShareboxApiError, createShareboxClient } = await import(
  "../src/modules/sharebox/client.js"
);
const { customerOrderCode, runShareboxFulfillmentBatch } = await import(
  "../src/modules/sharebox/fulfillment.js"
);

const CATEGORY_ID = "836cabbe-413d-4c97-a00a-d2f66b36c354";
const OTHER_CATEGORY_ID = "c5be1af6-831c-4b20-8bef-bd12746cd8de";
const API_KEY = "sbx_sales_test-secret-value";

function receiptFor(body) {
  return {
    license_key: `license-${body.external_id}`,
    license: {
      id: randomUUID(),
      category_id: body.category_id,
      reference: body.reference,
      label: `${body.customer_name} | ${body.customer_phone}`,
      issued_at: "2026-09-21T12:15:00.000Z",
      expires_at: "2026-10-21T12:15:00.000Z",
    },
  };
}

describe.sequential("ShareBox integration", () => {
  let app;
  let adminCookie;
  const issued = [];
  const receipts = new Map();
  const timeoutOnce = new Set();
  const unsafeErrorOnce = new Set();
  const delayed = new Set();
  const purchases = new Map();
  let purchaseSequence = 0;
  let userSequence = 10;

  const shareboxClient = {
    origin: "https://sharebox.wikiacc.ir",
    listCategories: vi.fn(async (_key, { page = 1, perPage = 100 } = {}) => ({
      data:
        page === 1
          ? [
              {
                id: CATEGORY_ID,
                name: "Premium 30-day",
                description: "ShareBox premium access",
                validity_days: 30,
              },
              {
                id: OTHER_CATEGORY_ID,
                name: "Other category",
                description: null,
                validity_days: 60,
              },
            ]
          : [],
      meta: {
        page,
        page_size: perPage,
        total: 2,
        total_pages: 1,
      },
    })),
    issueLicense: vi.fn(async (_key, body) => {
      issued.push(structuredClone(body));
      if (delayed.has(body.external_id)) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 30));
      }
      let receipt = receipts.get(body.external_id);
      if (!receipt) {
        receipt = receiptFor(body);
        receipts.set(body.external_id, receipt);
      }
      if (timeoutOnce.delete(body.external_id)) {
        throw new ShareboxApiError("timeout after commit", {
          code: "SHAREBOX_TIMEOUT",
        });
      }
      if (unsafeErrorOnce.delete(body.external_id)) {
        throw new ShareboxApiError("unsafe upstream error", {
          code: `raw-key-${API_KEY}`,
        });
      }
      return receipt;
    }),
  };

  const jibitClient = {
    createPurchase: vi.fn(async (input) => {
      const purchaseId = String(++purchaseSequence);
      purchases.set(purchaseId, {
        ...input,
        purchaseId,
        purchaseIdStr: purchaseId,
        status: "PENDING",
      });
      return {
        purchaseId,
        redirectUrl: `https://napi.jibit.ir/ppg/v3/purchases/${purchaseId}/payments`,
      };
    }),
    verifyPurchase: vi.fn(async (purchaseId) => ({
      status: purchases.get(String(purchaseId)).status,
    })),
    getPurchase: vi.fn(async (purchaseId) => purchases.get(String(purchaseId))),
  };

  beforeAll(async () => {
    app = await buildApp({
      logger: false,
      enableJibitReconciliation: false,
      jibitCallbackUrl: "http://localhost:4001/api/v1/payments/jibit/callback",
      jibitClient,
      shareboxClient,
      shareboxWorkerOptions: { enabled: false },
      webAppUrl: "http://localhost:3000",
    });
    const admin = await app.prisma.user.create({
      data: { name: "Admin", role: "ADMIN", email: "sharebox-admin@test.local" },
    });
    adminCookie = `wikiacc_session=${app.jwt.sign({
      id: admin.id,
      role: "ADMIN",
    })}`;
  });

  afterAll(async () => {
    await app.close();
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
  });

  async function createUser(suffix, { balance = 10_000, phone } = {}) {
    const resolvedPhone =
      phone === null ? null : phone ?? `09120000${String(userSequence++).padStart(3, "0")}`;
    const user = await app.prisma.user.create({
      data: {
        name: `Customer ${suffix}`,
        phone: resolvedPhone,
        wallet: { create: { balance } },
      },
    });
    return {
      ...user,
      cookie: `wikiacc_session=${app.jwt.sign({ id: user.id, role: "USER" })}`,
    };
  }

  async function createProduct(suffix, categoryId = CATEGORY_ID) {
    return app.prisma.product.create({
      data: {
        slug: `sharebox-${suffix}`,
        title: `ShareBox ${suffix}`,
        type: "SHAREBOX",
        price: 100,
        shareboxCategoryId: categoryId,
        shareboxCategoryName:
          categoryId === CATEGORY_ID ? "Premium 30-day" : "Other category",
      },
    });
  }

  async function configure(apiKey = API_KEY) {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/sharebox/settings",
      headers: { cookie: adminCookie },
      payload: { enabled: true, apiKey },
    });
    expect(response.statusCode).toBe(200);
    return response.json().data.settings;
  }

  it("protects settings/categories and resolves product category names server-side", async () => {
    const unauthenticated = await app.inject({
      method: "GET",
      url: "/api/v1/admin/sharebox/settings",
    });
    expect(unauthenticated.statusCode).toBe(401);

    const user = await createUser("auth");
    const forbidden = await app.inject({
      method: "GET",
      url: "/api/v1/admin/sharebox/settings",
      headers: { cookie: user.cookie },
    });
    expect(forbidden.statusCode).toBe(403);

    const settings = await configure();
    expect(settings).toMatchObject({
      enabled: true,
      hasApiKey: true,
      apiKeyHint: API_KEY.slice(-4),
      baseUrl: "https://sharebox.wikiacc.ir",
    });
    expect(JSON.stringify(settings)).not.toContain(API_KEY);

    const categories = await app.inject({
      method: "GET",
      url: "/api/v1/admin/sharebox/categories?page=1&perPage=100",
      headers: { cookie: adminCookie },
    });
    expect(categories.statusCode).toBe(200);
    expect(categories.headers["cache-control"]).toBe("no-store");
    const categoryBody = categories.json();
    expect(categoryBody.data.categories[0]).toMatchObject({
      id: CATEGORY_ID,
      name: "Premium 30-day",
    });
    expect(categoryBody.meta).toEqual({
      page: 1,
      perPage: 100,
      total: 2,
      totalPages: 1,
    });

    const productResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/products",
      headers: { cookie: adminCookie },
      payload: {
        slug: "sharebox-admin-created",
        title: "ShareBox admin created",
        type: "SHAREBOX",
        price: 250,
        shareboxCategoryId: CATEGORY_ID,
        shareboxCategoryName: "untrusted name",
      },
    });
    expect(productResponse.statusCode).toBe(201);
    expect(productResponse.json().data.product).toMatchObject({
      shareboxCategoryId: CATEGORY_ID,
      shareboxCategoryName: "Premium 30-day",
    });
  });

  it("creates immutable per-unit wallet jobs and delivers each unit once", async () => {
    const user = await createUser("wallet");
    const product = await createProduct("wallet");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: product.id, quantity: 2, paymentMethod: "WALLET" },
    });
    expect(response.statusCode).toBe(201);
    const order = response.json().data.order;
    expect(order.status).toBe("READY");
    expect(order.items[0].shareboxFulfillments).toHaveLength(2);
    expect(order.items[0].shareboxFulfillments[0]).toEqual(
      expect.objectContaining({ unitIndex: 1, status: "PENDING", attempts: 0 }),
    );
    expect(order.items[0].shareboxFulfillments[0]).not.toHaveProperty("externalId");
    expect(order.items[0].shareboxFulfillments[0]).not.toHaveProperty("customerPhone");
    expect(order.items[0].shareboxFulfillments[0]).not.toHaveProperty(
      "apiKeyFingerprint",
    );

    await app.prisma.product.update({
      where: { id: product.id },
      data: {
        shareboxCategoryId: OTHER_CATEGORY_ID,
        shareboxCategoryName: "Other category",
      },
    });
    await app.prisma.user.update({
      where: { id: user.id },
      data: { name: "Changed name", phone: "09129999999" },
    });

    const before = issued.length;
    const run = await runShareboxFulfillmentBatch(app.prisma, shareboxClient, {
      batchSize: 10,
    });
    expect(run).toMatchObject({ claimed: 2, delivered: 2 });
    const calls = issued.slice(before);
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.external_id)).toHaveLength(2);
    expect(new Set(calls.map((call) => call.external_id)).size).toBe(2);
    for (const call of calls) {
      expect(call).toMatchObject({
        category_id: CATEGORY_ID,
        reference: customerOrderCode(order.id),
        customer_name: "Customer wallet",
        customer_phone: user.phone,
      });
    }

    const stored = await app.prisma.order.findUnique({
      where: { id: order.id },
      include: { items: { include: { deliveries: true, shareboxFulfillments: true } } },
    });
    expect(stored.status).toBe("DELIVERED");
    expect(stored.items[0].deliveries).toHaveLength(2);
    expect(stored.items[0].shareboxFulfillments.every((job) => job.status === "DELIVERED")).toBe(true);
    expect(stored.items[0].deliveries[0].deliveryItemId).toBeNull();
    expect(stored.items[0].deliveries[0].contentSnapshot).toContain("ShareBox license:");
    const publicResponse = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${order.id}`,
      headers: { cookie: user.cookie },
    });
    expect(publicResponse.statusCode).toBe(200);
    const publicItem = publicResponse.json().data.order.items[0];
    for (const delivery of publicItem.deliveries) {
      const receipt = publicItem.shareboxFulfillments.find((job) => job.id === delivery.shareboxFulfillmentId);
      expect(receipt.receiptIssuedAt).toEqual(expect.any(String));
      expect(receipt.receiptExpiresAt).toEqual(expect.any(String));
      expect(Date.parse(receipt.receiptExpiresAt)).toBeGreaterThan(Date.parse(receipt.receiptIssuedAt));
      expect(receipt).not.toHaveProperty("apiKeyFingerprint");
    }
    expect(
      await app.prisma.smsQueueJob.count({
        where: { dedupeKey: `ORDER_COMPLETED:USER:${order.id}` },
      }),
    ).toBe(1);

    await runShareboxFulfillmentBatch(app.prisma, shareboxClient, { batchSize: 10 });
    expect(
      await app.prisma.orderDelivery.count({
        where: { orderItem: { orderId: order.id } },
      }),
    ).toBe(2);
  });

  it("keeps unpaid/failed Jibit orders ineligible and fulfills only after verification", async () => {
    const user = await createUser("jibit");
    const product = await createProduct("jibit");
    const pendingResponse = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: product.id, quantity: 2, paymentMethod: "JIBIT" },
    });
    expect(pendingResponse.statusCode).toBe(201);
    const pendingOrder = pendingResponse.json().data.order;
    expect(pendingOrder.paymentStatus).toBe("UNPAID");
    expect(
      (await runShareboxFulfillmentBatch(app.prisma, shareboxClient)).claimed,
    ).toBe(0);

    const attempt = await app.prisma.paymentAttempt.findFirst({
      where: { orderId: pendingOrder.id },
    });
    purchases.get(attempt.providerPurchaseId).status = "SUCCESSFUL";
    const verify = await app.inject({
      method: "POST",
      url: `/api/v1/payments/jibit/orders/${pendingOrder.id}/verify`,
      headers: { cookie: user.cookie },
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().data.payment.status).toBe("successful");
    expect(
      (await runShareboxFulfillmentBatch(app.prisma, shareboxClient)).delivered,
    ).toBe(2);

    const failedProduct = await createProduct("jibit-failed");
    const failedResponse = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: failedProduct.id, paymentMethod: "JIBIT" },
    });
    const failedOrder = failedResponse.json().data.order;
    const failedAttempt = await app.prisma.paymentAttempt.findFirst({
      where: { orderId: failedOrder.id },
    });
    purchases.get(failedAttempt.providerPurchaseId).status = "FAILED";
    await app.inject({
      method: "POST",
      url: `/api/v1/payments/jibit/orders/${failedOrder.id}/verify`,
      headers: { cookie: user.cookie },
    });
    expect(
      await app.prisma.shareboxFulfillment.count({
        where: {
          orderItem: { orderId: failedOrder.id },
          attempts: { gt: 0 },
        },
      }),
    ).toBe(0);
  });

  it("replays the exact identity after an ambiguous timeout and blocks unsafe admin actions", async () => {
    const user = await createUser("timeout");
    const product = await createProduct("timeout");
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: product.id, paymentMethod: "WALLET" },
    });
    const order = create.json().data.order;
    const job = await app.prisma.shareboxFulfillment.findFirst({
      where: { orderItem: { orderId: order.id } },
    });
    timeoutOnce.add(job.externalId);
    const callStart = issued.length;
    expect(
      (await runShareboxFulfillmentBatch(app.prisma, shareboxClient)).retried,
    ).toBe(1);

    const refund = await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${order.id}/refund`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    expect(refund.statusCode).toBe(409);
    expect(refund.json().error.code).toBe("SHAREBOX_FULFILLMENT_REFUND_LOCKED");
    const cancel = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/orders/${order.id}/status`,
      headers: { cookie: adminCookie },
      payload: { status: "CANCELLED" },
    });
    expect(cancel.statusCode).toBe(409);
    expect(cancel.json().error.code).toBe("SHAREBOX_FULFILLMENT_STATUS_LOCKED");

    const retry = await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${order.id}/sharebox/retry`,
      headers: { cookie: adminCookie },
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.headers["cache-control"]).toBe("no-store");
    expect(retry.json().data.queued).toBe(1);
    expect(
      (await runShareboxFulfillmentBatch(app.prisma, shareboxClient)).delivered,
    ).toBe(1);
    const calls = issued.slice(callStart);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(
      await app.prisma.orderDelivery.count({
        where: { shareboxFulfillmentId: job.id },
      }),
    ).toBe(1);
  });

  it("blocks credential rotation for every outstanding order and allows it after terminal resolution", async () => {
    const user = await createUser("rotation");

    const pendingProduct = await createProduct("rotation-pending");
    const pendingCreate = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: pendingProduct.id, paymentMethod: "WALLET" },
    });
    const pendingOrder = pendingCreate.json().data.order;

    const blockedByPending = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/sharebox/settings",
      headers: { cookie: adminCookie },
      payload: { apiKey: "sbx_sales_replacement-secret" },
    });
    expect(blockedByPending.statusCode).toBe(409);
    expect(blockedByPending.json().error.code).toBe(
      "SHAREBOX_PENDING_FULFILLMENTS",
    );
    await runShareboxFulfillmentBatch(app.prisma, shareboxClient);

    const timeoutProduct = await createProduct("rotation-timeout");
    const timeoutCreate = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: timeoutProduct.id, paymentMethod: "WALLET" },
    });
    const timeoutOrder = timeoutCreate.json().data.order;
    const timeoutJob = await app.prisma.shareboxFulfillment.findFirst({
      where: { orderItem: { orderId: timeoutOrder.id } },
    });
    timeoutOnce.add(timeoutJob.externalId);
    expect(
      (await runShareboxFulfillmentBatch(app.prisma, shareboxClient, { batchSize: 1 }))
        .retried,
    ).toBe(1);

    const blockedByTimeout = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/sharebox/settings",
      headers: { cookie: adminCookie },
      payload: { apiKey: "sbx_sales_replacement-secret" },
    });
    expect(blockedByTimeout.statusCode).toBe(409);
    expect(blockedByTimeout.json().error.code).toBe(
      "SHAREBOX_PENDING_FULFILLMENTS",
    );
    const retry = await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${timeoutOrder.id}/sharebox/retry`,
      headers: { cookie: adminCookie },
    });
    expect(retry.statusCode).toBe(200);
    await runShareboxFulfillmentBatch(app.prisma, shareboxClient);

    const unpaidProduct = await createProduct("rotation-unpaid");
    const unpaidCreate = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: unpaidProduct.id, paymentMethod: "JIBIT" },
    });
    const unpaidOrder = unpaidCreate.json().data.order;
    expect(unpaidOrder.paymentStatus).toBe("UNPAID");

    const blockedByUnpaid = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/sharebox/settings",
      headers: { cookie: adminCookie },
      payload: { apiKey: "sbx_sales_replacement-secret" },
    });
    expect(blockedByUnpaid.statusCode).toBe(409);
    expect(blockedByUnpaid.json().error.code).toBe(
      "SHAREBOX_PENDING_FULFILLMENTS",
    );

    // Re-saving the same credential and changing only enabled remain safe.
    expect((await configure(API_KEY)).apiKeyHint).toBe(API_KEY.slice(-4));
    const disabled = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/sharebox/settings",
      headers: { cookie: adminCookie },
      payload: { enabled: false },
    });
    expect(disabled.statusCode).toBe(200);
    await configure(API_KEY);

    const unpaidAttempt = await app.prisma.paymentAttempt.findFirst({
      where: { orderId: unpaidOrder.id },
    });
    purchases.get(unpaidAttempt.providerPurchaseId).status = "FAILED";
    const failUnpaid = await app.inject({
      method: "POST",
      url: `/api/v1/payments/jibit/orders/${unpaidOrder.id}/verify`,
      headers: { cookie: user.cookie },
    });
    expect(failUnpaid.statusCode).toBe(200);

    const cancelledProduct = await createProduct("rotation-cancelled");
    const cancelledCreate = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: cancelledProduct.id, paymentMethod: "WALLET" },
    });
    const cancelledOrder = cancelledCreate.json().data.order;
    const cancelPaid = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/orders/${cancelledOrder.id}/status`,
      headers: { cookie: adminCookie },
      payload: { status: "CANCELLED" },
    });
    expect(cancelPaid.statusCode).toBe(200);

    const refundedProduct = await createProduct("rotation-refunded");
    const refundedCreate = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: refundedProduct.id, paymentMethod: "WALLET" },
    });
    const refundedOrder = refundedCreate.json().data.order;
    const refund = await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${refundedOrder.id}/refund`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    expect(refund.statusCode).toBe(200);

    await configure("sbx_sales_replacement-secret");
    await configure(API_KEY);
    expect(
      await app.prisma.order.findUnique({ where: { id: pendingOrder.id } }),
    ).toMatchObject({ status: "DELIVERED" });
  });

  it("does not count a disabled claim as an attempt, so refund and later fulfillment stay safe", async () => {
    const user = await createUser("disabled-claim");
    const refundProduct = await createProduct("disabled-refund");
    const resumeProduct = await createProduct("disabled-resume");
    const refundCreate = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: refundProduct.id, paymentMethod: "WALLET" },
    });
    const resumeCreate = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: resumeProduct.id, paymentMethod: "WALLET" },
    });
    const refundOrder = refundCreate.json().data.order;
    const resumeOrder = resumeCreate.json().data.order;

    const disable = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/sharebox/settings",
      headers: { cookie: adminCookie },
      payload: { enabled: false },
    });
    expect(disable.statusCode).toBe(200);
    const before = issued.length;
    expect(
      (await runShareboxFulfillmentBatch(app.prisma, shareboxClient, { batchSize: 1 }))
        .retried,
    ).toBe(1);
    expect(issued).toHaveLength(before);
    expect(
      await app.prisma.shareboxFulfillment.findFirst({
        where: { orderItem: { orderId: refundOrder.id } },
      }),
    ).toMatchObject({ attempts: 0, status: "RETRY" });

    const refund = await app.inject({
      method: "POST",
      url: `/api/v1/admin/orders/${refundOrder.id}/refund`,
      headers: { cookie: adminCookie },
      payload: {},
    });
    expect(refund.statusCode).toBe(200);

    await configure(API_KEY);
    const resumed = await runShareboxFulfillmentBatch(app.prisma, shareboxClient);
    expect(resumed.delivered).toBe(1);
    expect(
      await app.prisma.order.findUnique({ where: { id: resumeOrder.id } }),
    ).toMatchObject({ status: "DELIVERED" });
  });

  it("never persists arbitrary upstream strings as error codes", async () => {
    const user = await createUser("safe-error");
    const product = await createProduct("safe-error");
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: product.id, paymentMethod: "WALLET" },
    });
    const order = create.json().data.order;
    const job = await app.prisma.shareboxFulfillment.findFirst({
      where: { orderItem: { orderId: order.id } },
    });
    unsafeErrorOnce.add(job.externalId);
    await runShareboxFulfillmentBatch(app.prisma, shareboxClient);
    const stored = await app.prisma.shareboxFulfillment.findUnique({
      where: { id: job.id },
    });
    expect(stored.lastErrorCode).toBe("SHAREBOX_REQUEST_FAILED");
    expect(stored.lastErrorCode).not.toContain(API_KEY);
  });

  it("claims one unit once across concurrent workers", async () => {
    const user = await createUser("concurrency");
    const product = await createProduct("concurrency");
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: product.id, paymentMethod: "WALLET" },
    });
    const orderId = create.json().data.order.id;
    const job = await app.prisma.shareboxFulfillment.findFirst({
      where: { orderItem: { orderId } },
    });
    delayed.add(job.externalId);
    const before = issued.length;
    await Promise.all([
      runShareboxFulfillmentBatch(app.prisma, shareboxClient, { batchSize: 1 }),
      runShareboxFulfillmentBatch(app.prisma, shareboxClient, { batchSize: 1 }),
    ]);
    delayed.delete(job.externalId);
    expect(issued.slice(before).filter((body) => body.external_id === job.externalId)).toHaveLength(1);
    expect(
      await app.prisma.orderDelivery.count({
        where: { shareboxFulfillmentId: job.id },
      }),
    ).toBe(1);
  });

  it("validates customer details before charging", async () => {
    const user = await createUser("missing-phone", { phone: null });
    const product = await createProduct("missing-phone");
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: user.cookie },
      payload: { productId: product.id, paymentMethod: "WALLET" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("SHAREBOX_CUSTOMER_DETAILS_REQUIRED");
    expect(
      (await app.prisma.wallet.findUnique({ where: { userId: user.id } })).balance,
    ).toBe(10_000);
    expect(await app.prisma.order.count({ where: { userId: user.id } })).toBe(0);

    const oversized = await createUser("oversized");
    await app.prisma.user.update({
      where: { id: oversized.id },
      data: { name: "x".repeat(101) },
    });
    const oversizedResponse = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: oversized.cookie },
      payload: { productId: product.id, paymentMethod: "WALLET" },
    });
    expect(oversizedResponse.statusCode).toBe(400);
    expect(oversizedResponse.json().error.code).toBe("SHAREBOX_CUSTOMER_DETAILS_INVALID");
    expect(
      (await app.prisma.wallet.findUnique({ where: { userId: oversized.id } })).balance,
    ).toBe(10_000);
    expect(await app.prisma.order.count({ where: { userId: oversized.id } })).toBe(0);
  });

  it("times out requests and rejects non-TLS non-test origins", async () => {
    expect(() =>
      createShareboxClient({
        baseUrl: "http://sharebox.example.test",
        nodeEnv: "production",
      }),
    ).toThrow(/HTTPS/);

    const client = createShareboxClient({
      baseUrl: "http://127.0.0.1:4303",
      nodeEnv: "test",
      timeoutMs: 10,
      fetchImpl: (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          });
        }),
    });
    await expect(client.listCategories("secret")).rejects.toMatchObject({
      code: "SHAREBOX_TIMEOUT",
    });

    const server = createServer((_request, response) => {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Transfer-Encoding": "chunked",
      });
      response.write('{"data":[');
    });
    await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
    try {
      const bodyStallClient = createShareboxClient({
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        nodeEnv: "test",
        timeoutMs: 25,
      });
      await expect(bodyStallClient.listCategories("secret")).rejects.toMatchObject({
        code: "SHAREBOX_TIMEOUT",
      });
    } finally {
      server.closeAllConnections();
      await new Promise((resolveClose) => server.close(resolveClose));
    }
  });
});
