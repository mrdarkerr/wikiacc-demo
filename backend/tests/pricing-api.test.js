import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { createTestDatabase } from "./helpers/database.js";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "pricing-api-test-secret-only";
const db = createTestDatabase("pricing-api");
let app, adminCookie, userCookie;
const wallexClient = { fetchRate: vi.fn() };
beforeAll(async () => {
  const { buildApp } = await import("../src/app.js");
  app = await buildApp({ prisma: db.prisma, logger: false, wallexClient, enableJibitReconciliation: false });
  const admin = await db.prisma.user.create({ data: { name: "Pricing admin", role: "ADMIN" } });
  const user = await db.prisma.user.create({ data: { name: "Pricing buyer" } });
  adminCookie = `wikiacc_session=${app.jwt.sign({ id: admin.id, role: "ADMIN" })}`;
  userCookie = `wikiacc_session=${app.jwt.sign({ id: user.id, role: "USER" })}`;
});
afterAll(async () => { await app?.close(); await db.close(); });
describe("pricing product API", () => {
  it("accepts USD base/profit and exposes only the final toman price to the catalog", async () => {
    const response = await app.inject({ method: "POST", url: "/api/v1/admin/products", headers: { cookie: adminCookie },
      payload: { slug: "dynamic-usd-product", title: "USD subscription", type: "CUSTOM_FORM", priceCurrency: "USD", basePrice: "2.5", profit: "%10" } });
    expect(response.statusCode).toBe(201);
    expect(response.json().data.product).toMatchObject({ priceCurrency: "USD", basePrice: "2.5", profitType: "PERCENT", profitValue: "10" });
    const catalog = await app.inject({ method: "GET", url: "/api/v1/products/dynamic-usd-product" });
    expect(catalog.statusCode).toBe(200);
    expect(catalog.json().data.product.price).toBe(742500);
    for (const key of ["priceCurrency", "basePrice", "profitType", "profitValue", "pricing"]) expect(catalog.json().data.product).not.toHaveProperty(key);
    expect(catalog.headers["cache-control"]).toBe("no-store");
    expect(wallexClient.fetchRate).not.toHaveBeenCalled();
  });
  it("provides guarded fallback settings, dashboard rate status and a pricing preview", async () => {
    for (const [method, url, payload] of [["GET", "/api/v1/admin/pricing/settings"], ["PATCH", "/api/v1/admin/pricing/settings", { fallbackRateToman: 280000 }], ["GET", "/api/v1/admin/pricing/status"], ["GET", "/api/v1/admin/dashboard"], ["POST", "/api/v1/admin/pricing/preview", { priceCurrency: "USD", basePrice: "2", profit: "$1" }]]) {
      expect((await app.inject({ method, url, payload })).statusCode).toBe(401);
      expect((await app.inject({ method, url, payload, headers: { cookie: userCookie } })).statusCode).toBe(403);
    }
    const settings = await app.inject({ method: "PATCH", url: "/api/v1/admin/pricing/settings", headers: { cookie: adminCookie }, payload: { fallbackRateToman: 280000 } });
    expect(settings.statusCode).toBe(200);
    const status = await app.inject({ url: "/api/v1/admin/pricing/status", headers: { cookie: adminCookie } });
    expect(status.json().data.exchangeRate).toMatchObject({ rateToman: 280000, source: "FALLBACK" });
    expect(status.headers["cache-control"]).toBe("no-store");
    const dashboard = await app.inject({ url: "/api/v1/admin/dashboard", headers: { cookie: adminCookie } });
    expect(dashboard.json().data.exchangeRate.rateToman).toBe(280000);
    const preview = await app.inject({ method: "POST", url: "/api/v1/admin/pricing/preview", headers: { cookie: adminCookie }, payload: { priceCurrency: "USD", basePrice: "2", profit: "$1", quantity: 2 } });
    expect(preview.json().data.pricing).toMatchObject({ unitPrice: 840000, totalAmount: 1680000, totalProfit: 560000 });
  });
  it("keeps legacy toman editing compatible and refuses ambiguous dollar edits", async () => {
    const created = await app.inject({ method: "POST", url: "/api/v1/admin/products", headers: { cookie: adminCookie }, payload: { slug: "legacy-toman-price", title: "Legacy toman product", type: "CUSTOM_FORM", price: 100000, profit: "20000" } });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.product.id;
    const updated = await app.inject({ method: "PATCH", url: `/api/v1/admin/products/${id}`, headers: { cookie: adminCookie }, payload: { price: 150000 } });
    expect(updated.json().data.product).toMatchObject({ basePrice: "150000", profitValue: "20000", pricing: { unitPrice: 170000 } });
    expect((await app.inject({ url: "/api/v1/products/legacy-toman-price" })).json().data.product.price).toBe(170000);
    const usd = await db.prisma.product.findUnique({ where: { slug: "dynamic-usd-product" } });
    for (const payload of [{ price: 1 }, { basePrice: "2", price: 1 }, { priceCurrency: "TOMAN" }, { profit: "%10%" }, { basePrice: "-1" }]) {
      expect((await app.inject({ method: "PATCH", url: `/api/v1/admin/products/${usd.id}`, headers: { cookie: adminCookie }, payload })).statusCode).toBe(400);
    }
    const renamed = await app.inject({ method: "PATCH", url: `/api/v1/admin/products/${usd.id}`, headers: { cookie: adminCookie }, payload: { title: "Renamed USD subscription" } });
    expect(renamed.json().data.product).toMatchObject({ basePrice: "2.5", profitType: "PERCENT", profitValue: "10" });
  });
  it("refreshes all public list prices from a shared database rate and hides internal fields", async () => {
    await db.prisma.exchangeRate.create({ data: { rateToman: 300000 } });
    const result = await app.inject({ url: "/api/v1/products" });
    const product = result.json().data.products.find((p) => p.slug === "dynamic-usd-product");
    expect(product.price).toBe(825000);
    for (const item of result.json().data.products) {
      for (const key of ["basePrice", "priceCurrency", "profitType", "profitValue", "pricing"]) expect(item).not.toHaveProperty(key);
    }
    expect(wallexClient.fetchRate).not.toHaveBeenCalled();
  });
  it("does not overwrite a concurrently changed price while editing product metadata", async () => {
    const product = await db.prisma.product.findUnique({ where: { slug: "dynamic-usd-product" } });
    const original = db.prisma.product.findUnique.bind(db.prisma.product);
    const spy = vi.spyOn(db.prisma.product, "findUnique").mockImplementationOnce(async (args) => {
      const stale = await original(args);
      await db.prisma.product.update({ where: { id: product.id }, data: { basePrice: "10" } });
      return stale;
    });
    try {
      const result = await app.inject({ method: "PATCH", url: `/api/v1/admin/products/${product.id}`, headers: { cookie: adminCookie }, payload: { title: "Concurrent rename" } });
      expect(result.statusCode).toBe(200);
      expect(result.json().data.product.basePrice).toBe("10");
    } finally { spy.mockRestore(); }
  });
});
