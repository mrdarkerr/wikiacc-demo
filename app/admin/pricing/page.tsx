"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Clock3, RefreshCw, Save, Send } from "lucide-react";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { ExchangeRatePanel } from "@/components/admin/exchange-rate-card";
import { rateTimestamp } from "@/components/admin/pricing-widgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { numericInput, pricingError } from "@/lib/pricing";
import { usePricingStatus } from "@/lib/use-pricing";
import type { PricingSettings } from "@/types/api";

const fields = [
  { key: "fallbackRateToman", label: "نرخ جایگزین (تومان)", min: 10001, max: 2147483647, hint: "فقط وقتی هیچ نرخ معتبر ذخیره‌شده‌ای وجود ندارد استفاده می‌شود؛ جایگزین اجباری آخرین نرخ نیست." },
  { key: "staleAfterSeconds", label: "مهلت قدیمی شدن نرخ (ثانیه)", min: 120, max: 86400, hint: "پس از این فاصله از آخرین دریافت موفق، نرخ قدیمی محسوب می‌شود. پیش‌فرض: ۳۰۰ ثانیه." },
  { key: "alertCooldownSeconds", label: "فاصلهٔ تکرار هشدار (ثانیه)", min: 120, max: 86400, hint: "از ارسال پی‌درپی هشدار یک اختلال جلوگیری می‌کند. پیش‌فرض: ۱۸۰۰ ثانیه." },
] as const;
type SettingsForm = Record<(typeof fields)[number]["key"], string>;
function settingsForm(settings: PricingSettings): SettingsForm {
  return { fallbackRateToman: String(settings.fallbackRateToman), staleAfterSeconds: String(settings.staleAfterSeconds), alertCooldownSeconds: String(settings.alertCooldownSeconds) };
}

