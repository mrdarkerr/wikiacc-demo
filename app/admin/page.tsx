"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Headphones,
  PackagePlus,
  Users,
  WalletCards,
} from "lucide-react";

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
import { api, ApiError } from "@/lib/api";
import type { AdminOrder, AdminTicket, AdminUser, Product } from "@/types/api";

type DashboardData = {
  orders: AdminOrder[];
  products: Product[];
  tickets: AdminTicket[];
  users: AdminUser[];
};

type Metric = {
  href: string;
  icon: typeof ClipboardList;
  label: string;
  value: string;
};

type RevenueInterval = "daily" | "weekly";

type RevenuePoint = {
  label: string;
  revenue: number;
  start: Date;
};

const revenueNumberFormatter = new Intl.NumberFormat("fa-IR", {
  compactDisplay: "short",
  notation: "compact",
  maximumFractionDigits: 1,
});

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfWeek(value: Date) {
  const day = startOfDay(value);
  const daysSinceSaturday = (day.getDay() + 1) % 7;
  day.setDate(day.getDate() - daysSinceSaturday);
  return day;
}

function addDays(value: Date, days: number) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function buildRevenueSeries(
  orders: AdminOrder[],
  interval: RevenueInterval,
): RevenuePoint[] {
  const isDaily = interval === "daily";
  const pointCount = isDaily ? 7 : 8;
  const step = isDaily ? 1 : 7;
  const currentPeriodStart = isDaily
    ? startOfDay(new Date())
    : startOfWeek(new Date());
  const firstPeriodStart = addDays(
    currentPeriodStart,
    -(pointCount - 1) * step,
  );
  const points = Array.from({ length: pointCount }, (_, index) => {
    const start = addDays(firstPeriodStart, index * step);
    const label = new Intl.DateTimeFormat("fa-IR", {
      day: "numeric",
      month: "short",
      ...(isDaily ? { weekday: "short" as const } : {}),
    }).format(start);

    return { label, revenue: 0, start };
  });

  const paidOrders = orders.filter(
    (order) =>
      order.paymentStatus === "PAID" &&
      order.status !== "CANCELLED" &&
      order.status !== "REFUNDED",
  );

  paidOrders.forEach((order) => {
    const createdAt = new Date(order.createdAt);
    const orderPeriodStart = isDaily
      ? startOfDay(createdAt)
      : startOfWeek(createdAt);
    const point = points.find(
      ({ start }) => start.getTime() === orderPeriodStart.getTime(),
    );

    if (point) point.revenue += order.totalAmount;
  });

  return points;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "دریافت اطلاعات ادمین انجام نشد.";
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData>({
    orders: [],
    products: [],
    tickets: [],
    users: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revenueInterval, setRevenueInterval] =
    useState<RevenueInterval>("daily");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const [usersResult, ordersResult, ticketsResult, productsResult] =
          await Promise.all([
            api.admin.users.list(),
            api.admin.orders.list(),
            api.admin.tickets.list(),
            api.admin.products.list(),
          ]);

        if (!active) return;
        setData({
          orders: ordersResult.orders,
          products: productsResult.products,
          tickets: ticketsResult.tickets,
          users: usersResult.users,
        });
        setError("");
      } catch (loadError) {
        if (active) setError(errorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo<Metric[]>(
    () => {
      const completedOrders = data.orders.filter(
        (order) => order.status === "DELIVERED",
      ).length;

      return [
        {
          href: "/admin/users",
          icon: Users,
          label: "کاربران",
          value: formatNumber(data.users.length),
        },
        {
          href: "/admin/orders",
          icon: CheckCircle2,
          label: "سفارش‌های تکمیل‌شده",
          value: formatNumber(completedOrders),
        },
        {
          href: "/admin/orders",
          icon: Clock3,
          label: "سفارش‌های تکمیل‌نشده",
          value: formatNumber(data.orders.length - completedOrders),
        },
        {
          href: "/admin/products",
          icon: PackagePlus,
          label: "محصولات فعال",
          value: formatNumber(data.products.length),
        },
        {
          href: "/admin/tickets",
          icon: Headphones,
          label: "تیکت‌های باز",
          value: formatNumber(
            data.tickets.filter((ticket) => ticket.status !== "CLOSED").length,
          ),
        },
        {
          href: "/admin/wallet",
          icon: WalletCards,
          label: "موجودی کاربران",
          value: formatCurrency(
            data.users.reduce((sum, user) => sum + (user.wallet?.balance ?? 0), 0),
          ),
        },
      ];
    },
    [data],
  );

  const revenueSeries = useMemo(
    () => buildRevenueSeries(data.orders, revenueInterval),
    [data.orders, revenueInterval],
  );
  const totalRevenue = revenueSeries.reduce(
    (total, point) => total + point.revenue,
    0,
  );
  const maximumRevenue = Math.max(
    ...revenueSeries.map((point) => point.revenue),
    0,
  );

  if (loading) {
    return <AdminState>در حال دریافت اطلاعات ادمین...</AdminState>;
  }

  if (error) {
    return (
      <AdminSection title="خطا در دریافت اطلاعات">
        <div className="space-y-4">
          <AdminState tone="danger">{error}</AdminState>
          <Button asChild>
            <Link href="/login">ورود دوباره</Link>
          </Button>
        </div>
      </AdminSection>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Link
              key={metric.label}
              className="rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary/40"
              href={metric.href}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <Icon className="size-5 text-muted-foreground" />
              </div>
              <p className="mt-3 text-2xl font-bold">{metric.value}</p>
            </Link>
          );
        })}
      </div>

      <AdminSection
        action={
          <div
            aria-label="بازه نمایش درآمد"
            className="flex rounded-md bg-muted p-1"
            role="group"
          >
            <Button
              aria-pressed={revenueInterval === "daily"}
              className="h-8 px-3"
              size="sm"
              type="button"
              variant={revenueInterval === "daily" ? "default" : "ghost"}
              onClick={() => setRevenueInterval("daily")}
            >
              روزانه
            </Button>
            <Button
              aria-pressed={revenueInterval === "weekly"}
              className="h-8 px-3"
              size="sm"
              type="button"
              variant={revenueInterval === "weekly" ? "default" : "ghost"}
              onClick={() => setRevenueInterval("weekly")}
            >
              هفتگی
            </Button>
          </div>
        }
        description={
          revenueInterval === "daily"
            ? "درآمد سفارش‌های پرداخت‌شده در ۷ روز اخیر"
            : "درآمد سفارش‌های پرداخت‌شده در ۸ هفته اخیر"
        }
        title="درآمد"
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">جمع درآمد این بازه</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="size-4" />
            سفارش‌های لغوشده و بازپرداختی محاسبه نشده‌اند
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-2">
          <div
            aria-label={`نمودار درآمد ${revenueInterval === "daily" ? "روزانه" : "هفتگی"}`}
            className="flex h-64 min-w-[560px] items-end gap-3 border-b border-border px-2 pt-8"
            role="img"
          >
            {revenueSeries.map((point) => {
              const height =
                maximumRevenue === 0
                  ? 0
                  : Math.max((point.revenue / maximumRevenue) * 100, 3);

              return (
                <div
                  key={point.start.toISOString()}
                  className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="text-xs font-medium text-muted-foreground">
                    {point.revenue
                      ? `${revenueNumberFormatter.format(point.revenue)} ت`
                      : "۰"}
                  </span>
                  <div className="flex h-full w-full items-end">
                    <div
                      className="w-full rounded-t-md bg-accent/80 transition-all group-hover:bg-accent"
                      style={{
                        height: point.revenue ? `${height}%` : "4px",
                      }}
                      title={`${point.label}: ${formatCurrency(point.revenue)}`}
                    />
                  </div>
                  <span className="min-h-10 text-center text-xs leading-5 text-muted-foreground">
                    {point.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </AdminSection>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <AdminSection
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/orders">همه سفارش ها</Link>
            </Button>
          }
          title="آخرین سفارش ها"
        >
          {data.orders.length ? (
            <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[760px] text-right text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-3 font-medium">شماره</th>
                    <th className="py-3 font-medium">کاربر</th>
                    <th className="py-3 font-medium">مبلغ</th>
                    <th className="py-3 font-medium">ثبت</th>
                    <th className="py-3 font-medium">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.slice(0, 6).map((order) => (
                    <tr key={order.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-medium" dir="ltr">
                        {orderCode(order.id)}
                      </td>
                      <td className="py-3">{userLabel(order.user)}</td>
                      <td className="py-3">{formatCurrency(order.totalAmount)}</td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="py-3">
                        <AdminStatusBadge type="order" value={order.status} />
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

        <AdminSection
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/tickets">همه تیکت ها</Link>
            </Button>
          }
          title="تیکت های اخیر"
        >
          <div className="space-y-3">
            {data.tickets.slice(0, 5).map((ticket) => (
              <Link
                key={ticket.id}
                className="block rounded-md border border-border p-3 text-sm transition hover:border-primary/40"
                href={`/admin/tickets/${ticket.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium leading-6">{ticket.subject}</h3>
                  <AdminStatusBadge type="ticket" value={ticket.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {userLabel(ticket.user)} - {formatDate(ticket.updatedAt)}
                </p>
              </Link>
            ))}
            {!data.tickets.length ? <AdminState>تیکتی ثبت نشده است.</AdminState> : null}
          </div>
        </AdminSection>
      </div>
    </div>
  );
}
