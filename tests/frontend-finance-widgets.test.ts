import { describe, expect, it } from "../backend/node_modules/vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FinanceHistoryPanel, FinanceForecastPanel } from "../components/admin/finance-dashboard";
import { history, forecast } from "../backend/src/modules/finance/service.js";
import { zGetFinanceHistoryResponse, zGetFinanceForecastResponse } from "../lib/generated/finance/zod.gen";
const emptyDb = { order: { findFirst: async () => null, findMany: async () => [] } };
describe("financial dashboard presentation", () => {
  it("labels both turnover and known profit, explicit weekly ranges and pagination", async () => {
    const report = zGetFinanceHistoryResponse.parse({ data: await history(emptyDb, { interval: "weekly" }, new Date("2026-10-10T10:00:00Z")) }).data;
    const html = renderToStaticMarkup(createElement(FinanceHistoryPanel, { report, pending: false, interval: "weekly", onInterval: () => {}, onPage: () => {} }));
    expect(html).toContain("گردش مالی"); expect(html).toContain("سود فروش");
    expect(html).toContain("بازه‌های قدیمی‌تر"); expect(html).toContain("بازه‌های جدیدتر");
    expect(html).toContain("از "); expect(html).toContain(" تا ");
    expect(html).toContain("در حال تکمیل"); expect(html).toContain("نامشخص");
    expect(html).toContain('dir="ltr"');
    expect(html).toContain("نمودار را افقی بکشید");
  });
  it("marks partial margin coverage visibly, not only in a tooltip", async () => {
    const report = zGetFinanceHistoryResponse.parse({ data: { ...await history(emptyDb), totals: { turnover: 900, profit: 60, orderCount: 3, knownProfitItemCount: 2, unknownProfitItemCount: 1 } } }).data;
    const html = renderToStaticMarkup(createElement(FinanceHistoryPanel, { report, pending: false, interval: "daily", onInterval: () => {}, onPage: () => {} }));
    expect(html).toContain("سود ثبت‌شدهٔ بخشی از فروش");
    expect(html).toContain("سابقهٔ سود ندارند");
    expect(html).toContain("سود خالص");
  });
  it("renders forecast horizons separately and explains insufficient data without zero estimates", async () => {
    const report = zGetFinanceForecastResponse.parse({ data: await forecast(emptyDb) }).data;
    const html = renderToStaticMarkup(createElement(FinanceForecastPanel, { report }));
    expect(html).toContain("پیش‌بینی درآمد مالی"); expect(html).toContain("۷ روز آینده"); expect(html).toContain("۳۰ روز آینده");
    expect(html).toContain("دادهٔ کافی"); expect(html).toContain("گردش مالی"); expect(html).toContain("سود فروش");
    expect(html).toContain("تضمین");
  });
});
