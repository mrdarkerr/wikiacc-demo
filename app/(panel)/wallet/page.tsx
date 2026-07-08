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
import type { WalletSummary } from "@/types/api";

export default function WalletPage() {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
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

  const wallet = summary?.wallet;
  const transactions = summary?.transactions ?? [];

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
          <div className="overflow-x-auto">
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
                      {transaction.note ?? transaction.referenceType ?? "-"}
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
        ) : (
          <p className="text-sm text-muted-foreground">تراکنشی ثبت نشده است.</p>
        )}
      </PanelSection>
    </div>
  );
}
