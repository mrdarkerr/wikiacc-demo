"use client";

import { useEffect, useState } from "react";
import { CreditCard, WalletCards } from "lucide-react";

import { formatCurrency, formatDate } from "@/components/panel/formatters";
import { MetricCard } from "@/components/panel/metric-card";
import { PanelSection } from "@/components/panel/panel-section";
import {
  StatusBadge,
  transactionTypeLabel,
} from "@/components/panel/status-badge";
import { api, ApiError } from "@/lib/api";
import type { ApiMeta, WalletSummary, WalletTransaction } from "@/types/api";

const PER_PAGE = 10;

function transactionDescription(transaction: WalletTransaction) {
  const note = transaction.note?.trim();

  if (transaction.type === "ORDER_PAYMENT") {
    return "خرید محصول";
  }

  if (transaction.type === "ORDER_REFUND") {
    return "بازگشت وجه سفارش";
  }

  if (transaction.type === "ADMIN_CREDIT") {
    return note ? `شارژ کیف پول - ${note}` : "شارژ کیف پول توسط پشتیبانی";
  }

  if (transaction.type === "ADMIN_DEBIT") {
    return note ? `برداشت از کیف پول - ${note}` : "برداشت از کیف پول توسط پشتیبانی";
  }

  return note || "شارژ آنلاین کیف پول";
}

function transactionAmountClass(transaction: WalletTransaction) {
  return transaction.amount >= 0
    ? "text-emerald-600 dark:text-emerald-300"
    : "text-rose-600 dark:text-rose-300";
}

function transactionAmountSign(transaction: WalletTransaction) {
  return transaction.amount >= 0 ? "+" : "-";
}

export default function WalletPage() {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transactionsMeta, setTransactionsMeta] = useState<ApiMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    api.wallet
      .summary()
      .then((result) => {
        if (active) {
          setSummary(result);
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : "دریافت کیف پول انجام نشد.",
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

  useEffect(() => {
    let active = true;

    api.wallet
      .transactionsPage({ page, perPage: PER_PAGE })
      .then((result) => {
        if (!active) return;
        setTransactions(result.data.transactions);
        setTransactionsMeta(result.meta ?? null);
        setError("");
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : "دریافت تراکنش ها انجام نشد.",
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

  const wallet = summary?.wallet;
  const totalPages = transactionsMeta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          helper="موجودی قابل استفاده برای خریدهای بعدی"
          icon={WalletCards}
          label="موجودی فعلی"
          tone="emerald"
          value={formatCurrency(wallet?.balance ?? 0)}
        />
        <MetricCard
          helper="شارژ کیف پول و پرداخت مستقیم سفارش‌ها"
          icon={CreditCard}
          label="پرداخت آنلاین"
          tone="amber"
          value="کیف پول"
        />
      </div>

      <PanelSection
        description="شارژها، خریدها و بازگشت وجه ها"
        title="گردش کیف پول"
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">در حال دریافت تراکنش ها...</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : transactions.length ? (
          <>
            <div className="space-y-3 md:hidden">
              {transactions.map((transaction) => (
                <article
                  className="rounded-md border border-border bg-background/60 p-4 text-sm"
                  key={transaction.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">نوع تراکنش</p>
                      <h3 className="mt-1 font-bold">
                        {transactionTypeLabel(transaction.type)}
                      </h3>
                    </div>
                    <StatusBadge type="transaction" value={transaction.status} />
                  </div>

                  <p className="mt-3 leading-6 text-muted-foreground">
                    {transactionDescription(transaction)}
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">مبلغ</p>
                      <p
                        className={`mt-1 font-bold ${transactionAmountClass(
                          transaction,
                        )}`}
                      >
                        {transactionAmountSign(transaction)}
                        {formatCurrency(Math.abs(transaction.amount))}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">تاریخ</p>
                      <p className="mt-1 font-medium">
                        {formatDate(transaction.createdAt)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground" dir="ltr">
                    {transaction.id.slice(-8).toUpperCase()}
                  </p>
                </article>
              ))}
            </div>

            <div className="hidden w-full max-w-full overflow-x-auto overscroll-x-contain md:block">
              <table className="w-full min-w-[680px] text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3 font-medium">شناسه</th>
                  <th className="py-3 font-medium">نوع</th>
                  <th className="py-3 font-medium">شرح</th>
                  <th className="py-3 font-medium">مبلغ</th>
                  <th className="py-3 font-medium">تاریخ</th>
                  <th className="py-3 font-medium">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-3 font-medium" dir="ltr">
                      {transaction.id.slice(-8).toUpperCase()}
                    </td>
                    <td className="py-3">{transactionTypeLabel(transaction.type)}</td>
                    <td className="py-3 text-muted-foreground">
                      {transactionDescription(transaction)}
                    </td>
                    <td className="py-3">
                      <span className={transactionAmountClass(transaction)}>
                        {formatCurrency(Math.abs(transaction.amount))}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(transaction.createdAt)}
                    </td>
                    <td className="py-3">
                      <StatusBadge type="transaction" value={transaction.status} />
                    </td>
                  </tr>
                ))}
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
          <p className="text-sm text-muted-foreground">تراکنشی ثبت نشده است.</p>
        )}
      </PanelSection>
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
        <button
          className="h-9 rounded-md border border-input px-3 text-sm disabled:opacity-50"
          disabled={page <= 1}
          type="button"
          onClick={() => onPageChange(page - 1)}
        >
          قبلی
        </button>
        <button
          className="h-9 rounded-md border border-input px-3 text-sm disabled:opacity-50"
          disabled={page >= totalPages}
          type="button"
          onClick={() => onPageChange(page + 1)}
        >
          بعدی
        </button>
      </div>
    </div>
  );
}
