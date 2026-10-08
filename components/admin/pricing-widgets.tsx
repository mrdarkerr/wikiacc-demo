import { CircleDollarSign, Clock3, ShieldCheck, TriangleAlert } from "lucide-react";
import { formatCurrency, formatDate, formatTime } from "./admin-formatters";
import type { ExchangeRate, PricingQuote } from "../../types/api";

const statusLabels = { FRESH: "به‌روز", STALE: "قدیمی · آخرین نرخ معتبر", FALLBACK: "نرخ جایگزین مدیریت", DEFAULT: "نرخ پیش‌فرض" };
export function rateTimestamp(value: string | null) { return value ? `${formatDate(value)}، ${formatTime(value)}` : "هنوز دریافت نشده"; }

export function RateSummary({ rate }: { rate: ExchangeRate }) {
  const fresh = rate.status === "FRESH";
  return <div className="space-y-3" data-testid="rate-summary">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm font-semibold"><CircleDollarSign className="size-5 text-primary" />تتر / تومان · والکس</span>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${fresh ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>
        {fresh ? <ShieldCheck className="size-3.5" /> : <TriangleAlert className="size-3.5" />}{statusLabels[rate.status]}
      </span>
    </div>
    <p className="text-2xl font-bold tabular-nums sm:text-3xl">{formatCurrency(rate.rateToman)}</p>
    <p className="flex flex-wrap items-center gap-1.5 text-xs leading-6 text-muted-foreground"><Clock3 className="size-3.5" />آخرین دریافت معتبر: {rateTimestamp(rate.fetchedAt)}</p>
    {rate.status === "STALE" ? <p className="text-xs leading-6 text-amber-700 dark:text-amber-300">نرخ تازه نشده است؛ آخرین نرخ معتبر همچنان مبنای محاسبه است.</p> : null}
    {["FALLBACK", "DEFAULT"].includes(rate.status) ? <p className="text-xs leading-6 text-amber-700 dark:text-amber-300">هنوز نرخ معتبر ذخیره‌شده نداریم؛ این مبلغ جایگزین نرخ والکس است.</p> : null}
    {rate.lastErrorCode ? <p className="text-xs text-amber-700 dark:text-amber-300">خطای آخرین دریافت: <bdi dir="ltr">{rate.lastErrorCode}</bdi></p> : null}
  </div>;
}

export function PricingBreakdown({ pricing }: { pricing: PricingQuote }) {
  return <div className="space-y-4" data-testid="pricing-breakdown">
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <p className="text-xs font-medium text-muted-foreground">قیمت نهایی مشتری</p>
      <p className="mt-2 text-2xl font-bold text-primary sm:text-3xl">{formatCurrency(pricing.unitPrice)}</p>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">فقط این مبلغ در فروشگاه نمایش داده می‌شود؛ قیمت پایه و سود خصوصی‌اند.</p>
    </div>
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <div className="rounded-md border border-border p-3"><dt className="text-xs text-muted-foreground">قیمت پایه به تومان</dt><dd className="mt-2 font-semibold">{formatCurrency(pricing.baseToman)}</dd></div>
      <div className="rounded-md border border-border p-3"><dt className="text-xs text-muted-foreground">سود هر واحد</dt><dd className="mt-2 font-semibold">{formatCurrency(pricing.profitToman)}</dd></div>
    </dl>
    {(pricing.priceCurrency === "USD" || pricing.profitType === "USD") ? <div className="rounded-md bg-muted/40 p-3 text-xs"><span className="font-medium">نرخ مبنای این پیش‌نمایش: </span>{formatCurrency(pricing.exchangeRate.rateToman)}<span className="mt-2 block text-muted-foreground">{statusLabels[pricing.exchangeRate.status]}</span></div> : null}
  </div>;
}
