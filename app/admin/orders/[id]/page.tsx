"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RotateCcw, Save } from "lucide-react";

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
    () => order?.items.flatMap((item) => item.deliveries) ?? [],
    [order],
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                          <dd className="mt-1 whitespace-pre-wrap text-sm font-medium">
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
                    <div className="mt-3 space-y-2">
                      {item.deliveries.map((delivery) => (
                        <code
                          className="block whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-xs"
                          key={delivery.id}
                        >
                          {delivery.contentSnapshot}
                        </code>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      تحویلی برای این آیتم ثبت نشده است.
                    </p>
                  )}
                </div>
              </article>
            ))}

            <div className="rounded-md border border-border p-4">
              <p className="text-sm text-muted-foreground">یادداشت کاربر</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {order.note || "یادداشتی ثبت نشده است."}
              </p>
            </div>
          </div>
        </AdminSection>

        <AdminSection title="عملیات سفارش">
          <form className="space-y-4" onSubmit={updateStatus}>
            <label className="block text-sm font-medium">
              وضعیت سفارش
              <Select
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={saving}
                value={status}
                onChange={(event) => setStatus(event.target.value as OrderStatus)}
              >
                {orderStatuses.map((nextStatus) => (
                  <option key={nextStatus} value={nextStatus}>
                    {statusLabels[nextStatus]}
                  </option>
                ))}
              </Select>
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

          <div className="mt-5 border-t border-border pt-5">
            <Button
              className="w-full"
              disabled={
                saving ||
                order.paymentStatus !== "PAID" ||
                order.status === "REFUNDED"
              }
              type="button"
              variant="outline"
              onClick={refundOrder}
            >
              <RotateCcw className="size-4" />
              بازگشت وجه
            </Button>
          </div>
        </AdminSection>
      </div>

      {!deliveries.length && !fieldValues.length ? (
        <AdminState>این سفارش هنوز اطلاعات فرم یا تحویل ثبت‌شده ندارد.</AdminState>
      ) : null}
    </div>
  );
}
