"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Headphones,
  PackageCheck,
  Plus,
  WalletCards,
} from "lucide-react";

import { formatCurrency, formatDate } from "@/components/panel/formatters";
import { MetricCard } from "@/components/panel/metric-card";
import { PanelSection } from "@/components/panel/panel-section";
import { StatusBadge } from "@/components/panel/status-badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { DashboardSummary, Order, Ticket } from "@/types/api";

function orderTitle(order: Order) {
  return order.items[0]?.titleSnapshot ?? "سفارش";
}

function orderCode(order: Order) {
  return `WKA-${order.id.slice(-6).toUpperCase()}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "دریافت اطلاعات پنل انجام نشد.";
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const [ordersResult, ticketsResult, walletResult] = await Promise.all([
          api.orders.list(),
          api.tickets.list(),
          api.wallet.summary(),
        ]);

        if (!active) return;
        setOrders(ordersResult.orders);
        setTickets(ticketsResult.tickets);
        setWalletBalance(walletResult.wallet.balance);
        setError("");
      } catch (loadError) {
        if (active) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const summary: DashboardSummary = useMemo(
    () => ({
      activeOrders: orders.filter((order) =>
        ["PENDING_INFO", "AWAITING_ADMIN", "READY"].includes(order.status),
      ).length,
      deliveredOrders: orders.filter((order) => order.status === "DELIVERED").length,
      openTickets: tickets.filter((ticket) => ticket.status !== "CLOSED").length,
      recentOrders: orders.slice(0, 5),
      recentTickets: tickets.slice(0, 5),
      walletBalance,
    }),
    [orders, tickets, walletBalance],
  );

  if (loading) {
    return <p className="text-sm text-muted-foreground">در حال دریافت اطلاعات...</p>;
  }

  if (error) {
    return (
      <PanelSection title="خطا در دریافت اطلاعات" description={error}>
        <Button asChild>
          <Link href="/login">ورود به پنل</Link>
        </Button>
      </PanelSection>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          helper="سفارش هایی که هنوز در جریان هستند"
          icon={PackageCheck}
          label="سفارش فعال"
          tone="blue"
          value={new Intl.NumberFormat("fa-IR").format(summary.activeOrders)}
        />
        <MetricCard
          helper="تیکت هایی که هنوز بسته نشده اند"
          icon={Headphones}
          label="تیکت باز"
          tone="amber"
          value={new Intl.NumberFormat("fa-IR").format(summary.openTickets)}
        />
        <MetricCard
          helper="موجودی قابل استفاده برای خرید بعدی"
          icon={WalletCards}
          label="موجودی کیف پول"
          tone="emerald"
          value={formatCurrency(summary.walletBalance)}
        />
        <MetricCard
          helper="کل سفارش های تحویل شده حساب"
          icon={ClipboardCheck}
          label="تحویل شده"
          tone="rose"
          value={new Intl.NumberFormat("fa-IR").format(summary.deliveredOrders)}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <PanelSection
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/orders">همه سفارش ها</Link>
            </Button>
          }
          description="آخرین وضعیت خریدها و تحویل ها"
          title="سفارش های اخیر"
        >
          {summary.recentOrders.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-right text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-3 font-medium">شماره</th>
                    <th className="py-3 font-medium">محصول</th>
                    <th className="py-3 font-medium">مبلغ</th>
                    <th className="py-3 font-medium">تاریخ</th>
                    <th className="py-3 font-medium">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-medium" dir="ltr">
                        {orderCode(order)}
                      </td>
                      <td className="py-3">{orderTitle(order)}</td>
                      <td className="py-3">{formatCurrency(order.totalAmount)}</td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="py-3">
                        <StatusBadge type="order" value={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">هنوز سفارشی ثبت نشده است.</p>
          )}
        </PanelSection>

        <PanelSection
          action={
            <Button asChild size="sm">
              <Link href="/tickets">
                <Plus className="size-4" />
                تیکت
              </Link>
            </Button>
          }
          description="پیام های مهم پشتیبانی"
          title="تیکت های اخیر"
        >
          <div className="space-y-3">
            {summary.recentTickets.length ? (
              summary.recentTickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  className="block rounded-md border border-border p-3 text-sm transition hover:border-primary/40"
                  href={`/tickets/${ticket.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium leading-6">{ticket.subject}</h3>
                    <StatusBadge type="ticket" value={ticket.status} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    آخرین بروزرسانی: {formatDate(ticket.updatedAt)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">تیکت بازی ندارید.</p>
            )}
          </div>
        </PanelSection>
      </div>
    </div>
  );
}
