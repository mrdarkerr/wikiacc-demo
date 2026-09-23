"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw, Save, Send, Wifi } from "lucide-react";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { formatDate, formatTime } from "@/components/admin/admin-formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { AdminTelegramSettings, AdminTelegramJobs, UpdateAdminTelegramSettings } from "@/types/api";

const categories = [
  ["orderEventsEnabled", "خرید قطعی، تغییر وضعیت و تحویل سفارش"],
  ["ticketEventsEnabled", "تیکت جدید و پیام مشتری"],
  ["paymentEventsEnabled", "اختلال فنی و پرداخت نیازمند بررسی"],
  ["fulfillmentEventsEnabled", "تحویل ShareBox نیازمند بررسی"],
] as const;
const statuses: Record<string, string> = { PENDING: "در انتظار", PROCESSING: "در حال ارسال", SENT: "ارسال‌شده", FAILED: "ناموفق" };
const eventLabels: Record<string, string> = {
  ORDER_PAID: "خرید قطعی", ORDER_DELIVERED: "تحویل سفارش", ORDER_STATUS_CHANGED: "تغییر وضعیت سفارش",
  TICKET_CREATED: "تیکت جدید", TICKET_CUSTOMER_REPLY: "پیام مشتری",
  PAYMENT_INITIATION_FAILED: "خطای شروع پرداخت", PAYMENT_VERIFICATION_FAILED: "خطای تأیید پرداخت",
  PAYMENT_RECONCILIATION_FAILED: "خطای پیگیری پرداخت", PAYMENT_REVIEW_REQUIRED: "پرداخت نیازمند بررسی",
  SHAREBOX_REVIEW_REQUIRED: "تحویل نیازمند بررسی",
};
const errors: Record<string, string> = {
  TELEGRAM_CONFIG_REQUIRED: "توکن بات و آیدی عددی مقصد را وارد و ذخیره کنید.",
  TELEGRAM_TOKEN_UNREADABLE: "کلید رمزنگاری تغییر کرده است؛ توکن بات را دوباره ذخیره کنید.",
  TELEGRAM_HTTP_400: "مقصد یا درخواست پذیرفته نشد؛ آیدی مقصد و شروع گفت‌وگو با بات را بررسی کنید.",
  TELEGRAM_HTTP_401: "توکن بات پذیرفته نشد.",
  TELEGRAM_HTTP_403: "بات اجازه ارسال ندارد؛ مسدود بودن بات یا دسترسی ارسال در کانال را بررسی کنید.",
  TELEGRAM_HTTP_404: "اندپوینت یا توکن بات معتبر نیست.",
  TELEGRAM_RATE_LIMITED: "محدودیت ارسال تلگرام؛ صف پس از زمان اعلام‌شده دوباره تلاش می‌کند.",
  TELEGRAM_TIMEOUT: "پاسخ تلگرام در مهلت مقرر نرسید؛ دریافت پیام توسط تلگرام قطعی نیست.",
  TELEGRAM_REQUEST_FAILED: "ارتباط با تلگرام کامل نشد؛ اندپوینت و دسترسی شبکه را بررسی کنید.",
  TELEGRAM_INVALID_RESPONSE: "پاسخ اندپوینت با Telegram Bot API سازگار نیست.",
  TELEGRAM_CONFIGURATION_CHANGED: "تنظیمات مقصد تغییر کرده؛ برای ارسال به مقصد فعلی، تلاش مجدد را تأیید کنید.",
  TELEGRAM_JOB_NOT_FAILED: "فقط پیام ناموفق قابل تلاش مجدد است؛ فهرست را تازه‌سازی کنید.",
  VALIDATION_ERROR: "مقادیر فرم معتبر نیستند؛ اندپوینت HTTPS، توکن بات و آیدی عددی را بررسی کنید.",
};
function errorText(error: unknown) {
  const code = error instanceof ApiError ? error.payload?.error?.code : null;
  return (code && errors[code]) || "عملیات انجام نشد؛ دوباره تلاش کنید.";
}
function timestamp(value: string | null) { return value ? `${formatDate(value)}، ${formatTime(value)}` : "—"; }

