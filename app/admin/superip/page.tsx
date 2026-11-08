"use client";
import { useEffect, useState, type FormEvent } from "react";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
export default function SuperipSettingsPage() {
  const [settings, setSettings] = useState<{
    enabled: boolean;
    configured: boolean;
    endpoint: string;
  } | null>(null);
  const [enabled, setEnabled] = useState(false),
    [endpoint, setEndpoint] = useState(""),
    [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    api.admin.superip
      .getSettings()
      .then(({ settings: next }) => {
        if (active) {
          setSettings(next);
          setEnabled(next.enabled);
          setEndpoint(next.endpoint);
        }
      })
      .catch(() => {
        if (active)
          setMessage("دریافت تنظیمات انجام نشد؛ صفحه را دوباره باز کنید.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await api.admin.superip.updateSettings({
        enabled,
        endpoint,
        ...(secret ? { secret } : {}),
      });
      const { settings: next } = await api.admin.superip.getSettings();
      if (
        next.enabled !== enabled ||
        next.endpoint !== endpoint ||
        next.configured !== Boolean(secret || settings?.configured)
      )
        throw new Error();
      setSettings(next);
      setSecret("");
      setMessage("تنظیمات ذخیره و بازخوانی شد.");
    } catch (error) {
      setMessage(
        error instanceof ApiError &&
          error.payload?.error?.code === "SUPERIP_PENDING_FULFILLMENTS"
          ? "ابتدا سفارش‌های در انتظار را تعیین تکلیف کنید؛ آدرس مقصد تغییر نکرد."
          : "ذخیره تأیید نشد؛ آدرس و سکرت را بررسی کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminSection
      title="شارژ کیف پول سوپر ایپی"
      description="اتصال وب‌هوک شارژ نمایندگان پس از تأیید پرداخت"
    >
      <form onSubmit={save} className="space-y-5 max-w-2xl">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            disabled={!settings || busy}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          فعال بودن فروش و شارژ خودکار
        </label>
        <label className="block text-sm">
          آدرس وب‌هوک
          <Input
            className="mt-2"
            dir="ltr"
            type="url"
            required
            value={endpoint}
            disabled={!settings || busy}
            onChange={(e) => setEndpoint(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          سکرت مشترک
          <Input
            className="mt-2"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            minLength={32}
            maxLength={256}
            pattern="[A-Za-z0-9_-]+"
            value={secret}
            disabled={!settings || busy}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={
              settings?.configured
                ? "ثبت شده؛ برای حفظ مقدار فعلی خالی بگذارید"
                : "حداقل ۳۲ کاراکتر"
            }
          />
        </label>
        <p className="text-sm text-muted-foreground">
          سکرت باید با بخش «وب‌هوک کیف پول» در تنظیمات مدیریت سوپر ایپی یکسان
          باشد. مبلغ پرداخت و شارژ به تومان و یکسان است. تغییر سکرت، شناسه
          سفارش‌های قبلی را عوض نمی‌کند.
        </p>
        <Button
          disabled={
            !settings || busy || (enabled && !settings.configured && !secret)
          }
        >
          {busy ? "در حال ذخیره…" : "ذخیره تنظیمات"}
        </Button>
        {message && <AdminState>{message}</AdminState>}
      </form>
    </AdminSection>
  );
}
