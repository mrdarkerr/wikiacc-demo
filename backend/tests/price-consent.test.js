import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "./helpers/database.js";
process.env.NODE_ENV = "test";
const db = createTestDatabase("price-consent");
let app, cookie, user, product;
beforeAll(async () => {
  const { buildApp } = await import("../src/app.js");
  app = await buildApp({ prisma: db.prisma, logger: false, enableJibitReconciliation: false, jibitCallbackUrl: "https://example.invalid/callback",
    jibitClient: { origin: "https://example.invalid", createPurchase() { throw new Error("Provider must not be contacted on price mismatch"); } } });
  user = await db.prisma.user.create({ data: { name: "Consent buyer", wallet: { create: { balance: 1000000 } } } });
  cookie = `wikiacc_session=${app.jwt.sign({ id: user.id, role: "USER" })}`;
  product = await db.prisma.product.create({ data: { slug: "price-consent", title: "Consent product", type: "CUSTOM_FORM", price: 100000, basePrice: "100000" } });
});
afterAll(async () => { await app?.close(); await db.close(); });
describe("atomic checkout price consent", () => {
  it("rejects invalid expected prices with validation errors", async () => {
    for (const expectedUnitPrice of [-1, 1.5, "100000", 2147483648]) {
      const result = await app.inject({ method: "POST", url: "/api/v1/orders", headers: { cookie }, payload: { productId: product.id, expectedUnitPrice } });
      expect(result.statusCode).toBe(400);
      expect(result.json().error.code).toBe("VALIDATION_ERROR");
    }
  });
  it.each(["WALLET", "JIBIT"])("rejects a changed %s price before any order, payment or wallet write", async (paymentMethod) => {
    const response = await app.inject({ method: "POST", url: "/api/v1/orders", headers: { cookie },
      payload: { productId: product.id, paymentMethod, expectedUnitPrice: 90000 } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: "PRICE_CHANGED", message: "Product price has changed; confirm the current price", details: { unitPrice: 100000, totalAmount: 100000 } } });
    expect(await db.prisma.order.count()).toBe(0);
    expect(await db.prisma.paymentAttempt.count()).toBe(0);
    expect((await db.prisma.wallet.findUnique({ where: { userId: user.id } })).balance).toBe(1000000);
  });
  it("accepts the confirmed unit price for multiple units and preserves legacy callers", async () => {
    const confirmed = await app.inject({ method: "POST", url: "/api/v1/orders", headers: { cookie }, payload: { productId: product.id, quantity: 2, expectedUnitPrice: 100000 } });
    expect(confirmed.statusCode).toBe(201);
    expect(confirmed.json().data.order.totalAmount).toBe(200000);
    const legacy = await app.inject({ method: "POST", url: "/api/v1/orders", headers: { cookie }, payload: { productId: product.id } });
    expect(legacy.statusCode).toBe(201);
    expect(legacy.json().data.order.totalAmount).toBe(100000);
  });
});
