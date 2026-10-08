import { badRequest } from "../../shared/errors.js";
import { calculatePrice, normalizeAmount, parseProfit } from "./calculator.js";
import { getEffectiveRate } from "../exchange-rates/service.js";

export function prepareProductPricing(input, current = null) {
  const currency = input.priceCurrency ?? current?.priceCurrency ?? "TOMAN";
  if (input.price !== undefined && (input.basePrice !== undefined || currency === "USD")) {
    throw badRequest("PRICING_LEGACY_AMBIGUOUS", "Use basePrice explicitly for dynamic prices; do not mix price and basePrice");
  }
  if (current && currency !== current.priceCurrency && input.basePrice === undefined) {
    throw badRequest("PRICING_BASE_REQUIRED", "Supply basePrice when changing priceCurrency");
  }
  const rawBase = input.basePrice ?? input.price ?? current?.basePrice ?? current?.price;
  if (rawBase === undefined) throw badRequest("PRICING_BASE_REQUIRED", "price or basePrice is required");
  const basePrice = normalizeAmount(rawBase, currency === "TOMAN" ? 0 : 6);
  const profit = input.profit === undefined ? { profitType: current?.profitType ?? "TOMAN", profitValue: current?.profitValue ?? "0" } : parseProfit(input.profit);
  return { priceCurrency: currency, basePrice, ...profit, price: currency === "TOMAN" ? Number(basePrice) : 0 };
}
export async function quoteProduct(prisma, product, quantity = 1) {
  const rate = await getEffectiveRate(prisma);
  return { ...calculatePrice(product, rate.rateToman, quantity), exchangeRate: rate };
}
export function adminProduct(product, rate) {
  return { ...product, pricing: { ...calculatePrice(product, rate.rateToman), exchangeRate: rate } };
}
const pick = (value, keys) => value && Object.fromEntries(keys.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
export function publicProduct(product, sellingPrice) {
  if (!product) return product;
  const result = pick(product, ["id", "categoryId", "deliveryPoolId", "slug", "title", "description", "type", "isActive", "archivedAt", "sortOrder", "createdAt", "updatedAt"]);
  result.price = sellingPrice;
  if (product.category !== undefined) result.category = pick(product.category, ["id", "slug", "title", "description", "isActive", "sortOrder"]);
  if (product.deliveryPool !== undefined) result.deliveryPool = pick(product.deliveryPool, ["id", "slug", "title", "description", "_count"]);
  if (product.features) result.features = product.features.map((f) => pick(f, ["id", "productId", "title", "sortOrder", "createdAt", "updatedAt"]));
  if (product.fields) result.fields = product.fields.map((f) => pick(f, ["id", "productId", "key", "label", "type", "required", "optionsJson", "sortOrder", "createdAt", "updatedAt"]));
  return result;
}
