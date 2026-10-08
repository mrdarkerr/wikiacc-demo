import { describe, expect, it } from "../backend/node_modules/vitest";
import { draftPricing, profitInput, pricingError } from "../lib/pricing";
import { ApiError } from "../lib/api";
import { checkoutPriceChange } from "../lib/checkout";

describe("pricing form and response adapters", () => {
  it("reads only validated final unit prices from a checkout conflict, including zero", () => {
    for (const unitPrice of [0, 200000]) expect(checkoutPriceChange(new ApiError(409, "changed", { error: { code: "PRICE_CHANGED", message: "changed", details: { unitPrice } } }))).toBe(unitPrice);
    for (const unitPrice of [-1, "100", 1.5, undefined]) expect(checkoutPriceChange(new ApiError(409, "changed", { error: { code: "PRICE_CHANGED", message: "changed", details: { unitPrice } } }))).toBeNull();
  });
  it("restores all persisted profit modes including zero without reading a sale quote", () => {
    expect(profitInput({ profitType: "TOMAN", profitValue: "0" })).toBe("0");
    expect(profitInput({ profitType: "PERCENT", profitValue: "10.5" })).toBe("%10.5");
    expect(profitInput({ profitType: "USD", profitValue: "2.500001" })).toBe("$2.500001");
  });
  it.each(["%10%", "$-1", "-1", "%1.12345", "$1.1234567"])("rejects invalid profit %s before preview", (profit) => {
    expect(draftPricing({ priceCurrency: "TOMAN", basePrice: "100000", profit }).input).toBeNull();
  });
  it("returns clear session, permission, amount and connection errors", () => {
    expect(pricingError(new ApiError(401, "Authentication is required"))).toContain("وارد");
    expect(pricingError(new ApiError(403, "Access is denied"))).toContain("مدیریتی");
    expect(pricingError(new ApiError(400, "Amount exceeds storage limit", { error: { code: "PRICING_AMOUNT_TOO_LARGE", message: "Amount exceeds storage limit" } }))).toContain("سقف");
  });
  it("normalizes Persian digits while retaining exact USD decimals and zero profit", () => {
    expect(draftPricing({ priceCurrency: "USD", basePrice: "۲٫۵۰۰۰۰۱", profit: "%۰" })).toEqual({
      input: { priceCurrency: "USD", basePrice: "2.500001", profit: "%0", quantity: 1 }, error: "",
    });
    expect(draftPricing({ priceCurrency: "TOMAN", basePrice: "۱۸۰٬۰۰۰", profit: "" }).input)
      .toMatchObject({ basePrice: "180000", profit: "" });
  });
});
