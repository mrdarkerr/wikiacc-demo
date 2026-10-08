import { publicProduct } from "./service.js";

export function pricingSnapshot(pricing) {
  return {
    priceSnapshot: pricing.unitPrice,
    priceCurrencySnapshot: pricing.priceCurrency, basePriceSnapshot: pricing.basePrice,
    profitTypeSnapshot: pricing.profitType, profitValueSnapshot: pricing.profitValue,
    exchangeRateSnapshot: pricing.exchangeRate.rateToman,
    rateSourceSnapshot: pricing.exchangeRate.source, rateFetchedAtSnapshot: pricing.exchangeRate.fetchedAt,
    baseTomanSnapshot: pricing.baseToman, profitTomanSnapshot: pricing.profitToman, totalProfitSnapshot: pricing.totalProfit,
  };
}
const pick = (object, keys) => Object.fromEntries(keys.filter((key) => object[key] !== undefined).map((key) => [key, object[key]]));
export function publicOrder(order) {
  if (!order) return order;
  const result = pick(order, ["id", "userId", "walletTransactionId", "status", "paymentStatus", "paymentMethod", "totalAmount", "note", "createdAt", "updatedAt", "tickets"]);
  if (order.items) result.items = order.items.map((item) => ({
    ...pick(item, ["id", "orderId", "productId", "titleSnapshot", "priceSnapshot", "productTypeSnapshot", "quantity", "createdAt", "fieldValues", "deliveries", "shareboxFulfillments"]),
    ...(item.product ? { product: publicProduct(item.product, item.priceSnapshot) } : {}),
  }));
  return result;
}
