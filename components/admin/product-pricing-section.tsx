"use client";

import { Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { AdminSection } from "./admin-section";
import { PricingBreakdown } from "./pricing-widgets";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import type { PriceCurrency, PricingQuote } from "../../types/api";

type PricingForm = { priceCurrency: PriceCurrency; basePrice: string; profit: string };
export function ProductPricingSection({ form, onChange, preview, disabled }: {
  form: PricingForm; onChange: (patch: Partial<PricingForm>) => void; disabled: boolean;
  preview: { pricing: PricingQuote | null; pending: boolean; error: string; refresh: () => void };
}) {
  return <AdminSection title="قیمت‌گذاری و سود" description="معیار داخلی قیمت را انتخاب کنید؛ مبلغ فروش به مشتری همیشه تومان است.">
    <fieldset disabled={disabled} className="grid gap-6 disabled:opacity-70 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-testid="product-pricing-section">
      <div className="space-y-5">
        <label className="block text-sm font-medium" htmlFor="priceCurrency">معیار قیمت پایه
          <Select id="priceCurrency" name="priceCurrency" className="mt-2" value={form.priceCurrency} onChange={(event) => onChange({ priceCurrency: event.target.value as PriceCurrency, basePrice: "" })}>
            <option value="TOMAN">تومان · قیمت ثابت</option><option value="USD">دلار · محاسبه با تتر / تومان والکس</option>
          </Select>
        </label>
        <label className="block text-sm font-medium" htmlFor="basePrice">قیمت پایه {form.priceCurrency === "USD" ? "(دلار)" : "(تومان)"}
          <Input id="basePrice" name="basePrice" className="mt-2" dir="ltr" inputMode={form.priceCurrency === "USD" ? "decimal" : "numeric"} maxLength={24} required value={form.basePrice} placeholder={form.priceCurrency === "USD" ? "2.5" : "180000"} onChange={(event) => onChange({ basePrice: event.target.value })} />
          <span className="mt-2 block text-xs leading-6 text-muted-foreground">{form.priceCurrency === "USD" ? "تا ۶ رقم اعشار؛ با تغییر نرخ ذخیره‌شده، قیمت فروش خودکار به‌روز می‌شود." : "مبلغ صحیح و بدون سود؛ نرخ ارز روی این قیمت پایه اثری ندارد."}</span>
        </label>
        <label className="block text-sm font-medium" htmlFor="profit">سود هر واحد محصول
          <Input id="profit" name="profit" className="mt-2" dir="ltr" maxLength={32} value={form.profit} placeholder="20000 / %10 / $2" aria-describedby="profit-help" onChange={(event) => onChange({ profit: event.target.value })} />
          <span id="profit-help" className="mt-2 block text-xs leading-6 text-muted-foreground">عدد ساده: تومان · درصد: روی قیمت پایه · دلار: تبدیل با همان نرخ ارز. خالی یا صفر یعنی بدون سود.</span>
        </label>
        <div className="flex flex-wrap gap-2" aria-label="نمونه‌های ورودی سود">
          {[['20000', 'تومانی'], ['%10', 'درصدی'], ['$2', 'دلاری'], ['0', 'بدون سود']].map(([value, label]) => <button key={value} type="button" className="rounded-md border border-border px-3 py-2 text-xs transition hover:border-primary hover:bg-primary/5" onClick={() => onChange({ profit: value })}><span>{label}</span><bdi dir="ltr" className="mr-2 font-semibold">{value}</bdi></button>)}
        </div>
      </div>
      <div className="min-w-0 rounded-lg border border-border bg-background p-4">
        <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-sm font-bold">پیش‌نمایش قیمت فروش</h3><Button size="sm" variant="ghost" type="button" disabled={preview.pending || !form.basePrice} onClick={preview.refresh}><RefreshCw className="size-3.5" />تازه‌سازی</Button></div>
        <div aria-live="polite" aria-busy={preview.pending}>
          {preview.pending ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />در حال محاسبه با بک‌اند...</div>
            : preview.error ? <p className="rounded-md bg-muted/40 p-4 text-sm leading-7" role="status">{preview.error}</p>
            : preview.pricing ? <PricingBreakdown pricing={preview.pricing} /> : <p className="text-sm text-muted-foreground">قیمت پایه را وارد کنید.</p>}
        </div>
        <p className="mt-4 flex items-start gap-2 text-xs leading-6 text-muted-foreground"><LockKeyhole className="mt-1 size-3.5 shrink-0" />محاسبات از سرور می‌آید؛ قیمت و سود هنگام ثبت سفارش ثابت و ذخیره می‌شوند.</p>
      </div>
    </fieldset>
  </AdminSection>;
}