export default function AdminTelegramPage() {
  const [settings, setSettings] = useState<AdminTelegramSettings | null>(null);
  const [form, setForm] = useState<AdminTelegramSettings | null>(null);
  const [token, setToken] = useState("");
  const [jobs, setJobs] = useState<AdminTelegramJobs | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const load = useCallback(async () => {
    const [result, queue] = await Promise.all([api.admin.telegram.getSettings(), api.admin.telegram.jobs()]);
    setSettings(result.settings); setForm(result.settings); setJobs(queue); setToken("");
  }, []);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      load().catch((reason) => { if (active) setError(errorText(reason)); })
        .finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [load]);

  async function action(name: string, work: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(name); setError(""); setSuccess("");
    try { await work(); } catch (reason) { setError(errorText(reason)); }
    finally { lock.current = false; setBusy(""); }
  }
  const dirty = Boolean(form && settings && (token || JSON.stringify(form) !== JSON.stringify(settings)));
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    await action("save", async () => {
      const body: UpdateAdminTelegramSettings = {
        enabled: form.enabled, baseUrl: form.baseUrl.trim(), destinationChatId: form.destinationChatId || null,
        ...Object.fromEntries(categories.map(([key]) => [key, form[key]])),
        ...(token.trim() ? { botToken: token.trim() } : {}),
      };
      const result = await api.admin.telegram.updateSettings(body);
      setSettings(result.settings); setForm(result.settings); setToken("");
      setSuccess("تنظیمات ذخیره شد.");
    });
  }
  async function retry(id: string) {
    if (!window.confirm("این پیام با توکن، اندپوینت و مقصد فعلی دوباره در صف قرار بگیرد؟ اگر پاسخ ارسال قبلی گم شده باشد، احتمال پیام تکراری وجود دارد.")) return;
    await action(id, async () => {
      await api.admin.telegram.retry(id);
      setSuccess("پیام در صف قرار گرفت؛ هنگام فعال بودن اعلان و دستهٔ مربوط ارسال می‌شود.");
      // A refresh failure must not turn a successful mutation into an apparent failure.
      try { setJobs(await api.admin.telegram.jobs()); }
      catch { setError("پیام در صف قرار گرفت، اما تازه‌سازی فهرست انجام نشد."); }
    });
  }
  if (loading) return <AdminState>در حال دریافت تنظیمات تلگرام...</AdminState>;
  return <div className="space-y-6">
    {error && <AdminState tone="danger">{error}</AdminState>}
    {success && <AdminState tone="success">{success}</AdminState>}
    <AdminSection title="اعلان‌های تلگرام" description="پایش خرید، پشتیبانی و خطاهای مهم؛ بدون دسترسی مدیریتی از داخل تلگرام"
      action={<Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => {
        if (dirty && !window.confirm("تغییرات ذخیره‌نشده کنار گذاشته شود؟")) return;
        void action("refresh", load);
      }}><RefreshCw className={busy === "refresh" ? "animate-spin" : ""} />تازه‌سازی</Button>}>
      {!form ? <AdminState>تنظیمات دریافت نشد. دوباره تلاش کنید.</AdminState> :
        <form onSubmit={save} className="space-y-5">
          <fieldset disabled={Boolean(busy)} className="space-y-5 disabled:opacity-70">
            <label className="flex items-start gap-3 rounded-md border border-border p-4">
              <input type="checkbox" className="mt-1 size-5 accent-primary" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
              <span><span className="block font-bold">اعلان‌های تلگرام فعال باشد</span>
                <span className="mt-1 block text-xs leading-6 text-muted-foreground">پیش‌فرض خاموش است. در حالت خاموش رویداد جدید ذخیره نمی‌شود و پیام‌های قبلی منتظر می‌مانند. ارسال در حال انجام ممکن است تکمیل شود.</span></span>
            </label>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="block text-sm">اندپوینت Telegram Bot API
                <Input className="mt-2" dir="ltr" type="url" required maxLength={500} value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} />
                <span className="mt-2 block text-xs leading-6 text-muted-foreground">آدرس پایه HTTPS، با مسیر دلخواه؛ بدون توکن یا sendMessage. مثلاً https://tg.example.com/telegram</span>
              </label>
              <label className="block text-sm">آیدی عددی ادمین یا کانال مقصد
                <Input className="mt-2" dir="ltr" type="text" inputMode="text" placeholder="123456789 یا -1001234567890" value={form.destinationChatId ?? ""} onChange={(e) => setForm({ ...form, destinationChatId: e.target.value })} />
                <span className="mt-2 block text-xs leading-6 text-muted-foreground">فقط مقصد اعلان است، نه مجوز مدیریت سایت. ادمین ابتدا بات را Start کند؛ در کانال، بات مجوز ارسال داشته باشد.</span>
              </label>
            </div>
            <label className="block text-sm">توکن بات {settings?.hasBotToken ? `(ثبت‌شده ••••${settings.botTokenHint ?? ""})` : ""}
              <Input className="mt-2" dir="ltr" type="password" autoComplete="new-password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={settings?.hasBotToken ? "برای حفظ توکن فعلی خالی بگذارید" : "توکن دریافت‌شده از BotFather"} />
            </label>
            <p className="rounded-md bg-muted/40 p-3 text-xs leading-6">فقط از اندپوینت مورداعتماد استفاده کنید؛ صاحب پروکسی به توکن و پیام‌ها دسترسی دارد. با تغییر اتصال، پیام‌های قبلی خودکار به مقصد جدید فرستاده نمی‌شوند.</p>
            <div className="grid gap-3 sm:grid-cols-2">{categories.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-primary" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />{label}
            </label>)}</div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit"><Save />{busy === "save" ? "در حال ذخیره..." : "ذخیره تنظیمات"}</Button>
              {(["connection", "message"] as const).map((mode) => <Button key={mode} type="button" variant="outline" disabled={dirty || !settings?.hasBotToken || !settings.destinationChatId} onClick={() => void action(mode, async () => {
                await api.admin.telegram.test(mode);
                setSuccess(mode === "message" ? "تلگرام دریافت پیام آزمایشی را تأیید کرد." : "اتصال و توکن بات تأیید شد؛ برای بررسی مقصد پیام آزمایشی بفرستید.");
              })}>{mode === "connection" ? <Wifi /> : <Send />}{busy === mode ? "در حال بررسی..." : mode === "connection" ? "بررسی اتصال" : "ارسال پیام آزمایشی"}</Button>)}
            </div>
            <p className="text-xs leading-6 text-muted-foreground">آزمایش با تنظیمات ذخیره‌شده انجام می‌شود و حتی وقتی اعلان خودکار خاموش است در دسترس است. ابتدا تغییرات فرم را ذخیره کنید.</p>
          </fieldset>
        </form>}
    </AdminSection>
    <AdminSection title="وضعیت ارسال" description="۵۰ پیام اخیر؛ جزئیات مشتری و متن پیام در این فهرست نمایش داده نمی‌شود.">
      {!jobs ? <AdminState>اطلاعات صف در دسترس نیست.</AdminState> : <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Object.entries(statuses).map(([key, label]) => <div key={key} className="rounded-md border border-border p-3 text-sm">{label}<strong className="mt-2 block text-lg">{(jobs.counts[key] ?? 0).toLocaleString("fa-IR")}</strong></div>)}</div>
        <p className="text-xs">آخرین ارسال موفق: {timestamp(jobs.lastSentAt)}</p>
        {jobs.lastError && <p className="text-xs text-amber-700 dark:text-amber-300">آخرین خطای ثبت‌شده ({timestamp(jobs.lastError.updatedAt)}): {errors[jobs.lastError.lastErrorCode] ?? jobs.lastError.lastErrorCode}</p>}
        {!jobs.jobs.length && <AdminState>هنوز پیامی در صف ثبت نشده است.</AdminState>}
        <div className="space-y-3">{jobs.jobs.map((job) => <div key={job.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3 text-sm">
          <div className="min-w-0 space-y-2">
            <p className="font-bold">{eventLabels[job.eventType] ?? job.eventType} · {statuses[job.status] ?? job.status}</p>
            <p className="text-xs text-muted-foreground">{timestamp(job.createdAt)} · تلاش‌ها: {job.attempts.toLocaleString("fa-IR")}</p>
            {job.lastErrorCode && <p className="max-w-xl text-xs leading-6 text-amber-700 dark:text-amber-300">{errors[job.lastErrorCode] ?? job.lastErrorCode}</p>}
            {job.referenceId && ["ORDER", "TICKET"].includes(job.referenceType ?? "") && <Link className="text-xs text-primary underline" href={`/admin/${job.referenceType === "ORDER" ? "orders" : "tickets"}/${encodeURIComponent(job.referenceId)}`}>مشاهده در پنل</Link>}
          </div>
          {job.status === "FAILED" && <Button type="button" size="sm" variant="outline" disabled={Boolean(busy) || dirty} onClick={() => void retry(job.id)}>{busy === job.id ? "در حال ثبت..." : "تلاش مجدد با تنظیمات فعلی"}</Button>}
        </div>)}</div>
      </div>}
    </AdminSection>
  </div>;
}
