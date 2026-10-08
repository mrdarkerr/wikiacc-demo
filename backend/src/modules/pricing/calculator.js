import { badRequest } from "../../shared/errors.js";

export const MAX_TOMAN = 2147483647; // Existing Prisma Int/SQLite money contract.
const SCALE = 1_000_000n;
const invalid = () => badRequest("PRICING_INPUT_INVALID", "Use non-negative decimal amounts within the supported precision");

export function normalizeAmount(value, precision = 6) {
  if (typeof value !== "string" && typeof value !== "number") throw invalid();
  const text = String(value).trim();
  const match = /^(\d{1,10})(?:\.(\d{1,6}))?$/.exec(text);
  if (!match || (match[2]?.length ?? 0) > precision) throw invalid();
  const integer = BigInt(match[1]).toString();
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}
function scaled(value, precision = 6) {
  const [integer, fraction = ""] = normalizeAmount(value, precision).split(".");
  return BigInt(integer) * SCALE + BigInt(fraction.padEnd(6, "0"));
}
const rounded = (numerator, denominator) => (numerator + denominator / 2n) / denominator;
function money(value) {
  if (value < 0n || value > BigInt(MAX_TOMAN)) throw badRequest("PRICING_AMOUNT_TOO_LARGE", "Amount exceeds supported toman range");
  return Number(value);
}
export function parseProfit(input = "") {
  if (typeof input !== "string" && typeof input !== "number") throw invalid();
  const text = String(input).trim();
  let profitType = "TOMAN", amount = text || "0";
  if (text.startsWith("$")) { profitType = "USD"; amount = text.slice(1); }
  else if (text.startsWith("%") || text.endsWith("%")) {
    profitType = "PERCENT"; amount = text.startsWith("%") ? text.slice(1) : text.slice(0, -1);
  }
  const profitValue = normalizeAmount(amount, profitType === "TOMAN" ? 0 : profitType === "PERCENT" ? 4 : 6);
  return { profitType, profitValue };
}
export function calculatePrice(product, rateToman, quantity = 1) {
  const currency = product.priceCurrency ?? "TOMAN";
  const profitType = product.profitType ?? "TOMAN";
  if (!["TOMAN", "USD"].includes(currency) || !["TOMAN", "USD", "PERCENT"].includes(profitType) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000) throw invalid();
  if ((currency === "USD" || profitType === "USD") && (!Number.isInteger(rateToman) || rateToman <= 0 || rateToman > MAX_TOMAN)) throw invalid();
  const basePrice = normalizeAmount(product.basePrice ?? product.price, currency === "TOMAN" ? 0 : 6);
  const profitValue = normalizeAmount(product.profitValue ?? "0", profitType === "TOMAN" ? 0 : profitType === "PERCENT" ? 4 : 6);
  const base = currency === "USD" ? rounded(scaled(basePrice) * BigInt(rateToman), SCALE) : scaled(basePrice) / SCALE;
  const profit = profitType === "USD" ? rounded(scaled(profitValue) * BigInt(rateToman), SCALE)
    : profitType === "PERCENT" ? rounded(base * scaled(profitValue), 100n * SCALE)
    : scaled(profitValue) / SCALE;
  const unit = base + profit;
  return {
    priceCurrency: currency, basePrice, profitType, profitValue,
    baseToman: money(base), profitToman: money(profit), unitPrice: money(unit),
    quantity, totalAmount: money(unit * BigInt(quantity)), totalProfit: money(profit * BigInt(quantity)),
  };
}
