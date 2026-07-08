"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WalletCards } from "lucide-react";

import {
  formatCurrency,
  formatDate,
  shortId,
} from "@/components/admin/admin-formatters";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { api, ApiError } from "@/lib/api";
import type { AdminUser } from "@/types/api";

const PER_PAGE = 10;

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "دریافت کاربران انجام نشد.";
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    api.admin.users
      .list()
      .then((result) => {
        if (active) {
          setUsers(result.users);
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

  const totalPages = Math.max(1, Math.ceil(users.length / PER_PAGE));
  const paginatedUsers = users.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
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
          <table className="w-full min-w-[900px] text-right text-sm">
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
                    {user.email}
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
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/wallet?userId=${user.id}`}>
                        <WalletCards className="size-4" />
                        کیف پول
                      </Link>
                    </Button>
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
  );
}
