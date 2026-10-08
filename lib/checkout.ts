import { ApiError } from "./api-error";

export function checkoutWalletBalance(value: unknown): number | null {
  if (!value || typeof value !== "object" || !("wallet" in value)) return null;
  const wallet = value.wallet;
  if (!wallet || typeof wallet !== "object" || !("balance" in wallet)) return null;
  const balance = wallet.balance;
  return typeof balance === "number" && Number.isInteger(balance) && balance >= 0 && balance <= 2147483647 ? balance : null;
}

export function checkoutPriceChange(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.status !== 409 || error.payload?.error?.code !== "PRICE_CHANGED") return null;
  const details = error.payload.error.details;
  if (!details || typeof details !== "object" || !("unitPrice" in details)) return null;
  const price = details.unitPrice;
  return typeof price === "number" && Number.isInteger(price) && price >= 0 && price <= 2147483647 ? price : null;
}
