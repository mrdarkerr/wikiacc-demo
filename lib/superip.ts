import type { Order } from "@/types/api";
import { orderNeedsShareBoxPolling } from "./sharebox";
export function walletCreditInput(username: string, value: string, minimum = 1000) {
  const normalized = value
    .replace(/[۰-۹]/g, (c) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(c)))
    .replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)));
  if (
    !/^[0-9]+$/.test(normalized) ||
    !/^[A-Za-z0-9][A-Za-z0-9_.-]{2,63}$/.test(username)
  )
    return null;
  const amount = Number(normalized);
  return Number.isSafeInteger(amount) && amount >= Math.max(1000, minimum) && amount <= 200000000
    ? { username: username.toLowerCase(), amount }
    : null;
}
export function orderNeedsFulfillmentPolling(order: Order) {
  if (
    order.paymentStatus !== "PAID" ||
    ["CANCELLED", "REFUNDED", "DELIVERED"].includes(order.status)
  )
    return false;
  return (
    order.items.some(
      (item) =>
        item.productTypeSnapshot === "SUPERIP_WALLET" &&
        (!item.superipFulfillment ||
          !["DELIVERED", "REVIEW_REQUIRED"].includes(
            item.superipFulfillment.status,
          )),
    ) || orderNeedsShareBoxPolling(order)
  );
}
export const superipStatusLabel = (status?: string) =>
  ({
    PENDING: "در صف شارژ",
    PROCESSING: "در حال شارژ",
    RETRY: "در انتظار تلاش مجدد",
    REVIEW_REQUIRED: "نیازمند بررسی پشتیبانی",
    DELIVERED: "شارژ انجام شد",
  })[status ?? ""] ?? "در انتظار شارژ";
