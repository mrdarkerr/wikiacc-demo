"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";

import {
  formatCurrency,
  formatDate,
  formatNumber,
  orderCode,
  userLabel,
} from "@/components/admin/admin-formatters";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type { AdminOrder, OrderStatus } from "@/types/api";

const PER_PAGE = 10;

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

function hasSubmittedFields(order: AdminOrder) {
  return order.items.some((item) => item.fieldValues.length > 0);
}

function submittedFieldCount(order: AdminOrder) {
  return order.items.reduce((sum, item) => sum + item.fieldValues.length, 0);
}

function deliveryCount(order: AdminOrder) {
  return order.items.reduce((sum, item) => sum + item.deliveries.length, 0);
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OrderStatus>("ALL");

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

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : order.status === statusFilter;
      const searchableText = [
        order.id,
        orderCode(order.id),
        userLabel(order.user),
        firstItemTitle(order),
        order.note ?? "",
        order.adminNote ?? "",
        ...order.items.flatMap((item) =>
          item.fieldValues.flatMap((field) => [
            field.labelSnapshot,
            field.value,
          ]),
        ),
      ]
        .join(" ")
        .toLowerCase();

      return matchesStatus && searchableText.includes(normalizedSearch);
    });
  }, [orders, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PER_PAGE));
  const paginatedOrders = filteredOrders.slice(
    (page - 1) * PER_PAGE,
    page * PER_PAGE,
  );

  const metrics = useMemo(
    () => [
      {
        label: "کل سفارش‌ها",
        value: formatNumber(orders.length),
      },
      {
        label: "در انتظار بررسی",
        value: formatNumber(
          orders.filter((order) => order.status === "AWAITING_ADMIN").length,
        ),
      },
      {
        label: "دارای فرم ارسالی",
        value: formatNumber(orders.filter(hasSubmittedFields).length),
      },
      {
        label: "تحویل آماده",
        value: formatNumber(orders.filter((order) => deliveryCount(order) > 0).length),
      },
    ],
    [orders],
  );

  return (
    <div className="space-y-6">
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
            key={metric.label}
          >
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-2xl font-bold">{metric.value}</p>
          </div>
        ))}
      </div>

      <AdminSection title="سفارش‌ها" description="پیگیری سفارش‌ها، فرم‌های ارسالی و تحویل‌ها">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pr-9"
              placeholder="جست‌وجو در سفارش، کاربر، محصول یا فیلدهای فرم"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <Select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as "ALL" | OrderStatus);
              setPage(1);
            }}
          >
            <option value="ALL">همه وضعیت‌ها</option>
            {Object.entries(statusLabels).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <AdminState>در حال دریافت سفارش‌ها...</AdminState>
        ) : filteredOrders.length ? (
          <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[1120px] text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3 font-medium">شماره</th>
                  <th className="py-3 font-medium">کاربر</th>
                  <th className="py-3 font-medium">محصول</th>
                  <th className="py-3 font-medium">مبلغ</th>
                  <th className="py-3 font-medium">پرداخت</th>
                  <th className="py-3 font-medium">فرم ارسالی</th>
                  <th className="py-3 font-medium">تحویل</th>
                  <th className="py-3 font-medium">وضعیت</th>
                  <th className="py-3 font-medium">ثبت</th>
                  <th className="py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={`border-b border-border last:border-0 ${
                      order.status === "AWAITING_ADMIN" ? "bg-amber-50/40 dark:bg-amber-950/10" : ""
                    }`}
                  >
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
                      {hasSubmittedFields(order) ? (
                        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                          {formatNumber(submittedFieldCount(order))} فیلد
                        </span>
                      ) : (
                        <span className="text-muted-foreground">ندارد</span>
                      )}
                    </td>
                    <td className="py-3">
                      {deliveryCount(order) ? (
                        <span className="text-sm font-medium">
                          {formatNumber(deliveryCount(order))} آیتم
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-3">
                      <AdminStatusBadge type="order" value={order.status} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="py-3">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/orders/${order.id}`}>
                          <Eye className="size-4" />
                          جزئیات
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              totalItems={filteredOrders.length}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        ) : (
          <AdminState>سفارشی با این فیلتر پیدا نشد.</AdminState>
        )}
      </AdminSection>
    </div>
  );
}
