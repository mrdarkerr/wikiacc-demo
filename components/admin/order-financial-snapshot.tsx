import { LockKeyhole } from "lucide-react";
import { AdminSection } from "./admin-section";
import { formatCurrency } from "./admin-formatters";
import { rateTimestamp } from "./pricing-widgets";
import type { AdminOrderItem } from "../../types/api";

export function OrderFinancialSnapshot({ items }: { items: AdminOrderItem[] }) {
  return <AdminSection title="سوابق مالی زمان ثبت سفارش" description="خصوصی برای مدیریت؛ این مبالغ با تغییر قیمت محصول یا نرخ ارز تغییر نمی‌کنند.">
    <div className="space-y-4" data-testid="order-financial-snapshot">{items.map((item) => {
      const recorded = typeof item.baseTomanSnapshot === "number" && typeof item.profitTomanSnapshot === "number" && typeof item.totalProfitSnapshot === "number";
      const source = item.rateSourceSnapshot === "WALLEX" ? "والکس" : item.rateSourceSnapshot === "FALLBACK" ? "جایگزین مدیریت" : item.rateSourceSnapshot === "DEFAULT" ? "پیش‌فرض" : "ثبت نشده";
      return <article key={item.id} className="rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{item.titleSnapshot}</h3><span className="text-xs text-muted-foreground">تعداد: {item.quantity.toLocaleString("fa-IR")}</span></div>
        {!recorded ? <p className="mt-3 text-sm leading-7 text-muted-foreground">دادهٔ مالی زمان ثبت در دسترس نیست؛ برای سفارش‌های قدیمی، قیمت پایه یا سود را از قیمت امروز بازسازی نمی‌کنیم.</p>
          : <><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-md bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">قیمت پایهٔ ثبت‌شده</dt><dd className="mt-2 font-semibold"><bdi dir="ltr">{item.basePriceSnapshot}</bdi> {item.priceCurrencySnapshot === "USD" ? "دلار" : "تومان"}</dd></div>
            <div className="rounded-md bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">قیمت پایهٔ هر واحد به تومان</dt><dd className="mt-2 font-semibold">{formatCurrency(item.baseTomanSnapshot!)}</dd></div>
            <div className="rounded-md bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">قیمت فروش هر واحد</dt><dd className="mt-2 font-semibold">{formatCurrency(item.priceSnapshot)}</dd></div>
            <div className="rounded-md bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">معیار سود</dt><dd className="mt-2 font-semibold"><bdi dir="ltr">{item.profitTypeSnapshot === "PERCENT" ? "%" : item.profitTypeSnapshot === "USD" ? "$" : ""}{item.profitValueSnapshot}</bdi>{item.profitTypeSnapshot === "TOMAN" ? " تومان" : ""}</dd></div>
            <div className="rounded-md bg-muted/40 p-3"><dt className="text-xs text-muted-foreground">سود ثبت‌شدهٔ هر واحد</dt><dd className="mt-2 font-semibold">{formatCurrency(item.profitTomanSnapshot!)}</dd></div>
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3"><dt className="text-xs text-muted-foreground">سود ثبت‌شده برای کل تعداد</dt><dd className="mt-2 font-semibold text-primary">{formatCurrency(item.totalProfitSnapshot!)}</dd></div>
          </dl><p className="mt-4 text-xs leading-6 text-muted-foreground">نرخ زمان ثبت: {typeof item.exchangeRateSnapshot === "number" ? formatCurrency(item.exchangeRateSnapshot) : "ثبت نشده"} · منبع: {source} · دریافت: {rateTimestamp(item.rateFetchedAtSnapshot)}</p></>}
      </article>;
    })}</div>
    <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-muted-foreground"><LockKeyhole className="mt-1 size-3.5 shrink-0" />این حاشیهٔ سودِ قیمت‌گذاری است؛ سود خالص تحقق‌یافته نیست و هزینهٔ درگاه، تحویل یا بازگشت وجه از آن کسر نشده است.</p>
  </AdminSection>;
}
