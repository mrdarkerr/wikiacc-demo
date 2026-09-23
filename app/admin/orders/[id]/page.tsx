"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RotateCcw, Save } from "lucide-react";

import { DeliveryContentList } from "@/components/order-delivery-content";
import { itemDeliveryContents } from "@/lib/sharebox";
import {
  formatCurrency,
  formatDate,
  orderCode,
  productTypeLabel,
  userLabel,
} from "@/components/admin/admin-formatters";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import {
  shareBoxFulfillmentErrorLabel,
  shareBoxFulfillmentLabels,
} from "@/lib/sharebox";
import type { AdminOrder, OrderStatus } from "@/types/api";

const orderStatuses: OrderStatus[] = [
  "DRAFT",
  "PENDING_INFO",
  "AWAITING_ADMIN",
  "READY",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

const paymentAttemptLabels = {
  CREATED: "در حال ایجاد",
  PENDING: "در انتظار تأیید",
  SUCCESSFUL: "موفق",
  FAILED: "ناموفق",
  EXPIRED: "منقضی",
  REVIEW_REQUIRED: "نیازمند بررسی دستی",
} as const;

const statusLabels: Record<OrderStatus, string> = {
  AWAITING_ADMIN: "در انتظار ادمین",
  CANCELLED: "لغو شده",
  DELIVERED: "تحویل شده",
  DRAFT: "پیش نویس",
  PENDING_INFO: "نیازمند اطلاعات",
  READY: "آماده تحویل",
  REFUNDED: "مسترد",
};

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات سفارش انجام نشد.";
}

function shareBoxRetryErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "ثبت تلاش مجدد انجام نشد.";
  const code = error.payload?.error?.code;
  const labels: Record<string, string> = {
    SHAREBOX_DISABLED: "اتصال شیر‌باکس غیرفعال است.",
    SHAREBOX_CONFIGURATION_CHANGED:
      "این سفارش با کلید یا نشانی قبلی ثبت شده و نیازمند تطبیق دستی است؛ بازپخش خودکار امن نیست.",
    SHAREBOX_NOT_CONFIGURED: "اتصال شیر‌باکس کامل پیکربندی نشده است.",
    SHAREBOX_ORDER_NOT_ELIGIBLE: "این سفارش شرایط تلاش مجدد خودکار را ندارد.",
    SHAREBOX_UNAVAILABLE: "شیر‌باکس موقتاً در دسترس نیست.",
  };
  return (code && labels[code]) || error.message;
}

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [status, setStatus] = useState<OrderStatus>("AWAITING_ADMIN");
  const [adminNote, setAdminNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [retryingShareBox, setRetryingShareBox] = useState(false);
  const [shareBoxRetryMessage, setShareBoxRetryMessage] = useState("");
  const [shareBoxRetryError, setShareBoxRetryError] = useState("");
  const [shareBoxRefreshError, setShareBoxRefreshError] = useState("");

  async function loadOrder() {
    const result = await api.admin.orders.get(orderId);
    setOrder(result.order);
    setStatus(result.order.status);
    setAdminNote(result.order.adminNote ?? "");
  }

  useEffect(() => {
    let active = true;

    api.admin.orders
      .get(orderId)
      .then((result) => {
        if (!active) return;
        setOrder(result.order);
        setStatus(result.order.status);
        setAdminNote(result.order.adminNote ?? "");
        setError("");
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId]);

  const fieldValues = useMemo(
    () => order?.items.flatMap((item) => item.fieldValues) ?? [],
    [order],
  );

  const deliveries = useMemo(
    () => order?.items.flatMap(itemDeliveryContents) ?? [],
    [order],
  );
  const latestPaymentAttempt = order?.paymentAttempts[0];
  const hasShareBoxItems = Boolean(
    order?.items.some((item) => item.productTypeSnapshot === "SHAREBOX"),
  );
  const hasRetryableShareBoxFulfillments = Boolean(
    order?.items.some((item) =>
      item.shareboxFulfillments?.some((fulfillment) =>
        ["RETRY", "REVIEW_REQUIRED"].includes(fulfillment.status),
      ),
    ),
  );
  const directStatusLocked = Boolean(
    order?.paymentMethod === "JIBIT" &&
      order.paymentStatus === "UNPAID" &&
      latestPaymentAttempt &&
      ["CREATED", "PENDING", "REVIEW_REQUIRED"].includes(
        latestPaymentAttempt.status,
      ),
  );

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!order) return;

    setSaving(true);
    try {
      await api.admin.orders.updateStatus(order.id, {
        adminNote: adminNote.trim() ? adminNote.trim() : null,
        status,
      });
      await loadOrder();
      setMessage("وضعیت سفارش به روز شد.");
      setError("");
    } catch (updateError) {
      setError(errorMessage(updateError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function refundOrder() {
    if (!order) return;

    setSaving(true);
    try {
      await api.admin.orders.refund(order.id, {
        note: adminNote.trim() ? adminNote.trim() : "بازگشت وجه از پنل مدیریت",
      });
      await loadOrder();
      setMessage("بازگشت وجه سفارش ثبت شد.");
      setError("");
    } catch (refundError) {
      setError(errorMessage(refundError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function retryShareBox() {
    if (!order) return;

    setRetryingShareBox(true);
    setShareBoxRetryError("");
    setShareBoxRefreshError("");
    try {
      const result = await api.admin.orders.retryShareBox(order.id);
      setShareBoxRetryMessage(
        result.queued > 0
          ? `${result.queued.toLocaleString("fa-IR")} واحد برای تلاش مجدد در صف پذیرفته شد؛ این پیام به معنی تحویل لایسنس نیست.`
          : "درخواست پذیرفته شد، اما واحد قابل صف‌بندی پیدا نشد. وضعیت فعلی را بررسی کنید.",
      );

      try {
        await loadOrder();
      } catch {
        setShareBoxRefreshError(
          "درخواست تلاش مجدد ثبت شد، اما دریافت وضعیت تازه سفارش انجام نشد.",
        );
      }
    } catch (retryError) {
      setShareBoxRetryMessage("");
      setShareBoxRetryError(shareBoxRetryErrorMessage(retryError));
    } finally {
      setRetryingShareBox(false);
    }
  }

  if (loading) {
    return <AdminState>در حال دریافت سفارش...</AdminState>;
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/admin/orders">
            <ArrowRight className="size-4" />
            بازگشت به سفارش‌ها
          </Link>
        </Button>
        <AdminState tone="danger">{error || "سفارش پیدا نشد."}</AdminState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/orders">
              <ArrowRight className="size-4" />
              سفارش‌ها
            </Link>
          </Button>
          <h2 className="mt-2 text-2xl font-bold" dir="ltr">
            {orderCode(order.id)}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminStatusBadge type="payment" value={order.paymentStatus} />
          <AdminStatusBadge type="order" value={order.status} />
        </div>
      </div>

      {message ? <AdminState tone="success">{message}</AdminState> : null}
      {error ? <AdminState tone="danger">{error}</AdminState> : null}
      {shareBoxRetryMessage ? (
        <AdminState tone="success">{shareBoxRetryMessage}</AdminState>
      ) : null}
      {shareBoxRetryError ? (
        <AdminState tone="danger">{shareBoxRetryError}</AdminState>
      ) : null}
      {shareBoxRefreshError ? (
        <AdminState tone="danger">{shareBoxRefreshError}</AdminState>
      ) : null}
      {latestPaymentAttempt?.status === "REVIEW_REQUIRED" ? (
        <AdminState tone="danger">
          پرداخت جیبیت به‌دلیل عدم تطبیق اطلاعات نیازمند بررسی دستی است. تا پیش از
          تطبیق مبلغ و شناسه‌های جیبیت، سفارش را تحویل ندهید.
        </AdminState>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">کاربر</p>
          <p className="mt-2 font-medium">{userLabel(order.user)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">مبلغ</p>
          <p className="mt-2 text-lg font-bold">
            {formatCurrency(order.totalAmount)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">روش پرداخت</p>
          <p className="mt-2 font-medium">
            {order.paymentMethod === "JIBIT" ? "درگاه جیبیت" : "کیف پول"}
          </p>
          {latestPaymentAttempt ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {paymentAttemptLabels[latestPaymentAttempt.status]}
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">فرم‌های ارسالی</p>
          <p className="mt-2 text-lg font-bold">{fieldValues.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">تاریخ ثبت</p>
          <p className="mt-2 font-medium">{formatDate(order.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <AdminSection title="اطلاعات سفارش">
          <div className="space-y-5">
            {order.items.map((item) => (
              <article
                className="rounded-md border border-border p-4"
                key={item.id}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-bold">{item.titleSnapshot}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {productTypeLabel(item.productTypeSnapshot)} - تعداد{" "}
                      {item.quantity}
                    </p>
                  </div>
                  <p className="font-medium">
                    {formatCurrency(item.priceSnapshot)}
                  </p>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-semibold">فیلدهای سفارش</h4>
                  {item.fieldValues.length ? (
                    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                      {item.fieldValues.map((field) => (
                        <div
                          className="rounded-md bg-muted/50 p-3"
                          key={field.id}
                        >
                          <dt className="text-xs text-muted-foreground">
                            {field.labelSnapshot}
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-medium [overflow-wrap:anywhere]">
                            {field.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      برای این آیتم فیلدی ثبت نشده است.
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-semibold">اطلاعات تحویل</h4>
                  {item.deliveries.length ? (
                    <DeliveryContentList
                      className="mt-3"
                      deliveries={itemDeliveryContents(item)}
                    />
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      تحویلی برای این آیتم ثبت نشده است.
                    </p>
                  )}
                </div>

                {item.productTypeSnapshot === "SHAREBOX" ? (
                  <div className="mt-4 border-t border-border pt-4">
                    <h4 className="text-sm font-semibold">وضعیت صدور شیر‌باکس</h4>
                    {item.shareboxFulfillments?.length ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {item.shareboxFulfillments.map((fulfillment) => {
                          const safeError = shareBoxFulfillmentErrorLabel(
                            fulfillment.lastErrorCode,
                          );
                          return (
                            <div
                              className="rounded-md bg-muted/50 p-3 text-xs"
                              key={fulfillment.id}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium">
                                  واحد {fulfillment.unitIndex.toLocaleString("fa-IR")}
                                </span>
                                <AdminStatusBadge value={fulfillment.status} />
                              </div>
                              <p className="mt-2 text-muted-foreground">
                                {shareBoxFulfillmentLabels[fulfillment.status]} · تلاش‌ها: {fulfillment.attempts.toLocaleString("fa-IR")}
                              </p>
                              {safeError ? (
                                <p className="mt-2 leading-6 text-rose-600 dark:text-rose-300">
                                  {safeError}
                                </p>
                              ) : null}
                              {fulfillment.nextAttemptAt &&
                              fulfillment.status === "RETRY" ? (
                                <p className="mt-2 text-muted-foreground">
                                  تلاش بعدی: {formatDate(fulfillment.nextAttemptAt)}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">
                        هنوز رکورد صدوری برای این آیتم ثبت نشده است.
                      </p>
                    )}
                  </div>
                ) : null}
              </article>
            ))}

            <div className="rounded-md border border-border p-4">
              <p className="text-sm text-muted-foreground">یادداشت کاربر</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
                {order.note || "یادداشتی ثبت نشده است."}
              </p>
            </div>

            {latestPaymentAttempt ? (
              <div className="rounded-md border border-border p-4">
                <h3 className="text-sm font-semibold">جزئیات امن پرداخت جیبیت</h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">شناسه خرید جیبیت</dt>
                    <dd className="mt-1 break-all" dir="ltr">
                      {latestPaymentAttempt.providerPurchaseId || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">مرجع داخلی</dt>
                    <dd className="mt-1 break-all" dir="ltr">
                      {latestPaymentAttempt.clientReferenceNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">وضعیت جیبیت</dt>
                    <dd className="mt-1" dir="ltr">
                      {latestPaymentAttempt.providerStatus || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">مبلغ درگاه</dt>
                    <dd className="mt-1">
                      {latestPaymentAttempt.providerAmountRial.toLocaleString("fa-IR")} ریال
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">مرجع PSP</dt>
                    <dd className="mt-1 break-all" dir="ltr">
                      {latestPaymentAttempt.pspReferenceNumber || "-"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">کد بررسی</dt>
                    <dd className="mt-1 break-all" dir="ltr">
                      {latestPaymentAttempt.lastErrorCode || "-"}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
          </div>
        </AdminSection>

        <AdminSection title="عملیات سفارش">
          <form className="space-y-4" onSubmit={updateStatus}>
            <label className="block text-sm font-medium">
              وضعیت سفارش
              <Select
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={saving || directStatusLocked}
                value={status}
                onChange={(event) => setStatus(event.target.value as OrderStatus)}
              >
                {orderStatuses.map((nextStatus) => (
                  <option key={nextStatus} value={nextStatus}>
                    {statusLabels[nextStatus]}
                  </option>
                ))}
              </Select>
              {directStatusLocked ? (
                <span className="mt-2 block text-xs text-amber-700 dark:text-amber-300">
                  تا تعیین نتیجه پرداخت جیبیت، تغییر وضعیت سفارش قفل است.
                </span>
              ) : null}
            </label>

            <label className="block text-sm font-medium">
              یادداشت داخلی
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
              />
            </label>

            <Button className="w-full" disabled={saving} type="submit">
              <Save className="size-4" />
              ذخیره وضعیت
            </Button>
          </form>

          {hasShareBoxItems ? (
            <div className="mt-5 border-t border-border pt-5">
              <p className="mb-3 text-xs leading-6 text-muted-foreground">
                تلاش مجدد فقط واحدهای قابل صف‌بندی را می‌پذیرد و تأیید صف به معنی تحویل نیست.
              </p>
              <Button
                className="w-full"
                disabled={retryingShareBox || !hasRetryableShareBoxFulfillments}
                type="button"
                variant="outline"
                onClick={() => void retryShareBox()}
              >
                <RotateCcw className={retryingShareBox ? "animate-spin" : ""} />
                {retryingShareBox ? "در حال ثبت درخواست..." : "تلاش مجدد صدور شیر‌باکس"}
              </Button>
            </div>
          ) : null}

          <div className="mt-5 border-t border-border pt-5">
            <Button
              className="w-full"
              disabled={
                saving ||
                order.paymentMethod !== "WALLET" ||
                order.paymentStatus !== "PAID" ||
                order.status === "REFUNDED"
              }
              type="button"
              variant="outline"
              onClick={refundOrder}
            >
              <RotateCcw className="size-4" />
              {order.paymentMethod === "JIBIT"
                ? "بازگشت وجه از پنل جیبیت"
                : "بازگشت وجه"}
            </Button>
          </div>
        </AdminSection>
      </div>

      {!deliveries.length && !fieldValues.length && !hasShareBoxItems ? (
        <AdminState>این سفارش هنوز اطلاعات فرم یا تحویل ثبت‌شده ندارد.</AdminState>
      ) : null}
    </div>
  );
}
