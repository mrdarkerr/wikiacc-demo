"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, Info, Sparkles, TrendingUp } from "lucide-react";
import { AdminSection, AdminState } from "./admin-section";
import { formatCurrency, formatNumber } from "./admin-formatters";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-error";
import { financeApi, type FinanceForecast, type FinanceHistory } from "@/lib/finance-api";

type Interval = "daily" | "weekly";
const compact = new Intl.NumberFormat("fa-IR", { notation: "compact", maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", day: "numeric", month: "short", year: "numeric" });
function date(key: string) { return dateFormatter.format(new Date(`${key}T12:00:00Z`)); }
function range(start: string, end: string) { return `از ${date(start)} تا ${date(end)}`; }
function amount(value: number | null) { return value === null ? "نامشخص" : formatCurrency(value); }
function Legend() {
  return <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
    <span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-sky-500" />گردش مالی</span>
    <span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-emerald-500" />سود فروش</span>
  </div>;
}
type HistoryProps = { report: FinanceHistory | null; pending: boolean; interval: Interval; error?: string; onRetry?: () => void; onInterval: (value: Interval) => void; onPage: (page: number) => void };
export function FinanceHistoryPanel({ report, pending, interval, error, onRetry, onInterval, onPage }: HistoryProps) {
  const maximum = Math.max(0, ...(report?.points.map((p) => Math.max(p.turnover, p.profit ?? 0)) ?? []));
  const partial = (report?.totals.unknownProfitItemCount ?? 0) > 0;
  return <AdminSection title="گردش مالی و سود فروش" description="فروش‌های پرداخت‌شده؛ بدون سفارش‌های لغوشده و بازپرداختی"
    action={<div role="group" aria-label="بازه گزارش مالی" className="flex rounded-lg bg-muted p-1">
      {(["daily", "weekly"] as const).map((value) => <Button key={value} size="sm" variant={interval === value ? "default" : "ghost"} aria-pressed={interval === value} onClick={() => onInterval(value)}>{value === "daily" ? "روزانه" : "هفتگی"}</Button>)}
    </div>}>
    <div data-testid="finance-history" aria-busy={pending} className="space-y-5">
      {error ? <div role="alert" className="flex flex-wrap items-center gap-3"><AdminState tone="danger">{error}</AdminState><Button size="sm" variant="outline" onClick={onRetry}>تلاش دوباره</Button></div> : null}
      {pending ? <p role="status" className="text-sm text-muted-foreground">در حال دریافت گزارش مالی...</p> : null}
      {report && !pending && !error ? <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>{range(report.range.startDate, report.range.endDate)}</p>
          <span>{formatNumber(report.totals.orderCount)} سفارش پرداخت‌شده • به وقت تهران</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><BarChart3 className="size-4 text-sky-500" />گردش مالی این بازه</p>
            <p className="mt-3 text-xl font-bold sm:text-2xl">{amount(report.totals.turnover)}</p>
            <p className="mt-2 text-xs text-muted-foreground">مجموع مبلغ فروش، شامل قیمت پایه و سود</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="size-4 text-emerald-500" />{partial ? "سود ثبت‌شدهٔ بخشی از فروش" : "سود فروش این بازه"}</p>
            <p className="mt-3 text-xl font-bold sm:text-2xl">{amount(report.totals.profit)}</p>
            <p className="mt-2 text-xs text-muted-foreground">سود ثبت‌شده هنگام سفارش؛ پیش از کسر هزینه‌ها</p>
          </div>
        </div>
        {partial ? <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-6 text-amber-700 dark:text-amber-300">{formatNumber(report.totals.unknownProfitItemCount)} قلم سفارش سابقهٔ سود ندارند؛ عدد سود فقط بخش دارای سابقه را پوشش می‌دهد.</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3"><Legend /><p className="text-[11px] text-muted-foreground lg:hidden">← نمودار را افقی بکشید →</p></div>
        <div className="overflow-x-auto rounded-lg border border-border p-3" tabIndex={0} aria-label="نمودار مالی؛ برای بازه‌های بیشتر افقی پیمایش کنید">
          <div className="flex min-w-[740px] items-end gap-4" dir="ltr">
            {report.points.map((point) => <div key={point.startDate} className="flex min-w-0 flex-1 flex-col items-center gap-2" dir="rtl">
              <div className="space-y-1 text-center text-[11px]">
                <p className="font-medium text-sky-600 dark:text-sky-400">{compact.format(point.turnover)} ت</p>
                <p className="font-medium text-emerald-600 dark:text-emerald-400">{point.profit === null ? "نامشخص" : `${compact.format(point.profit)} ت`}{point.unknownProfitItemCount && point.profit !== null ? " *" : ""}</p>
              </div>
              <div className="flex h-40 w-full items-end justify-center gap-1.5 border-b border-border" role="img" aria-label={`${range(point.startDate, point.endDate)}؛ گردش مالی ${amount(point.turnover)}؛ سود فروش ${amount(point.profit)}${point.unknownProfitItemCount ? "؛ سابقهٔ سود ناقص" : ""}`}>
                <div className="w-6 rounded-t-md bg-sky-500/85" style={{ height: maximum ? `${Math.max(1, point.turnover / maximum * 100)}%` : "2px" }} title={`گردش مالی: ${amount(point.turnover)}`} />
                <div className={`w-6 rounded-t-md ${point.profit === null ? "border border-dashed border-muted-foreground/40 bg-muted" : "bg-emerald-500/85"}`} style={{ height: maximum && point.profit !== null ? `${Math.max(1, point.profit / maximum * 100)}%` : "2px" }} title={`سود فروش: ${amount(point.profit)}${point.unknownProfitItemCount ? " (ناقص)" : ""}`} />
              </div>
              <div className="min-h-20 text-center text-[11px] leading-5 text-muted-foreground">
                {interval === "weekly" ? <><p>از {date(point.startDate)}</p><p>تا {date(point.endDate)}</p></> : <p>{date(point.startDate)}</p>}
                {point.isPartial ? <span className="mt-1 inline-block rounded bg-muted px-1.5 text-[10px]">در حال تکمیل</span> : null}
              </div>
            </div>)}
          </div>
        </div>
        {!report.totals.orderCount ? <AdminState>در این بازه فروشی ثبت نشده است.</AdminState> : null}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!report.pagination.hasOlder} onClick={() => onPage(report.pagination.page + 1)}><ArrowRight className="size-4" /><span>بازه‌های قدیمی‌تر</span></Button>
            <Button size="sm" variant="outline" disabled={!report.pagination.hasNewer} onClick={() => onPage(report.pagination.page - 1)}><span>بازه‌های جدیدتر</span><ArrowLeft className="size-4" /></Button>
          </div>
          <p className="text-xs text-muted-foreground">صفحهٔ {formatNumber(report.pagination.page)} از {formatNumber(report.pagination.totalPages)}</p>
        </div>
        <p className="flex items-start gap-2 text-xs leading-6 text-muted-foreground"><Info className="mt-1 size-4 shrink-0" />مبنای تاریخ، زمان ثبت سفارش است. سود فروش، سود خالص پس از کارمزد و هزینه‌های کسب‌وکار نیست.{partial ? " علامت * یعنی سابقهٔ سود آن بازه ناقص است." : ""}</p>
      </> : null}
    </div>
  </AdminSection>;
}
export function FinanceForecastPanel({ report }: { report: FinanceForecast }) {
  return <AdminSection title="پیش‌بینی درآمد مالی" description="برآورد گردش مالی و سود فروش؛ مستقل از بازهٔ انتخاب‌شدهٔ نمودار">
    <div data-testid="finance-forecast" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Sparkles className="size-4" /><span>میانگین روزانهٔ {formatNumber(report.sample.observedDays)} روز کامل اخیر • {formatNumber(report.sample.orderCount)} سفارش</span><span className="rounded-full bg-muted px-2.5 py-1">برآورد، نه درآمد قطعی</span></div>
      {report.status === "INSUFFICIENT_DATA" ? <p className="rounded-lg bg-muted p-3 text-sm leading-6">دادهٔ کافی برای پیش‌بینی نداریم؛ حداقل ۷ روز سابقه و ۳ سفارش پرداخت‌شده در نمونه لازم است.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {report.horizons.map((horizon) => <div key={horizon.days} className="rounded-xl border border-border bg-muted/20 p-4">
          <h3 className="text-sm font-bold">{formatNumber(horizon.days)} روز آینده</h3>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{range(horizon.startDate, horizon.endDate)}</p>
          <div className="mt-4 space-y-3">
            <div><p className="text-xs text-sky-600 dark:text-sky-400">گردش مالی پیش‌بینی‌شده</p><p className="mt-1 text-lg font-bold">{amount(horizon.turnover)}</p></div>
            <div className="border-t border-border pt-3"><p className="text-xs text-emerald-600 dark:text-emerald-400">سود فروش پیش‌بینی‌شده</p><p className="mt-1 text-lg font-bold">{amount(horizon.profit)}</p></div>
          </div>
        </div>)}
      </div>
      {report.sample.unknownProfitItemCount > 0 ? <p className="text-xs leading-6 text-amber-700 dark:text-amber-300">به دلیل نبود سابقهٔ سود برای بخشی از سفارش‌های نمونه، پیش‌بینی سود نامشخص است.</p> : null}
      <p className="text-xs leading-6 text-muted-foreground">{range(report.sample.startDate, report.sample.endDate)}؛ روزهای بدون فروش هم محاسبه شده‌اند. امروزِ ناقص در نمونه نیست. این برآورد تضمین درآمد یا پیش‌بینی نرخ دلار نیست؛ کارمزد و هزینه‌های جانبی از سود کسر نشده‌اند.</p>
    </div>
  </AdminSection>;
}
function message(error: unknown) { return error instanceof ApiError ? error.message : "دریافت گزارش مالی انجام نشد."; }
export function FinanceDashboard() {
  const [query, setQuery] = useState<{ interval: Interval; page: number }>({ interval: "daily", page: 1 });
  const [history, setHistory] = useState<FinanceHistory | null>(null);
  const [forecast, setForecast] = useState<FinanceForecast | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [forecastError, setForecastError] = useState("");
  const [pending, setPending] = useState(true);
  const [revision, setRevision] = useState(0);
  const [forecastRevision, setForecastRevision] = useState(0);
  const activeHistory = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    activeHistory.current = controller;
    financeApi.history(query, { signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setHistory(data); setHistoryError(""); }
    }).catch((error) => { if (!controller.signal.aborted) setHistoryError(message(error)); })
      .finally(() => { if (!controller.signal.aborted) setPending(false); });
    return () => controller.abort();
  }, [query, revision]);
  useEffect(() => {
    const controller = new AbortController();
    financeApi.forecast({ signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) { setForecast(data); setForecastError(""); }
    }).catch((error) => { if (!controller.signal.aborted) setForecastError(message(error)); });
    return () => controller.abort();
  }, [forecastRevision]);
  // Cancel synchronously: callbacks may settle before passive-effect cleanup.
  function changeQuery(next: typeof query) { activeHistory.current?.abort(); setPending(true); setHistoryError(""); setQuery(next); }
  return <div className="space-y-6">
    <FinanceHistoryPanel report={history} interval={query.interval} pending={pending} error={historyError}
      onInterval={(interval) => changeQuery({ interval, page: 1 })} onPage={(page) => changeQuery({ ...query, page })}
      onRetry={() => { activeHistory.current?.abort(); setPending(true); setHistoryError(""); setRevision((n) => n + 1); }} />
    {forecast && !forecastError ? <FinanceForecastPanel report={forecast} /> : <AdminSection title="پیش‌بینی درآمد مالی">
      {forecastError ? <div role="alert" className="space-y-3"><AdminState tone="danger">{forecastError}</AdminState><Button size="sm" variant="outline" onClick={() => { setForecastError(""); setForecastRevision((n) => n + 1); }}>تلاش دوباره</Button></div> : <AdminState>در حال دریافت پیش‌بینی...</AdminState>}
    </AdminSection>}
  </div>;
}
