import { describe, it, expect } from "vitest";

const load = () => import("../src/modules/pricing/calculator.js");
describe("exact pricing", () => {
  it("converts a USD base and percentage markup into integer toman for each unit", async () => {
    const { calculatePrice, parseProfit } = await load();
    const profit = parseProfit("%10");
    expect(profit).toEqual({ profitType: "PERCENT", profitValue: "10" });
    expect(calculatePrice({ priceCurrency: "USD", basePrice: "2.50", ...profit }, 270000, 3)).toMatchObject({
      baseToman: 675000, profitToman: 67500, unitPrice: 742500, totalAmount: 2227500, totalProfit: 202500,
    });
  });
  it.each([
    ["TOMAN", "TOMAN", "100000", "20000", 100000, 20000],
    ["TOMAN", "PERCENT", "100000", "10", 100000, 10000],
    ["TOMAN", "USD", "100000", "2", 100000, 540000],
    ["USD", "TOMAN", "2", "20000", 540000, 20000],
    ["USD", "PERCENT", "2", "10", 540000, 54000],
    ["USD", "USD", "2", "2", 540000, 540000],
  ])("calculates %s base and %s profit", async (priceCurrency, profitType, basePrice, profitValue, baseToman, profitToman) => {
    const { calculatePrice } = await load();
    expect(calculatePrice({ priceCurrency, profitType, basePrice, profitValue }, 270000, 2)).toMatchObject({ baseToman, profitToman, unitPrice: baseToman + profitToman, totalProfit: profitToman * 2 });
  });
  it("rounds half-up per unit before multiplying quantity", async () => {
    const { calculatePrice } = await load();
    expect(calculatePrice({ priceCurrency: "USD", basePrice: "0.000005", profitType: "PERCENT", profitValue: "50" }, 100000, 3)).toMatchObject({ baseToman: 1, profitToman: 1, unitPrice: 2, totalAmount: 6 });
  });
  it("supports legacy zero-margin products without an exchange rate", async () => {
    const { calculatePrice } = await load();
    expect(calculatePrice({ price: 100 }, null)).toMatchObject({ unitPrice: 100, profitToman: 0 });
    expect(calculatePrice({ price: 0 }, null).unitPrice).toBe(0);
  });
  it("parses each notation and normalizes decimal values", async () => {
    const { parseProfit } = await load();
    for (const [input, profitType, profitValue] of [["", "TOMAN", "0"], ["1000", "TOMAN", "1000"], ["10%", "PERCENT", "10"], ["$2.500000", "USD", "2.5"], [0, "TOMAN", "0"]]) {
      expect(parseProfit(input)).toEqual({ profitType, profitValue });
    }
  });
  it("rejects ambiguous, negative, exponent and overprecision input", async () => {
    const { parseProfit, calculatePrice } = await load();
    for (const input of ["$", "%", "10%%", "%10%", "$-2", "-10", "1e3", "NaN", "1.5", "%1.00001", "$1.0000001", {}, null]) expect(() => parseProfit(input)).toThrow();
    for (const quantity of [0, -1, 1.5, 10001]) expect(() => calculatePrice({ price: 1 }, null, quantity)).toThrow();
    expect(() => calculatePrice({ basePrice: "2", priceCurrency: "USD" }, 0)).toThrow();
    expect(() => calculatePrice({ price: 2147483647, profitValue: "1" }, null)).toThrow();
    expect(() => calculatePrice({ price: 2147483647 }, null, 2)).toThrow();
  });
  it("accepts exact money and quantity boundaries", async () => {
    const { calculatePrice } = await load();
    expect(calculatePrice({ price: 2147483647 }, null).unitPrice).toBe(2147483647);
    expect(calculatePrice({ price: 1 }, null, 10000).totalAmount).toBe(10000);
    expect(() => calculatePrice({ basePrice: "2147483648" }, null)).toThrow();
  });
});
