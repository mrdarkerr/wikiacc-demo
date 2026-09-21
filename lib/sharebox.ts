import type {
  Order,
  OrderItem,
  ShareBoxFulfillmentStatus,
} from "@/types/api";

const terminalFulfillmentStatuses = new Set<ShareBoxFulfillmentStatus>([
  "DELIVERED",
  "REVIEW_REQUIRED",
]);

export const shareBoxFulfillmentLabels: Record<
  ShareBoxFulfillmentStatus,
  string
> = {
  DELIVERED: "تحویل شده",
  PENDING: "در صف صدور",
  PROCESSING: "در حال صدور",
  RETRY: "در انتظار تلاش مجدد",
  REVIEW_REQUIRED: "نیازمند بررسی",
};

const safeErrorLabels: Record<string, string> = {
  CAPACITY_UNAVAILABLE: "ظرفیت دسته شیر‌باکس تکمیل شده است؛ صدور پس از آزاد شدن ظرفیت دوباره بررسی می‌شود.",
  API_KEY_INVALID: "کلید API شیر‌باکس معتبر نیست.",
  API_KEY_REVOKED: "کلید API شیر‌باکس لغو شده است.",
  AUTH_REQUIRED: "شیر‌باکس درخواست را بدون مجوز معتبر رد کرد.",
  CATEGORY_NOT_FOUND: "دسته انتخاب‌شده در شیر‌باکس پیدا نشد.",
  CATEGORY_ALLOCATION_DISABLED: "صدور لایسنس برای این دسته در شیر‌باکس غیرفعال است.",
  EXTERNAL_ID_CONFLICT: "اطلاعات درخواست قبلی با این واحد سفارش هم‌خوان نیست.",
  LICENSE_KEY_REPLACED: "کلید لایسنس در شیر‌باکس تغییر کرده و نیازمند بررسی است.",
  NO_AVAILABLE_LICENSE: "در حال حاضر لایسنس آماده‌ای در این دسته وجود ندارد.",
  ORDER_NO_LONGER_ELIGIBLE: "این سفارش دیگر شرایط صدور خودکار را ندارد.",
  RATE_LIMITED: "سرویس موقتاً تعداد درخواست‌ها را محدود کرده است.",
  SHAREBOX_DISABLED: "اتصال شیر‌باکس غیرفعال است.",
  SHAREBOX_CONFIGURATION_CHANGED: "تنظیم اتصال پس از ثبت سفارش تغییر کرده و نیازمند تطبیق دستی است.",
  SHAREBOX_INVALID_RESPONSE: "پاسخ شیر‌باکس قابل پردازش نبود.",
  SHAREBOX_NOT_CONFIGURED: "اتصال شیر‌باکس کامل پیکربندی نشده است.",
  SHAREBOX_REQUEST_FAILED: "ارتباط با شیر‌باکس کامل نشد.",
  SHAREBOX_UNAVAILABLE: "شیر‌باکس موقتاً در دسترس نیست.",
  SHAREBOX_TIMEOUT: "پاسخ شیر‌باکس در زمان مقرر دریافت نشد.",
  RESOURCE_NOT_FOUND: "منبع مربوط به این صدور در شیر‌باکس پیدا نشد.",
  VALIDATION_ERROR: "اطلاعات صدور توسط شیر‌باکس پذیرفته نشد.",
};

export function shareBoxFulfillmentErrorLabel(code: string | null) {
  if (!code) return null;
  return safeErrorLabels[code] ?? "صدور لایسنس با خطا روبه‌رو شده و نیازمند بررسی است.";
}

export function isShareBoxItem(item: OrderItem) {
  return item.productTypeSnapshot === "SHAREBOX";
}

export function shareBoxItemNeedsPolling(item: OrderItem) {
  if (!isShareBoxItem(item) || item.deliveries.length >= item.quantity) {
    return false;
  }

  const fulfillments = item.shareboxFulfillments ?? [];
  if (fulfillments.length < item.quantity) return true;

  return fulfillments.some(
    (fulfillment) => !terminalFulfillmentStatuses.has(fulfillment.status),
  );
}

export function orderNeedsShareBoxPolling(order: Order) {
  if (
    order.paymentStatus !== "PAID" ||
    order.status === "CANCELLED" ||
    order.status === "REFUNDED"
  ) {
    return false;
  }

  return order.items.some(shareBoxItemNeedsPolling);
}

export function orderHasShareBoxItems(order: Order) {
  return order.items.some(isShareBoxItem);
}
