import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createTestDatabase } from "./helpers/database.js";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "pricing-orders-test-secret-only";
const db = createTestDatabase("pricing-orders");
let app, user, cookie, adminCookie, product;
beforeAll(async () => {
  const { buildApp } = await import("../src/app.js");
  app = await buildApp({ prisma: db.prisma, logger: false, enableJibitReconciliation: false });
  user = await db.prisma.user.create({ data: { name: "Pricing buyer", wallet: { create: { balance: 100000000 } } } });
  const admin = await db.prisma.user.create({ data: { name: "Pricing admin", role: "ADMIN" } });
  cookie = `gimiacc_session=${app.jwt.sign({ id: user.id, role: "USER" })}`;
  adminCookie = `gimiacc_session=${app.jwt.sign({ id: admin.id, role: "ADMIN" })}`;
  product = await db.prisma.product.create({ data: { title: "USD subscription", slug: "usd-wallet-snapshot", type: "CUSTOM_FORM", price: 0, priceCurrency: "USD", basePrice: "2.5", profitType: "PERCENT", profitValue: "10" } });
});
afterAll(async () => { await app?.close(); await db.close(); });
describe("financial order snapshots", () => {
  it("charges the computed wallet price and privately snapshots rate and realized toman margin", async () => {
    const response = await app.inject({ method: "POST", url: "/api/v1/orders/", headers: { cookie }, payload: { productId: product.id, quantity: 2 } });
    expect(response.statusCode).toBe(201);
    const order = response.json().data.order;
    expect(order.totalAmount).toBe(1485000);
    const stored = await db.prisma.orderItem.findFirst({ where: { orderId: order.id } });
    expect(stored).toMatchObject({ priceSnapshot: 742500, priceCurrencySnapshot: "USD", basePriceSnapshot: "2.5", profitTypeSnapshot: "PERCENT", profitValueSnapshot: "10", exchangeRateSnapshot: 270000, rateSourceSnapshot: "DEFAULT", rateFetchedAtSnapshot: null, baseTomanSnapshot: 675000, profitTomanSnapshot: 67500, totalProfitSnapshot: 135000 });
    expect(await db.prisma.wallet.findUnique({ where: { userId: user.id } })).toMatchObject({ balance: 98515000 });
    for (const key of ["priceCurrencySnapshot", "basePriceSnapshot", "profitTypeSnapshot", "profitValueSnapshot", "exchangeRateSnapshot", "rateSourceSnapshot", "rateFetchedAtSnapshot", "profitTomanSnapshot", "totalProfitSnapshot", "baseTomanSnapshot"]) expect(order.items[0]).not.toHaveProperty(key);
    for (const key of ["basePrice", "profitType", "profitValue", "priceCurrency"]) expect(order.items[0].product).not.toHaveProperty(key);
    expect(order.items[0].product.price).toBe(742500);
    const admin = await app.inject({ url: `/api/v1/admin/orders/${order.id}`, headers: { cookie: adminCookie } });
    expect(admin.json().data.order.items[0].profitTomanSnapshot).toBe(67500);
  });
  it("freezes USD profit and gateway amount through rate changes, repeated callbacks and refund", async () => {
    const { createPendingJibitOrder } = await import("../src/modules/orders/service.js");
    const { verifyJibitPayment } = await import("../src/modules/payments/service.js");
    const rate = await db.prisma.exchangeRate.create({ data: { rateToman: 280000 } });
    await db.prisma.product.update({ where: { id: product.id }, data: { profitType: "USD", profitValue: "1" } });
    const pending = await createPendingJibitOrder(db.prisma, user.id, { productId: product.id, quantity: 2 }, {
      attemptId: "pricing-gateway-attempt", clientReferenceNumber: "pricing-gateway-reference", reconcileAfter: new Date(Date.now() + 120000),
    });
    expect(pending.order.totalAmount).toBe(1960000);
    expect(pending.attempt.providerAmountRial).toBe(19600000);
    const attempt = await db.prisma.paymentAttempt.update({ where: { id: pending.attempt.id }, data: { status: "PENDING", providerPurchaseId: "pricing-purchase" } });
    await db.prisma.exchangeRate.create({ data: { rateToman: 500000, fetchedAt: new Date(Date.now() + 1000) } });
    await db.prisma.product.update({ where: { id: product.id }, data: { basePrice: "10", profitValue: "5" } });
    const client = {
      verifyPurchase: async () => ({ status: "SUCCESSFUL" }),
      getPurchase: async () => ({ status: "SUCCESSFUL", purchaseId: "pricing-purchase", clientReferenceNumber: attempt.clientReferenceNumber, amount: 19600000 }),
    };
    await verifyJibitPayment(db.prisma, client, attempt);
    await verifyJibitPayment(db.prisma, client, attempt);
    const stored = await db.prisma.orderItem.findFirst({ where: { orderId: pending.order.id } });
    expect(stored).toMatchObject({ priceSnapshot: 980000, exchangeRateSnapshot: 280000, rateSourceSnapshot: "WALLEX", rateFetchedAtSnapshot: rate.fetchedAt, basePriceSnapshot: "2.5", profitValueSnapshot: "1", profitTomanSnapshot: 280000, totalProfitSnapshot: 560000 });
    for (const url of [`/api/v1/orders/${pending.order.id}`, "/api/v1/orders/my"]) {
      const result = await app.inject({ url, headers: { cookie } });
      const orders = result.json().data.orders ?? [result.json().data.order];
      const order = orders.find((o) => o.id === pending.order.id);
      expect(order.items[0].product.price).toBe(980000);
      for (const key of ["priceCurrencySnapshot", "basePriceSnapshot", "profitTypeSnapshot", "profitValueSnapshot", "exchangeRateSnapshot", "rateSourceSnapshot", "rateFetchedAtSnapshot", "profitTomanSnapshot", "totalProfitSnapshot", "baseTomanSnapshot"]) expect(order.items[0]).not.toHaveProperty(key);
      expect(order.items[0].product).not.toHaveProperty("basePrice");
    }
    const refunded = await app.inject({ method: "POST", url: `/api/v1/admin/orders/${pending.order.id}/refund`, headers: { cookie: adminCookie }, payload: { note: "pricing test refund" } });
    expect(refunded.statusCode).toBe(400);
    expect(refunded.json().error.code).toBe("DIRECT_PAYMENT_REFUND_REQUIRES_PROVIDER");
    // Preserve the existing direct-refund guard; wallet refunds use their own snapshot.
    const walletOrder = await db.prisma.order.findFirst({ where: { userId: user.id, paymentMethod: "WALLET" } });
    const walletRefund = await app.inject({ method: "POST", url: `/api/v1/admin/orders/${walletOrder.id}/refund`, headers: { cookie: adminCookie }, payload: { note: "pricing test wallet refund" } });
    expect(walletRefund.statusCode).toBe(200);
    const refundTx = await db.prisma.walletTransaction.findFirst({ where: { referenceId: walletOrder.id, type: "ORDER_REFUND" } });
    expect(refundTx.amount).toBe(1485000);
    expect((await db.prisma.orderItem.findUnique({ where: { id: stored.id } })).totalProfitSnapshot).toBe(560000);
  });
  it("rejects gateway rial overflow before creating an order", async () => {
    const { createPendingJibitOrder } = await import("../src/modules/orders/service.js");
    const big = await db.prisma.product.create({ data: { title: "Large toman price", slug: "toman-overflow", type: "CUSTOM_FORM", price: 300000000 } });
    const count = await db.prisma.order.count();
    await expect(createPendingJibitOrder(db.prisma, user.id, { productId: big.id }, { attemptId: "overflow-attempt", clientReferenceNumber: "overflow-reference", reconcileAfter: new Date() })).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_INVALID" });
    expect(await db.prisma.order.count()).toBe(count);
  });
});
