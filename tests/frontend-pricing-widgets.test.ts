import { describe, expect, it } from "../backend/node_modules/vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PricingBreakdown, RateSummary } from "../components/admin/pricing-widgets";
import { ProductPricingSection } from "../components/admin/product-pricing-section";
import { OrderFinancialSnapshot } from "../components/admin/order-financial-snapshot";
import type { AdminOrderItem, ExchangeRate, PricingQuote } from "../types/api";
const exchangeRate: ExchangeRate = { rateToman: 270000, source: "DEFAULT", symbol: "USDTTMN", status: "DEFAULT", stale: true, fetchedAt: null,
  lastAttemptAt: null, lastSuccessAt: null, lastErrorCode: null, staleAfterSeconds: 300 };
const quote: PricingQuote = { priceCurrency: "USD", basePrice: "2.5", profitType: "PERCENT", profitValue: "10", baseToman: 675000, profitToman: 67500,
  unitPrice: 742500, quantity: 1, totalAmount: 742500, totalProfit: 67500, exchangeRate };
describe("admin pricing display states", () => {
  it("shows frozen admin financial values and does not invent history for null snapshots", () => {
    const item: AdminOrderItem = { id: "financial", titleSnapshot: "Sample", productTypeSnapshot: "CUSTOM_FORM", priceSnapshot: quote.unitPrice, quantity: 2, fieldValues: [], deliveries: [],
      priceCurrencySnapshot: "USD", basePriceSnapshot: "2.5", profitTypeSnapshot: "PERCENT", profitValueSnapshot: "10", exchangeRateSnapshot: 270000,
      rateSourceSnapshot: "DEFAULT", rateFetchedAtSnapshot: null, baseTomanSnapshot: quote.baseToman, profitTomanSnapshot: quote.profitToman, totalProfitSnapshot: quote.profitToman * 2 };
    const html = renderToStaticMarkup(createElement(OrderFinancialSnapshot, { items: [item] }));
    expect(html).toContain("سود ثبت‌شده برای کل تعداد");
    expect(html).toContain((quote.profitToman * 2).toLocaleString("fa-IR"));
    expect(html).toContain("سود خالص تحقق‌یافته نیست");
    const historical = renderToStaticMarkup(createElement(OrderFinancialSnapshot, { items: [{ ...item, baseTomanSnapshot: null, totalProfitSnapshot: null }] }));
    expect(historical).toContain("دادهٔ مالی زمان ثبت در دسترس نیست");
  });
  it("renders separate currency, exact base and single profit fields with a server preview", () => {
    const html = renderToStaticMarkup(createElement(ProductPricingSection, { form: { priceCurrency: "USD", basePrice: "2.5", profit: "%10" }, onChange: () => {}, preview: { pricing: quote, pending: false, error: "", refresh: () => {} }, disabled: false }));
    expect(html).toContain("معیار قیمت پایه");
    expect(html).toContain('name="basePrice"');
    expect(html).toContain('name="profit"');
    expect(html).toContain("قیمت نهایی مشتری");
  });
  it("labels base, internal profit and customer final sale separately using backend amounts", () => {
    const html = renderToStaticMarkup(createElement(PricingBreakdown, { pricing: quote }));
    expect(html).toContain("قیمت نهایی مشتری");
    expect(html).toContain("سود هر واحد");
    expect(html).toContain("۷۴۲٬۵۰۰");
    expect(html).toContain("۶۷٬۵۰۰");
  });
  it.each(["FRESH", "STALE", "FALLBACK", "DEFAULT"] as const)("distinguishes rate state %s and never implies a fallback is a fresh Wallex quote", (status) => {
    const html = renderToStaticMarkup(createElement(RateSummary, { rate: { ...exchangeRate, status } }));
    const labels = { FRESH: "به‌روز", STALE: "قدیمی", FALLBACK: "نرخ جایگزین", DEFAULT: "پیش‌فرض" };
    expect(html).toContain(labels[status]);
    expect(html).toContain("تتر / تومان");
  });
});
