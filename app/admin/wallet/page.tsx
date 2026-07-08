"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CircleMinus,
  CirclePlus,
  Eye,
  ReceiptText,
  Search,
  WalletCards,
  X,
} from "lucide-react";

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
import { DialogOverlay } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type {
  AdminUser,
  AdminWalletSummary,
  AdminWalletTransaction,
} from "@/types/api";

type WalletAction = "credit" | "debit";

type WalletForm = {
  amount: string;
  note: string;
};

const TRANSACTIONS_PER_PAGE = 12;
const USERS_PER_PAGE = 10;

const initialForm: WalletForm = {
  amount: "",
  note: "",
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

function actionLabel(action: WalletAction) {
  return action === "credit" ? "افزایش موجودی" : "کاهش موجودی";
}

function transactionAmountClass(amount: number) {
  return amount >= 0
    ? "text-emerald-600 dark:text-emerald-300"
    : "text-rose-600 dark:text-rose-300";
}

export default function AdminWalletPage() {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("userId") ?? "";
  });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<AdminWalletSummary | null>(null);
  const [transactions, setTransactions] = useState<AdminWalletTransaction[]>([]);
  const [form, setForm] = useState<WalletForm>(initialForm);
  const [activeAction, setActiveAction] = useState<WalletAction | null>(null);
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

  async function loadWallet() {
    const [usersResult, summaryResult, transactionsResult] = await Promise.all([
      api.admin.users.list(),
      api.admin.wallet.summary(),
      api.admin.wallet.transactions(),
    ]);
    setUsers(usersResult.users);
    setSummary(summaryResult.summary);
    setTransactions(transactionsResult.transactions);
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
        setUsers(usersResult.users);
        setSummary(summaryResult.summary);
        setTransactions(transactionsResult.transactions);
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
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
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

  const userTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.userId === selectedUserId ||
          transaction.user.id === selectedUserId,
      ),
    [transactions, selectedUserId],
  );

  const usersTotalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / USERS_PER_PAGE),
  );
  const paginatedUsers = filteredUsers.slice(
    (usersPage - 1) * USERS_PER_PAGE,
    usersPage * USERS_PER_PAGE,
  );
  const transactionsTotalPages = Math.max(
    1,
    Math.ceil(userTransactions.length / TRANSACTIONS_PER_PAGE),
  );
  const paginatedTransactions = userTransactions.slice(
    (transactionsPage - 1) * TRANSACTIONS_PER_PAGE,
    transactionsPage * TRANSACTIONS_PER_PAGE,
  );

  const creditTotal = useMemo(
    () =>
      userTransactions
        .filter((transaction) => transaction.amount > 0)
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [userTransactions],
  );

  const debitTotal = useMemo(
    () =>
      userTransactions
        .filter((transaction) => transaction.amount < 0)
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [userTransactions],
  );

  const walletMetrics = useMemo(
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

  const userMetrics = selectedUser
    ? [
        {
          label: "موجودی فعلی",
          value: formatCurrency(selectedUser.wallet?.balance ?? 0),
        },
        {
          label: "تعداد تراکنش‌ها",
          value: formatNumber(userTransactions.length),
        },
        {
          label: "جمع افزایش‌ها",
          value: formatCurrency(creditTotal),
        },
        {
          label: "جمع کاهش‌ها",
          value: formatCurrency(debitTotal),
        },
        {
          label: "آخرین تراکنش",
          value: formatDate(userTransactions[0]?.createdAt),
        },
      ]
    : [];

  function openUserWallet(userId: string) {
    router.push(`/admin/wallet?userId=${encodeURIComponent(userId)}`);
    setSelectedUserId(userId);
    setTransactionsPage(1);
    setMessage("");
    setError("");
  }

  function backToWalletList() {
    router.push("/admin/wallet");
    setSelectedUserId("");
    setTransactionsPage(1);
    setActiveAction(null);
    setForm(initialForm);
    setMessage("");
    setError("");
  }

  function openAction(action: WalletAction) {
    setActiveAction(action);
    setForm(initialForm);
    setError("");
    setMessage("");
  }

  async function adjustWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser || !activeAction) return;

    setSaving(true);
    try {
      const body = {
        amount: Number(form.amount),
        note: optionalText(form.note),
      };

      if (activeAction === "credit") {
        await api.admin.wallet.credit(selectedUser.id, body);
      } else {
        await api.admin.wallet.debit(selectedUser.id, body);
      }

      await loadWallet();
      setActiveAction(null);
      setForm(initialForm);
      setMessage("کیف پول به‌روز شد.");
      setError("");
    } catch (adjustError) {
      setError(errorMessage(adjustError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AdminState>در حال دریافت کیف پول...</AdminState>;
  }

  if (selectedUserId && !selectedUser) {
    return (
      <div className="space-y-4">
        <Button type="button" variant="outline" onClick={backToWalletList}>
          <ArrowRight className="size-4" />
          بازگشت به کیف پول
        </Button>
        <AdminState tone="danger">{error || "کاربر پیدا نشد."}</AdminState>
      </div>
    );
  }

  if (selectedUser) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Button
              size="sm"
              type="button"
              variant="ghost"
              onClick={backToWalletList}
            >
              <ArrowRight className="size-4" />
              کیف پول
            </Button>
            <h2 className="mt-2 text-2xl font-bold">{userLabel(selectedUser)}</h2>
            <p className="mt-1 text-sm text-muted-foreground" dir="ltr">
              {selectedUser.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => openAction("credit")}>
              <CirclePlus className="size-4" />
              افزایش موجودی
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => openAction("debit")}
            >
              <CircleMinus className="size-4" />
              کاهش موجودی
            </Button>
          </div>
        </div>

        {message ? <AdminState tone="success">{message}</AdminState> : null}
        {error ? <AdminState tone="danger">{error}</AdminState> : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {userMetrics.map((metric) => (
            <div
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
              key={metric.label}
            >
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <p className="mt-2 text-xl font-bold">{metric.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
          <AdminSection title="اطلاعات کیف پول">
            <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-md bg-muted/50 p-3">
                <dt className="text-muted-foreground">نام</dt>
                <dd className="mt-1 font-medium">{selectedUser.name}</dd>
              </div>
              <div className="rounded-md bg-muted/50 p-3">
                <dt className="text-muted-foreground">ایمیل</dt>
                <dd className="mt-1 font-medium" dir="ltr">
                  {selectedUser.email}
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
                <dt className="text-muted-foreground">تاریخ ثبت نام</dt>
                <dd className="mt-1 font-medium">
                  {formatDate(selectedUser.createdAt)}
                </dd>
              </div>
              <div className="rounded-md bg-muted/50 p-3">
                <dt className="text-muted-foreground">شناسه کیف پول</dt>
                <dd className="mt-1 font-medium" dir="ltr">
                  {shortId(selectedUser.wallet?.id)}
                </dd>
              </div>
            </dl>
          </AdminSection>

          <AdminSection
            description="ریز تراکنش‌های ثبت‌شده برای این کاربر"
            title="تراکنش‌های کیف پول"
          >
            {userTransactions.length ? (
              <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[880px] text-right text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-3 font-medium">شناسه</th>
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
                        className="border-b border-border last:border-0"
                        key={transaction.id}
                      >
                        <td className="py-3 font-medium" dir="ltr">
                          {shortId(transaction.id)}
                        </td>
                        <td className="py-3">
                          <AdminStatusBadge
                            type="transaction"
                            value={transaction.type}
                          />
                        </td>
                        <td className="py-3">
                          <span className={transactionAmountClass(transaction.amount)}>
                            {transaction.amount >= 0 ? "+" : "-"}
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
                  totalItems={userTransactions.length}
                  totalPages={transactionsTotalPages}
                  onPageChange={setTransactionsPage}
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                <ReceiptText className="size-5" />
                تراکنشی برای این کاربر ثبت نشده است.
              </div>
            )}
          </AdminSection>
        </div>

        {activeAction ? (
          <DialogOverlay
            contentClassName="max-w-md rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xl"
            onClose={() => {
              if (!saving) setActiveAction(null);
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold">{actionLabel(activeAction)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {userLabel(selectedUser)}
                </p>
              </div>
              <Button
                aria-label="بستن"
                disabled={saving}
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => setActiveAction(null)}
              >
                <X className="size-4" />
              </Button>
            </div>

            <form className="space-y-4" onSubmit={adjustWallet}>
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
                  className="mt-2 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.note}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={saving} type="submit">
                  <WalletCards className="size-4" />
                  ثبت عملیات
                </Button>
                <Button
                  className="flex-1"
                  disabled={saving}
                  type="button"
                  variant="outline"
                  onClick={() => setActiveAction(null)}
                >
                  انصراف
                </Button>
              </div>
            </form>
          </DialogOverlay>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message ? <AdminState tone="success">{message}</AdminState> : null}
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {walletMetrics.map((metric) => (
          <div
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
            key={metric.label}
          >
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-xl font-bold">{metric.value}</p>
          </div>
        ))}
      </div>

      <AdminSection
        description="با انتخاب کاربر وارد صفحه مالی همان کاربر می‌شوید"
        title="موجودی کاربران"
      >
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

        {filteredUsers.length ? (
          <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[820px] text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3 font-medium">شناسه</th>
                  <th className="py-3 font-medium">نام</th>
                  <th className="py-3 font-medium">ایمیل</th>
                  <th className="py-3 font-medium">موبایل</th>
                  <th className="py-3 font-medium">موجودی</th>
                  <th className="py-3 font-medium">نقش</th>
                  <th className="py-3 font-medium">ثبت نام</th>
                  <th className="py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr
                    className="border-b border-border last:border-0"
                    key={user.id}
                  >
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
                    <td className="py-3 font-medium">
                      {formatCurrency(user.wallet?.balance ?? 0)}
                    </td>
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
                        variant="outline"
                        onClick={() => openUserWallet(user.id)}
                      >
                        <Eye className="size-4" />
                        صفحه مالی
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
    </div>
  );
}
