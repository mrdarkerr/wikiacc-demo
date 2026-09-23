import { categoryFields, configurationFingerprint, getTelegramSettings } from "./settings.js";
import { TELEGRAM_EVENTS as E } from "./constants.js";

const statuses = {
  DRAFT: "پیش‌نویس", PENDING_INFO: "منتظر اطلاعات مشتری", AWAITING_ADMIN: "نیازمند اقدام ادمین",
  READY: "در صف تحویل", DELIVERED: "تحویل شده", CANCELLED: "لغو شده", REFUNDED: "بازپرداخت شده",
};
const clean = (value, length = 180) => String(value ?? "").replace(/[\r\n\u0000-\u001f\u202a-\u202e\u2066-\u2069]/g, " ").slice(0, length);
const paymentCodes = new Set([
  "JIBIT_INQUIRY_INVALID", "JIBIT_INVALID_RESPONSE", "JIBIT_REQUEST_FAILED", "JIBIT_TOKEN_INVALID",
  "JIBIT_UNAVAILABLE", "JIBIT_PURCHASE_ID_MISSING", "JIBIT_RECONCILE_FAILED", "JIBIT_NOT_CONFIGURED",
  "JIBIT_INIT_FAILED", "JIBIT_PAYMENT_STATE_CONFLICT", "JIBIT_PAYMENT_MISMATCH", "JIBIT_PURCHASE_INVALID",
]);

// Domain code supplies an existing transaction for committed events. No network I/O here.
export async function enqueueTelegramEvent(tx, { eventType, category, key, text, referenceType, referenceId }) {
  const settings = await getTelegramSettings(tx);
  if (!settings?.enabled || !settings[categoryFields[category]]) return null;
  return tx.telegramQueueJob.upsert({
    where: { dedupeKey: `${eventType}:${key}` }, update: {},
    create: {
      eventType, category, dedupeKey: `${eventType}:${key}`, messageText: text.slice(0, 3500),
      referenceType, referenceId, configFingerprint: configurationFingerprint(settings),
    },
  });
}

export async function notifyOrder(tx, orderId, eventType = E.ORDER_PAID, previousStatus) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, status: true, paymentStatus: true, paymentMethod: true, totalAmount: true,
      items: { select: { titleSnapshot: true, quantity: true } } },
  });
  if (!order || order.paymentStatus !== "PAID" || previousStatus === order.status) return null;
  if (eventType === E.ORDER_STATUS_CHANGED) {
    if (order.status === "DELIVERED") eventType = E.ORDER_DELIVERED;
    else if (!["AWAITING_ADMIN", "PENDING_INFO", "READY", "CANCELLED"].includes(order.status)) return null;
  }
  const title = eventType === E.ORDER_PAID
    ? order.status === "DELIVERED" ? "✅ خرید و تحویل موفق" : "🛒 خرید قطعی"
    : eventType === E.ORDER_DELIVERED ? "✅ تحویل سفارش" : "📋 تغییر وضعیت سفارش";
  return enqueueTelegramEvent(tx, {
    category: "ORDER", eventType,
    key: eventType === E.ORDER_STATUS_CHANGED ? `${order.id}:${order.status}` : order.id,
    referenceType: "ORDER", referenceId: order.id,
    text: [title, `سفارش: ${order.id}`, `مشتری: ${order.userId}`,
      ...order.items.slice(0, 10).map((item) => `${clean(item.titleSnapshot)} × ${item.quantity}`),
      `مبلغ: ${order.totalAmount.toLocaleString("fa-IR")} تومان`,
      `روش پرداخت: ${order.paymentMethod === "JIBIT" ? "درگاه جیبیـت" : "کیف پول"}`,
      `وضعیت: ${statuses[order.status] ?? order.status}`].join("\n"),
  });
}

export function notifyTicket(tx, ticket, messageId, isNew = false) {
  return enqueueTelegramEvent(tx, {
    category: "TICKET", eventType: isNew ? E.TICKET_CREATED : E.TICKET_CUSTOMER_REPLY,
    key: messageId, referenceType: "TICKET", referenceId: ticket.id,
    text: [isNew ? "🎫 تیکت جدید" : "💬 پیام جدید مشتری", `تیکت: ${ticket.id}`,
      `مشتری: ${ticket.userId}`, `اولویت: ${{ LOW: "کم", NORMAL: "عادی", HIGH: "بالا", URGENT: "فوری" }[ticket.priority] ?? ticket.priority}`,
      ...(ticket.orderId ? [`سفارش مرتبط: ${ticket.orderId}`] : []),
      "برای مشاهده موضوع و متن، وارد پنل شوید."].join("\n"),
  });
}

export function notifyPayment(tx, attempt, eventType, errorCode) {
  const code = paymentCodes.has(errorCode) ? errorCode : "JIBIT_REQUEST_FAILED";
  const review = eventType === E.PAYMENT_REVIEW_REQUIRED;
  return enqueueTelegramEvent(tx, {
    category: "PAYMENT", eventType,
    // One technical alert per stage/attempt, not per repeated callback or polling cycle.
    key: attempt.id, referenceType: "ORDER", referenceId: attempt.orderId,
    text: [review ? "🚨 پرداخت نیازمند بررسی" : "⚠️ اختلال ارتباط یا پردازش درگاه",
      `سفارش: ${attempt.orderId}`, `تلاش پرداخت: ${attempt.id}`, `کد: ${code}`,
      "این هشدار به‌تنهایی نشانهٔ برداشت یا عدم برداشت وجه نیست؛ وضعیت تراکنش را در پنل بررسی کنید."].join("\n"),
  });
}

export async function notifyFulfillmentReview(tx, job) {
  const item = await tx.orderItem.findUnique({ where: { id: job.orderItemId }, select: { orderId: true } });
  if (!item) return null;
  return enqueueTelegramEvent(tx, {
    category: "FULFILLMENT", eventType: E.SHAREBOX_REVIEW_REQUIRED, key: job.id,
    referenceType: "ORDER", referenceId: item.orderId,
    text: `🚨 تحویل ShareBox نیازمند بررسی\nسفارش: ${item.orderId}\nشناسهٔ تحویل: ${job.id}\nتحویل خودکار متوقف شده است؛ جزئیات را در پنل بررسی کنید.`,
  });
}

// Technical failures occur outside the business transaction; alert failures must not replace the original error.
export async function notifyPaymentFailure(prisma, attempt, eventType, errorCode, logger) {
  try { await notifyPayment(prisma, attempt, eventType, errorCode); }
  catch { logger?.warn?.({ attemptId: attempt.id }, "Could not persist Telegram payment alert"); }
}
