import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { history, forecast, midnight } from "../src/modules/finance/service.js";
import { historyResponse, forecastResponse } from "../src/modules/finance/contract.js";
import { createTestDatabase } from "./helpers/database.js";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "dashboard-finance-test-only-secret";
const db = createTestDatabase("dashboard-finance");
let app, cookie, userCookie, buyer, product;
beforeAll(async () => {
  const { buildApp } = await import("../src/app.js");
  app = await buildApp({ prisma: db.prisma, logger: false, enableJibitReconciliation: false });
  await app.ready();
  const admin = await db.prisma.user.create({ data: { name: "Finance tester", role: "ADMIN" } });
  buyer = await db.prisma.user.create({ data: { name: "Finance tester", role: "USER" } });
  cookie = `wikiacc_session=${app.jwt.sign({ id: admin.id, role: "ADMIN" })}`;
  userCookie = `wikiacc_session=${app.jwt.sign({ id: buyer.id, role: "USER" })}`;
  product = await db.prisma.product.create({ data: { slug: "finance-test", title: "Test", type: "CUSTOM_FORM", price: 100 } });
});
beforeEach(async () => { await db.prisma.orderItem.deleteMany(); await db.prisma.order.deleteMany(); });
afterAll(async () => { await app?.close(); await db.close(); });
const get = (url) => app.inject({ url, headers: { cookie } });
async function order({ at = new Date(), paymentStatus = "PAID", status = "DELIVERED", amount = 300, profit = 60, quantity = 3 } = {}) {
  return db.prisma.order.create({ data: { userId: buyer.id, totalAmount: amount, createdAt: at, paymentStatus, status,
    items: { create: { productId: product.id, titleSnapshot: "Test", priceSnapshot: amount / quantity, quantity, productTypeSnapshot: "CUSTOM_FORM", totalProfitSnapshot: profit } } } });
}
describe("admin dashboard financial reporting", () => {
  const now = new Date("2026-10-10T10:00:00Z");
  it("counts frozen quantity-inclusive margin and never today's changed product price", async () => {
    await order({ at: now });
    await order({ at: now, profit: null });
    await order({ at: now, profit: 0 });
    for (const values of [{ paymentStatus: "UNPAID" }, { status: "CANCELLED" }, { status: "REFUNDED" }]) await order({ at: now, ...values });
    await db.prisma.product.update({ where: { id: product.id }, data: { basePrice: "999999", profitValue: "999999" } });
    const result = await history(db.prisma, {}, now);
    expect(result.totals).toEqual({ turnover: 900, profit: 60, orderCount: 3, knownProfitItemCount: 2, unknownProfitItemCount: 1 });
    expect(result.points.at(-1)).toMatchObject(result.totals);
  });
  it("covers all paid orders beyond the legacy 200-order cap", async () => {
    for (let i = 0; i < 205; i++) await order({ at: now });
    expect((await history(db.prisma, {}, now)).totals).toMatchObject({ orderCount: 205, turnover: 205 * 300, profit: 205 * 60 });
  });
  it("paginates contiguous Saturday–Friday weeks all the way to the oldest sale", async () => {
    await order({ at: new Date("2025-01-01T10:00:00Z") });
    await order({ at: now });
    const recent = await history(db.prisma, { interval: "weekly", page: 1 }, now);
    const previous = await history(db.prisma, { interval: "weekly", page: 2 }, now);
    expect(recent.points.at(-1)).toMatchObject({ startDate: "2026-10-10", endDate: "2026-10-16", isPartial: true });
    expect(previous.range.endDate).toBe("2026-08-21");
    expect(recent.range.startDate).toBe("2026-08-22");
    expect(previous.pagination).toMatchObject({ page: 2, hasNewer: true });
    const oldest = await history(db.prisma, { interval: "weekly", page: 100000 }, now);
    expect(oldest.pagination.hasOlder).toBe(false);
    expect(oldest.totals.orderCount).toBe(1);
  });
  it("uses Tehran midnight and historical DST independent of the process timezone", async () => {
    expect(midnight("2026-10-10").toISOString()).toBe("2026-10-09T20:30:00.000Z");
    expect(midnight("2022-07-15").toISOString()).toBe("2022-07-14T19:30:00.000Z");
    await order({ at: new Date("2026-10-09T20:29:59Z") });
    await order({ at: new Date("2026-10-09T20:30:00Z") });
    const result = await history(db.prisma, {}, now);
    expect(result.points.at(-2).orderCount).toBe(1);
    expect(result.points.at(-1).orderCount).toBe(1);
  });
  it("uses complete days including zero-sale days, not partial today, for forecasts", async () => {
    await order({ at: new Date("2026-09-12T10:00:00Z") });
    await order({ at: new Date("2026-09-13T10:00:00Z") });
    await order({ at: new Date("2026-10-09T10:00:00Z") });
    await order({ at: now, amount: 300000 });
    const result = await forecast(db.prisma, now);
    expect(result).toMatchObject({ status: "READY", sample: { observedDays: 28, turnover: 900, profit: 180, orderCount: 3 } });
    expect(result.horizons[0]).toEqual({ days: 7, startDate: "2026-10-11", endDate: "2026-10-17", turnover: Math.round(900 / 28 * 7), profit: Math.round(180 / 28 * 7) });
    expect(result.horizons[1]).toMatchObject({ days: 30, endDate: "2026-11-09" });
  });
  it("does not invent forecasts for sparse data or unknown historical margins", async () => {
    const empty = await forecast(db.prisma, now);
    expect(empty.status).toBe("INSUFFICIENT_DATA");
    expect(empty.horizons.every((h) => h.turnover === null && h.profit === null)).toBe(true);
    for (const at of ["2026-09-20", "2026-09-21", "2026-09-22"]) await order({ at: new Date(`${at}T10:00:00Z`), profit: null });
    const unknown = await forecast(db.prisma, now);
    expect(unknown.status).toBe("READY");
    expect(unknown.horizons.every((h) => h.turnover !== null && h.profit === null)).toBe(true);
  });
  it("documents every response status, exact schemas and session security in Swagger", async () => {
    const document = app.swagger();
    for (const path of ["history", "forecast"]) {
      const spec = document.paths[`/api/v1/admin/finance/${path}`].get;
      expect(spec.security).toEqual([{ adminSession: [] }]);
      expect(Object.keys(spec.responses).sort()).toEqual(["200", "400", "401", "403", "429", "500"]);
      expect(spec.responses["200"].content["application/json"].schema).toHaveProperty("properties.data");
    }
    const ajv = new Ajv({ strict: false }); addFormats(ajv);
    for (const [path, schema] of [["history", historyResponse], ["forecast", forecastResponse]]) {
      const payload = (await get(`/api/v1/admin/finance/${path}`)).json();
      const validate = ajv.compile(schema);
      expect(validate(payload), JSON.stringify(validate.errors)).toBe(true);
      expect(validate({ ...payload, surprise: true })).toBe(false);
    }
  });
  it("rejects malformed backend money instead of coercing it into a valid report", async () => {
    const spy = vi.spyOn(db.prisma.order, "findMany").mockResolvedValueOnce([{ createdAt: new Date(), totalAmount: "300", items: [{ totalProfitSnapshot: 60 }] }]);
    try {
      const result = await get("/api/v1/admin/finance/history");
      expect(result.statusCode).toBe(500);
      expect(result.json()).toEqual({ error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected server error" } });
    } finally { spy.mockRestore(); }
  });
  it("rejects unexpected parameters and malformed page values with declared errors", async () => {
    for (const query of ["page=0", "page=1.5", "page=NaN", "page=100001", "interval=monthly", "surprise=1"]) {
      const result = await get(`/api/v1/admin/finance/history?${query}`);
      expect(result.statusCode).toBe(400);
      expect(result.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    }
    expect((await get("/api/v1/admin/finance/forecast?surprise=1")).statusCode).toBe(400);
  });
  it("protects both financial endpoints and returns a typed empty report", async () => {
    for (const path of ["history", "forecast"]) {
      const url = `/api/v1/admin/finance/${path}`;
      expect((await app.inject({ url })).statusCode).toBe(401);
      expect((await app.inject({ url, headers: { cookie: userCookie } })).statusCode).toBe(403);
      const result = await get(url);
      expect(result.statusCode).toBe(200);
      expect(result.headers["cache-control"]).toBe("no-store");
      expect(result.json().data).toMatchObject({ currency: "TOMAN", timeZone: "Asia/Tehran", dateBasis: "ORDER_CREATED_AT" });
    }
    const report = (await get("/api/v1/admin/finance/history")).json().data;
    expect(report.points).toHaveLength(7);
    expect(report.totals).toMatchObject({ turnover: 0, profit: null, orderCount: 0, unknownProfitItemCount: 0 });
    expect(report.pagination).toMatchObject({ page: 1, totalPages: 1, hasOlder: false, hasNewer: false });
  });
});
