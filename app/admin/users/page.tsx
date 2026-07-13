"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, ShoppingBag, WalletCards, X } from "lucide-react";

import {
  formatCurrency,
  formatDate,
  formatNumber,
  orderCode,
  shortId,
  userLabel,
} from "@/components/admin/admin-formatters";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { api, ApiError } from "@/lib/api";
import type { AdminOrder, AdminUser } from "@/types/api";

const PER_PAGE = 10;

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "دریافت کاربران انجام نشد.";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    Promise.all([api.admin.users.list(), api.admin.orders.list()])
      .then(([usersResult, ordersResult]) => {
        if (!active) return;
        setUsers(usersResult.users);
        setOrders(ordersResult.orders);
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
  }, []);

  const totalPages = Math.max(1, Math.ceil(users.length / PER_PAGE));
  const paginatedUsers = users.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const selectedUserOrders = useMemo(() => {
    if (!selectedUser) return [];
    return orders.filter((order) => order.user?.id === selectedUser.id);
  }, [orders, selectedUser]);
  const paidOrders = selectedUserOrders.filter(
    (order) => order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED",
  );
  const lastOrder = selectedUserOrders[0];
  const paidTotal = paidOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const activeOrderCount = selectedUserOrders.filter((order) =>
    ["PENDING_INFO", "AWAITING_ADMIN", "READY"].includes(order.status),
  ).length;

  return (
    <>
      <AdminSection
        description="مشاهده کاربران، نقش‌ها و دسترسی سریع به کیف پول"
        title="کاربران"
      >
        {loading ? (
          <AdminState>در حال دریافت کاربران...</AdminState>
        ) : error ? (
          <AdminState tone="danger">{error}</AdminState>
        ) : users.length ? (
          <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[980px] text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3 font-medium">شناسه</th>
                  <th className="py-3 font-medium">نام</th>
                  <th className="py-3 font-medium">ایمیل</th>
                  <th className="py-3 font-medium">موبایل</th>
                  <th className="py-3 font-medium">نقش</th>
                  <th className="py-3 font-medium">کیف پول</th>
                  <th className="py-3 font-medium">ثبت نام</th>
                  <th className="py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium" dir="ltr">
                      {shortId(user.id)}
                    </td>
                    <td className="py-3">{user.name}</td>
                    <td className="py-3" dir="ltr">
                      {user.email ?? "-"}
                    </td>
                    <td className="py-3" dir="ltr">
                      {user.phone ?? "-"}
                    </td>
                    <td className="py-3">
                      <AdminStatusBadge type="role" value={user.role} />
                    </td>
                    <td className="py-3">{formatCurrency(user.wallet?.balance ?? 0)}</td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedUser(user)}
                        >
                          <Eye className="size-4" />
                          جزئیات
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/wallet?userId=${user.id}`}>
                            <WalletCards className="size-4" />
                            کیف پول
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              totalItems={users.length}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        ) : (
          <AdminState>کاربری ثبت نشده است.</AdminState>
        )}
      </AdminSection>

      {selectedUser ? (
        <DialogOverlay
          contentClassName="max-h-[calc(100svh-2rem)] max-w-3xl overflow-y-auto rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xl"
          onClose={() => setSelectedUser(null)}
        >
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-bold">{userLabel(selectedUser)}</h3>
              <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
                {selectedUser.email ?? selectedUser.phone ?? "-"}
              </p>
            </div>
            <Button
              aria-label="بستن"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => setSelectedUser(null)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">کل خریدها</p>
              <p className="mt-2 text-lg font-bold">
                {formatNumber(selectedUserOrders.length)}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">خرید پرداخت‌شده</p>
              <p className="mt-2 text-lg font-bold">{formatNumber(paidOrders.length)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">جمع پرداختی</p>
              <p className="mt-2 text-lg font-bold">{formatCurrency(paidTotal)}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">سفارش فعال</p>
              <p className="mt-2 text-lg font-bold">{formatNumber(activeOrderCount)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <section className="space-y-3">
              <h4 className="font-bold">اطلاعات کاربر</h4>
              <dl className="grid gap-3 text-sm">
                <div className="rounded-md bg-muted/50 p-3">
                  <dt className="text-muted-foreground">شناسه</dt>
                  <dd className="mt-1 font-medium" dir="ltr">
                    {selectedUser.id}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <dt className="text-muted-foreground">موبایل</dt>
                  <dd className="mt-1 font-medium" dir="ltr">
                    {selectedUser.phone ?? "-"}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <dt className="text-muted-foreground">نقش</dt>
                  <dd className="mt-2">
                    <AdminStatusBadge type="role" value={selectedUser.role} />
                  </dd>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <dt className="text-muted-foreground">موجودی کیف پول</dt>
                  <dd className="mt-1 font-medium">
                    {formatCurrency(selectedUser.wallet?.balance ?? 0)}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <dt className="text-muted-foreground">تاریخ ثبت نام</dt>
                  <dd className="mt-1 font-medium">
                    {formatDate(selectedUser.createdAt)}
                  </dd>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <dt className="text-muted-foreground">آخرین بروزرسانی</dt>
                  <dd className="mt-1 font-medium">
                    {formatDate(selectedUser.updatedAt)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-bold">آخرین خرید</h4>
                {lastOrder ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/orders/${lastOrder.id}`}>
                      <ShoppingBag className="size-4" />
                      مشاهده سفارش
                    </Link>
                  </Button>
                ) : null}
              </div>
              {lastOrder ? (
                <div className="rounded-md border border-border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold" dir="ltr">
                        {orderCode(lastOrder.id)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {lastOrder.items[0]?.titleSnapshot ?? "سفارش"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminStatusBadge type="payment" value={lastOrder.paymentStatus} />
                      <AdminStatusBadge type="order" value={lastOrder.status} />
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md bg-muted/50 p-3">
                      <dt className="text-xs text-muted-foreground">مبلغ</dt>
                      <dd className="mt-1 font-medium">
                        {formatCurrency(lastOrder.totalAmount)}
                      </dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <dt className="text-xs text-muted-foreground">تاریخ خرید</dt>
                      <dd className="mt-1 font-medium">
                        {formatDate(lastOrder.createdAt)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <AdminState>این کاربر هنوز خریدی ثبت نکرده است.</AdminState>
              )}

              <div className="pt-2">
                <Button asChild variant="outline">
                  <Link href={`/admin/wallet?userId=${selectedUser.id}`}>
                    <WalletCards className="size-4" />
                    صفحه مالی کاربر
                  </Link>
                </Button>
              </div>
            </section>
          </div>
        </DialogOverlay>
      ) : null}
    </>
  );
}
