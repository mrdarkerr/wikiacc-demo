"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Plus, X } from "lucide-react";

import { formatCurrency, formatDate } from "@/components/panel/formatters";
import { PanelSection } from "@/components/panel/panel-section";
import { StatusBadge } from "@/components/panel/status-badge";
import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import type { ApiMeta, Order } from "@/types/api";

const PER_PAGE = 8;

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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    api.orders
      .listPage({ page, perPage: PER_PAGE })
      .then((result) => {
        if (!active) return;
        setOrders(result.data.orders);
        setMeta(result.meta ?? null);
        setError("");
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
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page]);

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">سفارش ها</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            تاریخچه خرید، اطلاعات ثبت شده و محتوای آماده تحویل
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
        description="برای مشاهده فرم‌ها، یادداشت و محتوای تحویل، جزئیات سفارش را باز کنید."
        title="همه سفارش ها"
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">در حال دریافت سفارش ها...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : orders.length ? (
          <>
            <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
              <table className="w-full min-w-[820px] text-right text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-3 font-medium">شماره سفارش</th>
                    <th className="py-3 font-medium">محصول</th>
                    <th className="py-3 font-medium">مبلغ</th>
                    <th className="py-3 font-medium">ثبت</th>
                    <th className="py-3 font-medium">وضعیت</th>
                    <th className="py-3 font-medium">تحویل</th>
                    <th className="py-3 font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const deliveries = deliveredContent(order);
                    return (
                      <tr
                        key={order.id}
                        className="border-b border-border last:border-0"
                      >
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
                            <span className="font-medium">
                              {deliveries.length} مورد
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3">
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="size-4" />
                            جزئیات
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={(nextPage) => {
                setLoading(true);
                setPage(nextPage);
              }}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">هنوز سفارشی ثبت نشده است.</p>
        )}
      </PanelSection>

      {selectedOrder ? (
        <OrderDialog
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      ) : null}
    </div>
  );
}

function Pagination({
  onPageChange,
  page,
  totalPages,
}: {
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        صفحه {page} از {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          disabled={page <= 1}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
        >
          قبلی
        </Button>
        <Button
          disabled={page >= totalPages}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page + 1)}
        >
          بعدی
        </Button>
      </div>
    </div>
  );
}

function OrderDialog({
  onClose,
  order,
}: {
  onClose: () => void;
  order: Order;
}) {
  const deliveries = deliveredContent(order);

  return (
    <DialogOverlay
      contentClassName="max-h-[calc(100svh-2rem)] max-w-3xl overflow-y-auto rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg sm:p-6"
      onClose={onClose}
    >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">جزئیات سفارش</p>
            <h3 className="mt-1 text-xl font-bold" dir="ltr">
              {orderCode(order)}
            </h3>
          </div>
          <Button aria-label="بستن" size="icon" type="button" variant="ghost" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">مبلغ</p>
            <p className="mt-1 font-bold">{formatCurrency(order.totalAmount)}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">ثبت</p>
            <p className="mt-1 font-medium">{formatDate(order.createdAt)}</p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">وضعیت</p>
            <div className="mt-1">
              <StatusBadge type="order" value={order.status} />
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {order.items.map((item) => (
            <article className="rounded-md border border-border p-4" key={item.id}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="font-bold">{item.titleSnapshot}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    تعداد {item.quantity}
                  </p>
                </div>
                <p className="font-medium">{formatCurrency(item.priceSnapshot)}</p>
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold">اطلاعات ثبت شده</p>
                {item.fieldValues.length ? (
                  <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                    {item.fieldValues.map((field) => (
                      <div className="rounded-md bg-muted/50 p-3" key={field.id}>
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
                    اطلاعات فرمی برای این آیتم ثبت نشده است.
                  </p>
                )}
              </div>

              <div className="mt-4">
                <p className="text-sm font-semibold">محتوای تحویل</p>
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
                    هنوز محتوایی برای تحویل ثبت نشده است.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-5 rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">یادداشت سفارش</p>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {order.note || "یادداشتی ثبت نشده است."}
          </p>
        </div>

        {!deliveries.length ? null : (
          <p className="mt-4 text-xs text-muted-foreground">
            {deliveries.length} محتوای آماده برای این سفارش ثبت شده است.
          </p>
        )}
    </DialogOverlay>
  );
}
