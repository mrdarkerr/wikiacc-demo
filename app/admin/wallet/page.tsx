"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Search, WalletCards } from "lucide-react";

import {
  formatCurrency,
  formatDate,
  formatNumber,
  shortId,
  userLabel,
} from "@/components/admin/admin-formatters";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type {
  AdminUser,
  AdminWalletSummary,
  AdminWalletTransaction,
} from "@/types/api";

type WalletForm = {
  amount: string;
  mode: "credit" | "debit";
  note: string;
  userId: string;
};

const TRANSACTIONS_PER_PAGE = 10;
const USERS_PER_PAGE = 10;

const initialForm: WalletForm = {
  amount: "",
  mode: "credit",
  note: "",
  userId: "",
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات کیف پول انجام نشد.";
}

export default function AdminWalletPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<AdminWalletSummary | null>(null);
  const [transactions, setTransactions] = useState<AdminWalletTransaction[]>([]);
  const [form, setForm] = useState<WalletForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [usersPage, setUsersPage] = useState(1);
  const [sort, setSort] = useState<"balance-desc" | "balance-asc" | "name">(
    "balance-desc",
  );

  async function loadWallet(nextUserId?: string) {
    const [usersResult, summaryResult, transactionsResult] = await Promise.all([
      api.admin.users.list(),
      api.admin.wallet.summary(),
      api.admin.wallet.transactions(),
    ]);
    setUsers(usersResult.users);
    setSummary(summaryResult.summary);
    setTransactions(transactionsResult.transactions);
    setForm((current) => ({
      ...current,
      userId:
        nextUserId ||
        current.userId ||
        new URLSearchParams(window.location.search).get("userId") ||
        usersResult.users[0]?.id ||
        "",
    }));
  }

  useEffect(() => {
    let active = true;

    Promise.all([
      api.admin.users.list(),
      api.admin.wallet.summary(),
      api.admin.wallet.transactions(),
    ])
      .then(([usersResult, summaryResult, transactionsResult]) => {
        if (!active) return;
        const queryUserId = new URLSearchParams(window.location.search).get(
          "userId",
        );
        setUsers(usersResult.users);
        setSummary(summaryResult.summary);
        setTransactions(transactionsResult.transactions);
        setForm((current) => ({
          ...current,
          userId: queryUserId || usersResult.users[0]?.id || "",
        }));
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

  const selectedUser = useMemo(
    () => users.find((user) => user.id === form.userId),
    [form.userId, users],
  );

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return users
      .filter((user) =>
        [user.name, user.email, user.phone ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
      )
      .sort((first, second) => {
        if (sort === "name") {
          return first.name.localeCompare(second.name, "fa");
        }

        const firstBalance = first.wallet?.balance ?? 0;
        const secondBalance = second.wallet?.balance ?? 0;
        return sort === "balance-desc"
          ? secondBalance - firstBalance
          : firstBalance - secondBalance;
      });
  }, [search, sort, users]);

  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const paginatedUsers = filteredUsers.slice(
    (usersPage - 1) * USERS_PER_PAGE,
    usersPage * USERS_PER_PAGE,
  );
  const transactionsTotalPages = Math.max(
    1,
    Math.ceil(transactions.length / TRANSACTIONS_PER_PAGE),
  );
  const paginatedTransactions = transactions.slice(
    (transactionsPage - 1) * TRANSACTIONS_PER_PAGE,
    transactionsPage * TRANSACTIONS_PER_PAGE,
  );

  const metrics = useMemo(
    () => [
      {
        label: "مجموع موجودی",
        value: formatCurrency(summary?.totalBalance ?? 0),
      },
      {
        label: "میانگین موجودی",
        value: formatCurrency(summary?.averageBalance ?? 0),
      },
      {
        label: "کاربران دارای موجودی",
        value: formatNumber(summary?.usersWithBalance ?? 0),
      },
      {
        label: "بیشترین موجودی",
        value: formatCurrency(summary?.maxBalance ?? 0),
      },
      {
        label: "تراکنش ۳۰ روز اخیر",
        value: formatNumber(summary?.recentTransactionCount ?? 0),
      },
    ],
    [summary],
  );

  async function adjustWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.userId) {
      setError("ابتدا کاربر را انتخاب کنید.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        amount: Number(form.amount),
        note: optionalText(form.note),
      };

      if (form.mode === "credit") {
        await api.admin.wallet.credit(form.userId, body);
      } else {
        await api.admin.wallet.debit(form.userId, body);
      }

      await loadWallet(form.userId);
      setForm((current) => ({ ...current, amount: "", note: "" }));
      setMessage("کیف پول به روز شد.");
      setError("");
    } catch (adjustError) {
      setError(errorMessage(adjustError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? <AdminState tone="success">{message}</AdminState> : null}
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <div
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
            key={metric.label}
          >
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-xl font-bold">{metric.value}</p>
          </div>
        ))}
      </div>

      <AdminSection title="موجودی کاربران" description="انتخاب کاربر برای شارژ یا برداشت">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_220px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pr-9"
              placeholder="جست‌وجوی نام، ایمیل یا موبایل"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setUsersPage(1);
              }}
            />
          </label>
          <Select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as "balance-desc" | "balance-asc" | "name");
              setUsersPage(1);
            }}
          >
            <option value="balance-desc">بیشترین موجودی</option>
            <option value="balance-asc">کمترین موجودی</option>
            <option value="name">نام کاربر</option>
          </Select>
        </div>

        {loading ? (
          <AdminState>در حال دریافت کاربران...</AdminState>
        ) : filteredUsers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3 font-medium">شناسه</th>
                  <th className="py-3 font-medium">نام</th>
                  <th className="py-3 font-medium">ایمیل</th>
                  <th className="py-3 font-medium">موجودی</th>
                  <th className="py-3 font-medium">نقش</th>
                  <th className="py-3 font-medium">ثبت نام</th>
                  <th className="py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className={`border-b border-border last:border-0 ${
                      user.id === form.userId ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="py-3 font-medium" dir="ltr">
                      {shortId(user.id)}
                    </td>
                    <td className="py-3">{user.name}</td>
                    <td className="py-3" dir="ltr">
                      {user.email}
                    </td>
                    <td className="py-3">{formatCurrency(user.wallet?.balance ?? 0)}</td>
                    <td className="py-3">
                      <AdminStatusBadge type="role" value={user.role} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="py-3">
                      <Button
                        size="sm"
                        type="button"
                        variant={user.id === form.userId ? "default" : "outline"}
                        onClick={() =>
                          setForm((current) => ({ ...current, userId: user.id }))
                        }
                      >
                        انتخاب
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={usersPage}
              totalItems={filteredUsers.length}
              totalPages={usersTotalPages}
              onPageChange={setUsersPage}
            />
          </div>
        ) : (
          <AdminState>کاربری با این جست‌وجو پیدا نشد.</AdminState>
        )}
      </AdminSection>

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <AdminSection title="عملیات کیف پول">
          {selectedUser ? (
            <div className="space-y-5">
              <div className="rounded-md border border-border p-4">
                <p className="font-medium">{userLabel(selectedUser)}</p>
                <p className="mt-2 text-2xl font-bold">
                  {formatCurrency(selectedUser.wallet?.balance ?? 0)}
                </p>
              </div>

              <form className="space-y-4" onSubmit={adjustWallet}>
                <label className="block text-sm font-medium">
                  کاربر
                  <Select
                    className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    required
                    value={form.userId}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        userId: event.target.value,
                      }))
                    }
                  >
                    <option value="">انتخاب کنید</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} - {user.email}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block text-sm font-medium">
                  نوع عملیات
                  <Select
                    className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.mode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        mode: event.target.value as WalletForm["mode"],
                      }))
                    }
                  >
                    <option value="credit">افزایش موجودی</option>
                    <option value="debit">کاهش موجودی</option>
                  </Select>
                </label>
                <label className="block text-sm font-medium">
                  مبلغ
                  <Input
                    className="mt-2"
                    min={1}
                    required
                    type="number"
                    value={form.amount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block text-sm font-medium">
                  توضیح
                  <textarea
                    className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.note}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        note: event.target.value,
                      }))
                    }
                  />
                </label>
                <Button disabled={saving || loading} type="submit">
                  <WalletCards className="size-4" />
                  ثبت عملیات
                </Button>
              </form>
            </div>
          ) : (
            <AdminState>برای عملیات کیف پول یک کاربر را انتخاب کنید.</AdminState>
          )}
        </AdminSection>

        <AdminSection title="گردش کیف پول">
          {transactions.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-right text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-3 font-medium">شناسه</th>
                    <th className="py-3 font-medium">کاربر</th>
                    <th className="py-3 font-medium">نوع</th>
                    <th className="py-3 font-medium">مبلغ</th>
                    <th className="py-3 font-medium">توضیح</th>
                    <th className="py-3 font-medium">ثبت‌کننده</th>
                    <th className="py-3 font-medium">تاریخ</th>
                    <th className="py-3 font-medium">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-3 font-medium" dir="ltr">
                        {shortId(transaction.id)}
                      </td>
                      <td className="py-3">{userLabel(transaction.user)}</td>
                      <td className="py-3">
                        <AdminStatusBadge
                          type="transaction"
                          value={transaction.type}
                        />
                      </td>
                      <td className="py-3">
                        <span
                          className={
                            transaction.amount >= 0
                              ? "text-emerald-600 dark:text-emerald-300"
                              : "text-rose-600 dark:text-rose-300"
                          }
                        >
                          {formatCurrency(Math.abs(transaction.amount))}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {transaction.note ?? transaction.referenceType ?? "-"}
                      </td>
                      <td className="py-3">
                        {transaction.createdByAdmin
                          ? userLabel(transaction.createdByAdmin)
                          : "-"}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(transaction.createdAt)}
                      </td>
                      <td className="py-3">
                        <AdminStatusBadge
                          type="transaction"
                          value={transaction.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination
                page={transactionsPage}
                totalItems={transactions.length}
                totalPages={transactionsTotalPages}
                onPageChange={setTransactionsPage}
              />
            </div>
          ) : (
            <AdminState>تراکنشی ثبت نشده است.</AdminState>
          )}
        </AdminSection>
      </div>
    </div>
  );
}
