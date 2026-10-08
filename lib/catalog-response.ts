import { ApiError } from "./api-error";
import type { Product } from "../types/api";

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const product = value as Record<string, unknown>;
  return typeof product.id === "string" && typeof product.slug === "string" && typeof product.title === "string"
    && ["INSTANT_DELIVERY", "CUSTOM_FORM", "SHAREBOX"].includes(String(product.type))
    && Number.isInteger(product.price) && typeof product.price === "number" && product.price >= 0 && product.price <= 2147483647
    && Array.isArray(product.fields) && Array.isArray(product.features);
}
function invalid(): never { throw new ApiError(502, "قیمت محصولات دریافت نشد؛ دوباره تلاش کنید.", { error: { code: "API_INVALID_RESPONSE", message: "قیمت محصولات دریافت نشد؛ دوباره تلاش کنید." } }); }
export function publicProductsResponse(value: unknown): { products: Product[] } {
  if (!value || typeof value !== "object" || !("products" in value) || !Array.isArray(value.products) || !value.products.every(isProduct)) return invalid();
  return { products: value.products };
}
export function publicProductResponse(value: unknown): { product: Product } {
  if (!value || typeof value !== "object" || !("product" in value) || !isProduct(value.product)) return invalid();
  return { product: value.product };
}
