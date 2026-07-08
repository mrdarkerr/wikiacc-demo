"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { formatCurrency, formatDate } from "@/components/panel/formatters";
import { PanelSection } from "@/components/panel/panel-section";
import { StatusBadge } from "@/components/panel/status-badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { Order } from "@/types/api";

function orderCode(order: Order) {
  return `WKA-${order.id.slice(-6).toUpperCase()}`;
}

function orderTitle(order: Order) {
  return order.items[0]?.titleSnapshot ?? "سفارش";
}

function deliveredContent(order: Order) {
  return order.items
    .flatMap((item) => item.deliveries)
    .map((delivery) => delivery.contentSnapshot);
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    api.orders
      .list()
      .then((result) => {
        if (active) {
          setOrders(result.orders);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : "دریافت سفارش ها انجام نشد.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">سفارش ها</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            تاریخچه خرید، اطلاعات ثبت شده و محتوای تحویل آماده
          </p>
        </div>
        <Button asChild>
          <Link href="/#services">
            <Plus className="size-4" />
            سفارش جدید
          </Link>
        </Button>
      </div>

      <PanelSection
        description="تاریخچه خرید، وضعیت سفارش و محتوای آماده تحویل"
        title="همه سفارش ها"
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">در حال دریافت سفارش ها...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : orders.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3 font-medium">شماره سفارش</th>
                  <th className="py-3 font-medium">محصول</th>
                  <th className="py-3 font-medium">مبلغ</th>
                  <th className="py-3 font-medium">ثبت</th>
                  <th className="py-3 font-medium">وضعیت</th>
                  <th className="py-3 font-medium">تحویل آماده</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const deliveries = deliveredContent(order);
                  return (
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
                      <td className="py-3">
                        {deliveries.length ? (
                          <code className="block max-w-xs whitespace-pre-wrap rounded-md bg-muted px-2 py-1 text-xs">
                            {deliveries.join("\n")}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">هنوز سفارشی ثبت نشده است.</p>
        )}
      </PanelSection>
    </div>
  );
}
