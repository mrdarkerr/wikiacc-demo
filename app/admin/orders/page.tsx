"use client";

import { useEffect, useState } from "react";

import {
  formatCurrency,
  formatDate,
  orderCode,
  userLabel,
} from "@/components/admin/admin-formatters";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@/components/ui/button";
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
    : "دریافت سفارش ها انجام نشد.";
}

function firstItemTitle(order: AdminOrder) {
  return order.items[0]?.titleSnapshot ?? "سفارش";
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");

  async function loadOrders() {
    const result = await api.admin.orders.list();
    setOrders(result.orders);
  }

  useEffect(() => {
    let active = true;

    api.admin.orders
      .list()
      .then((result) => {
        if (active) {
          setOrders(result.orders);
          setError("");
        }
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
  }, []);

  async function updateStatus(orderId: string, status: OrderStatus) {
    setActionId(orderId);
    try {
      await api.admin.orders.updateStatus(orderId, { status });
      await loadOrders();
      setError("");
    } catch (updateError) {
      setError(
        updateError instanceof ApiError
          ? updateError.message
          : "به روزرسانی وضعیت سفارش انجام نشد.",
      );
    } finally {
      setActionId("");
    }
  }

  async function refundOrder(orderId: string) {
    setActionId(orderId);
    try {
      await api.admin.orders.refund(orderId, {
        note: "Refunded from admin panel",
      });
      await loadOrders();
      setError("");
    } catch (refundError) {
      setError(
        refundError instanceof ApiError
          ? refundError.message
          : "بازگشت وجه سفارش انجام نشد.",
      );
    } finally {
      setActionId("");
    }
  }

  return (
    <div className="space-y-6">
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <AdminSection
        description="لیست از GET /api/v1/admin/orders خوانده می شود."
        title="سفارش ها"
      >
        {loading ? (
          <AdminState>در حال دریافت سفارش ها...</AdminState>
        ) : orders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3 font-medium">شماره</th>
                  <th className="py-3 font-medium">کاربر</th>
                  <th className="py-3 font-medium">محصول</th>
                  <th className="py-3 font-medium">مبلغ</th>
                  <th className="py-3 font-medium">پرداخت</th>
                  <th className="py-3 font-medium">وضعیت</th>
                  <th className="py-3 font-medium">ثبت</th>
                  <th className="py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium" dir="ltr">
                      {orderCode(order.id)}
                    </td>
                    <td className="py-3">{userLabel(order.user)}</td>
                    <td className="py-3">{firstItemTitle(order)}</td>
                    <td className="py-3">{formatCurrency(order.totalAmount)}</td>
                    <td className="py-3">
                      <AdminStatusBadge
                        type="payment"
                        value={order.paymentStatus}
                      />
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminStatusBadge type="order" value={order.status} />
                        <select
                          className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                          disabled={actionId === order.id}
                          value={order.status}
                          onChange={(event) =>
                            updateStatus(
                              order.id,
                              event.target.value as OrderStatus,
                            )
                          }
                        >
                          {orderStatuses.map((status) => (
                            <option key={status} value={status}>
                              {statusLabels[status]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="py-3">
                      <Button
                        disabled={
                          actionId === order.id ||
                          order.paymentStatus !== "PAID" ||
                          order.status === "REFUNDED"
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => refundOrder(order.id)}
                      >
                        بازگشت وجه
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminState>سفارشی ثبت نشده است.</AdminState>
        )}
      </AdminSection>
    </div>
  );
}
