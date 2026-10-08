import { ApiError } from "./api-error";

export function checkoutPriceChange(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.status !== 409 || error.payload?.error?.code !== "PRICE_CHANGED") return null;
  const details = error.payload.error.details;
  if (!details || typeof details !== "object" || !("unitPrice" in details)) return null;
  const price = details.unitPrice;
  return typeof price === "number" && Number.isInteger(price) && price >= 0 && price <= 2147483647 ? price : null;
}