export default function AdminPricingPage() {
  const status = usePricingStatus();
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [saved, setSaved] = useState<SettingsForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);
  const load = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    try {
      const result = await api.admin.pricing.getSettings(request.signal);
      if (!request.signal.aborted) { const value = settingsForm(result.settings); setForm(value); setSaved(value); setError(""); }
    } catch (reason) { if (!request.signal.aborted) setError(pricingError(reason)); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => { mounted.current = false; window.clearTimeout(timer); controller.current?.abort(); };
  }, [load]);
  const dirty = Boolean(form && saved && fields.some(({ key }) => form[key] !== saved[key]));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || lock.current) return;
    const body = { fallbackRateToman: 0, staleAfterSeconds: 0, alertCooldownSeconds: 0 };
    for (const field of fields) {
      const raw = numericInput(form[field.key]);
      const value = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isInteger(value) || value < field.min || value > field.max) {
        setError(`«${field.label}» باید عدد صحیح بین ${field.min.toLocaleString("fa-IR")} و ${field.max.toLocaleString("fa-IR")} باشد.`);
        setSuccess(""); return;
      }
      body[field.key] = value;
    }
    lock.current = true; setSaving(true); setError(""); setSuccess("");
    try {
      const result = await api.admin.pricing.updateSettings(body);
      if (!mounted.current) return;
      const value = settingsForm(result.settings);
      setForm(value); setSaved(value); setSuccess("تنظیمات قیمت‌گذاری ذخیره شد.");
      void status.refresh();
    } catch (reason) { if (mounted.current) setError(pricingError(reason)); }
    finally { lock.current = false; if (mounted.current) setSaving(false); }
  }
  return <div className="space-y-6">
    <ExchangeRatePanel status={status} />
    <AdminSection title="تنظیمات نرخ و هشدار" description="اولویت محاسبه: آخرین نرخ معتبر ← نرخ جایگزین مدیریت ← پیش‌فرض ۲۷۰ هزار تومان."
      action={<Button type="button" size="sm" variant="outline" disabled={loading || saving} onClick={() => {
        if (dirty && !window.confirm("تغییرات ذخیره‌نشده کنار گذاشته شود و تنظیمات سرور دوباره خوانده شود؟")) return;
        setSuccess(""); void load();
      }}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />بازخوانی تنظیمات</Button>}>
      {error ? <div className="mb-4" role="alert"><AdminState tone="danger">{error}</AdminState></div> : null}
      {success ? <div className="mb-4" role="status"><AdminState tone="success">{success}</AdminState></div> : null}
      {loading ? <AdminState>در حال دریافت تنظیمات...</AdminState> : !form ? <AdminState>تنظیمات دریافت نشد؛ بازخوانی را بزنید.</AdminState> : <form onSubmit={save} className="space-y-5">
        <fieldset disabled={saving} className="grid gap-5 disabled:opacity-70 xl:grid-cols-3">
          {fields.map((field) => <label key={field.key} className="block text-sm font-medium" htmlFor={field.key}>{field.label}
            <Input id={field.key} name={field.key} className="mt-2" dir="ltr" inputMode="numeric" required maxLength={24} value={form[field.key]} onChange={(event) => { setForm({ ...form, [field.key]: event.target.value }); setSuccess(""); }} />
            <span className="mt-2 block text-xs leading-6 text-muted-foreground">{field.hint}</span>
          </label>)}
        </fieldset>
        <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={saving || !dirty}><Save className="size-4" />{saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}</Button>{dirty ? <span className="text-xs text-amber-700 dark:text-amber-300">تغییرات هنوز ذخیره نشده‌اند</span> : null}</div>
        <p className="rounded-md bg-muted/40 p-3 text-xs leading-6 text-muted-foreground">حتی اگر نرخ والکس قدیمی شود، تا وقتی آخرین نرخ معتبر وجود دارد از همان استفاده می‌شود. تغییر نرخ جایگزین، قیمت‌های مبتنی بر آن نرخ را بازنویسی نمی‌کند.</p>
      </form>}
    </AdminSection>
    <AdminSection title="دریافت خودکار و پایش" description="زمان‌ها و نتیجهٔ اجرای jobها از بک‌اند خوانده می‌شود؛ خاموشی کامل سرور به پایش بیرونی نیاز دارد.">
      {!status.data ? <AdminState>وضعیت jobها هنوز دریافت نشده است.</AdminState> : !status.data.jobs.length ? <AdminState>هنوز job قیمت‌گذاری ثبت نشده است؛ فعال بودن scheduler بک‌اند را بررسی کنید.</AdminState> : <div className="grid gap-4 lg:grid-cols-2">{status.data.jobs.map((job) => <article key={job.name} className="rounded-lg border border-border bg-background p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold"><Clock3 className="size-4 text-primary" />{job.name === "wallex-usd-toman" ? "دریافت نرخ والکس · هر ۲ دقیقه" : job.name === "exchange-rate-health" ? "پایش سلامت نرخ · هر ۱ دقیقه" : job.name}</h3>
        <dl className="mt-4 space-y-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">آخرین اجرای موفق</dt><dd>{rateTimestamp(job.lastSuccessAt)}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">اجرای بعدی برنامه‌ریزی‌شده</dt><dd>{rateTimestamp(job.nextRunAt)}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">تعداد اجرا / خطا</dt><dd>{job.runCount.toLocaleString("fa-IR")} / {job.failureCount.toLocaleString("fa-IR")}</dd></div></dl>
        {job.lastErrorCode ? <p className="mt-3 text-xs text-amber-700 dark:text-amber-300" dir="ltr">{job.lastErrorCode}</p> : null}
      </article>)}</div>}
    </AdminSection>
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-bold"><Send className="size-4 text-primary" />اعلان اختلال و بازیابی</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">در تنظیمات تلگرام، اعلان کلی و دستهٔ «نرخ ارز» باید فعال و بات و مقصد پیکربندی شده باشند.</p></div><Button asChild variant="outline" size="sm"><Link href="/admin/telegram">تنظیمات اعلان تلگرام</Link></Button></div>
  </div>;
}
