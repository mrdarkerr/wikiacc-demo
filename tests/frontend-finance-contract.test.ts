import { describe, expect, it } from "../backend/node_modules/vitest";
import { history, forecast } from "../backend/src/modules/finance/service.js";
import { zGetFinanceHistoryResponse, zGetFinanceForecastResponse } from "../lib/generated/finance/zod.gen";
const prisma = { order: { findFirst: async () => null, findMany: async () => [] } };
describe("generated financial response contract", () => {
  it("accepts real backend output with explicit nullable money", async () => {
    const actual = { data: await history(prisma) };
    expect(zGetFinanceHistoryResponse.parse(actual)).toEqual(actual);
    expect(zGetFinanceForecastResponse.parse({ data: await forecast(prisma) })).toHaveProperty("data.status", "INSUFFICIENT_DATA");
  });
  it("rejects unexpected fields rather than silently stripping them", async () => {
    const actual = { data: await history(prisma) };
    expect(zGetFinanceHistoryResponse.safeParse({ ...actual, surprise: true }).success).toBe(false);
    expect(zGetFinanceHistoryResponse.safeParse({ data: { ...actual.data, surprise: true } }).success).toBe(false);
    expect(zGetFinanceHistoryResponse.safeParse({ data: { ...actual.data, totals: { ...actual.data.totals, profit: "0" } } }).success).toBe(false);
  });
});
