"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
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
import { ExchangeRateCard } from "@/components/admin/exchange-rate-card";
import { FinanceDashboard } from "@/components/admin/finance-dashboard";
import { api, ApiError } from "@/lib/api";
import type { AdminOrder, AdminTicket, AdminUser, AdminProduct as Product } from "@/types/api";

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


  return (
    <div className="space-y-6">
      <ExchangeRateCard dashboard />
      {loading ? <AdminState>در حال دریافت اطلاعات ادمین...</AdminState> : error ? (
        <AdminSection title="خطا در دریافت اطلاعات">
          <div className="space-y-4">
            <AdminState tone="danger">{error}</AdminState>
            <Button asChild><Link href="/login">ورود دوباره</Link></Button>
          </div>
        </AdminSection>
      ) : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
      </div>}

      <FinanceDashboard />

      {!loading && !error ? <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
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
      </div> : null}
    </div>
  );
}
