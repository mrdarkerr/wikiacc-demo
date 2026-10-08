import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from "../backend/node_modules/vitest";
import { api } from "../lib/api";
import { createTestDatabase } from "../backend/tests/helpers/database.js";
vi.stubEnv("NODE_ENV", "test");
let app: Awaited<ReturnType<typeof import("../backend/src/app.js")["buildApp"]>>;
let db: ReturnType<typeof createTestDatabase>;
let cookie: string;
beforeAll(async () => {
  db = createTestDatabase("frontend-contract");
  const { buildApp } = await import("../backend/src/app.js");
  app = await buildApp({ prisma: db.prisma, logger: false, enableJibitReconciliation: false });
  const admin = await db.prisma.user.create({ data: { name: "Contract admin", role: "ADMIN" } });
  cookie = `gimiacc_session=${app.jwt.sign({ id: admin.id, role: "ADMIN" })}`;
});
afterAll(async () => { await app?.close(); await db?.close(); });
afterEach(() => vi.unstubAllGlobals());
function useRealRoutes(session = cookie) {
  vi.stubGlobal("fetch", async (url: string, options: RequestInit) => {
    const parsed = new URL(url);
    const result = await app.inject({ method: (options.method ?? "GET") as "GET" | "POST" | "PATCH", url: parsed.pathname + parsed.search,
      headers: { ...Object.fromEntries(new Headers(options.headers)), cookie: session }, payload: typeof options.body === "string" ? options.body : undefined });
    return new Response(result.body, { status: result.statusCode, headers: { "content-type": "application/json" } });
  });
}
describe("frontend pricing client against real backend routes", () => {
  it("keeps public final prices separate from admin base pricing and carries checkout consent", async () => {
    useRealRoutes();
    const { product } = await api.admin.products.create({ title: "Contract product", slug: "contract-public", type: "CUSTOM_FORM", priceCurrency: "USD", basePrice: "2", profit: "$1" });
    const listed = (await api.catalog.products()).products.find((item) => item.id === product.id)!;
    expect(listed.price).toBe(810000);
    for (const field of ["basePrice", "priceCurrency", "profitType", "profitValue", "pricing"]) expect(listed).not.toHaveProperty(field);
    expect((await api.catalog.product(product.slug)).product.price).toBe(810000);
    await expect(api.orders.create({ productId: product.id, paymentMethod: "WALLET", expectedUnitPrice: 1 })).rejects.toMatchObject({ status: 409, payload: { error: { code: "PRICE_CHANGED", details: { unitPrice: 810000 } } } });
  });
  it("rejects a malformed public price rather than displaying an invalid amount", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json({ data: { products: [{ id: "bad", price: "100" }], product: { id: "bad", price: null } } }))));
    for (const call of [() => api.catalog.products(), () => api.catalog.product("bad")]) {
      await expect(call()).rejects.toMatchObject({ name: "ApiError", payload: { error: { code: "API_INVALID_RESPONSE" } } });
    }
  });
  it("rejects malformed pricing/status/settings successes instead of rendering undefined money", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json({ data: { pricing: { unitPrice: "100" }, exchangeRate: {}, settings: { fallbackRateToman: 0 } } }))));
    for (const call of [() => api.admin.pricing.preview({ priceCurrency: "USD", basePrice: "2" }), () => api.admin.pricing.status(), () => api.admin.pricing.getSettings()]) {
      await expect(call()).rejects.toMatchObject({ name: "ApiError", payload: { error: { code: "API_INVALID_RESPONSE" } } });
    }
  });
  it("uses actual settings/status/dashboard/preview contracts, preserving zero and decimals", async () => {
    useRealRoutes();
    expect((await api.admin.pricing.getSettings()).settings.fallbackRateToman).toBe(270000);
    expect((await api.admin.pricing.updateSettings({ fallbackRateToman: 280000 })).settings.fallbackRateToman).toBe(280000);
    expect((await api.admin.pricing.status()).exchangeRate).toMatchObject({ rateToman: 280000, status: "FALLBACK" });
    expect((await api.admin.dashboard()).jobs).toBeInstanceOf(Array);
    const preview = await api.admin.pricing.preview({ priceCurrency: "USD", basePrice: "2.5", profit: "%10" });
    expect(preview.pricing).toMatchObject({ basePrice: "2.5", baseToman: 700000, profitToman: 70000, unitPrice: 770000 });
    expect((await api.admin.pricing.preview({ priceCurrency: "TOMAN", basePrice: "0", profit: "0" })).pricing.unitPrice).toBe(0);
  });
});
