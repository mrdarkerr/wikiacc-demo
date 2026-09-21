"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, KeyRound, RefreshCw, Save } from "lucide-react";

import { formatDate, formatTime } from "@/components/admin/admin-formatters";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { AdminShareBoxSettings } from "@/types/api";

function shareBoxErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;

  const code = error.payload?.error?.code;
  const messages: Record<string, string> = {
    SHAREBOX_API_KEY_INVALID: "کلید واردشده توسط شیر‌باکس پذیرفته نشد.",
    SHAREBOX_API_KEY_REQUIRED: "برای فعال‌سازی اتصال، کلید API شیر‌باکس را وارد کنید.",
    SHAREBOX_CREDENTIAL_REJECTED: "کلید ثبت‌شده توسط شیر‌باکس پذیرفته نشد.",
    SHAREBOX_NOT_CONFIGURED: "تنظیمات اتصال شیر‌باکس کامل نیست.",
    SHAREBOX_PENDING_FULFILLMENTS: "سفارش‌های شیر‌باکس هنوز تعیین تکلیف نشده‌اند. ابتدا تحویل یا لغو/بازپرداخت مجاز آن‌ها را تکمیل کنید؛ کلید فعلی تغییر نکرده است.",
    SHAREBOX_REQUEST_FAILED: "ارتباط با شیر‌باکس کامل نشد. دوباره تلاش کنید.",
    SHAREBOX_UPSTREAM_ERROR: "شیر‌باکس موقتاً پاسخ‌گو نیست. دوباره تلاش کنید.",
    SHAREBOX_UNAVAILABLE: "سرویس شیر‌باکس موقتاً در دسترس نیست.",
  };

  return (code && messages[code]) || error.message || fallback;
}

function apiKeysPanelUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    return `${url.origin}/api-keys`;
  } catch {
    return null;
  }
}

export default function AdminShareBoxPage() {
  const [settings, setSettings] = useState<AdminShareBoxSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");

  const applySettings = useCallback((next: AdminShareBoxSettings) => {
    setSettings(next);
    setEnabled(next.enabled);
  }, []);

  const loadSettings = useCallback(
    async (manual = false) => {
      if (manual) setRefreshing(true);
      try {
        const result = await api.admin.sharebox.getSettings();
        applySettings(result.settings);
        setLoadError("");
      } catch (error) {
        setLoadError(
          shareBoxErrorMessage(error, "دریافت تنظیمات شیر‌باکس انجام نشد."),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applySettings],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSettings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSettings]);

  const keysPanelUrl = useMemo(
    () => (settings ? apiKeysPanelUrl(settings.baseUrl) : null),
    [settings],
  );

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;

    const trimmedApiKey = apiKey.trim();
    const body: { enabled?: boolean; apiKey?: string } = {};
    if (enabled !== settings.enabled) body.enabled = enabled;
    if (trimmedApiKey) body.apiKey = trimmedApiKey;

    if (!Object.keys(body).length) {
      setSuccess("تغییری برای ذخیره وجود ندارد.");
      setSaveError("");
      return;
    }

    setSaving(true);
    setSaveError("");
    setSuccess("");
    try {
      const result = await api.admin.sharebox.updateSettings(body);
      applySettings(result.settings);
      setApiKey("");
      setSuccess("تنظیمات شیر‌باکس ذخیره شد.");
    } catch (error) {
      setSaveError(
        shareBoxErrorMessage(error, "ذخیره تنظیمات شیر‌باکس انجام نشد."),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AdminState>در حال دریافت تنظیمات شیر‌باکس...</AdminState>;
  }

  return (
    <div className="space-y-6">
      {loadError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
          <AdminState tone="danger">{loadError}</AdminState>
          <Button
            disabled={refreshing}
            size="sm"
            type="button"
            variant="outline"
            onClick={() => void loadSettings(true)}
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
            تلاش دوباره
          </Button>
        </div>
      ) : null}
      {saveError ? <AdminState tone="danger">{saveError}</AdminState> : null}
      {success ? <AdminState tone="success">{success}</AdminState> : null}

      <AdminSection
        action={
          <Button
            disabled={refreshing}
            size="sm"
            type="button"
            variant="outline"
            onClick={() => void loadSettings(true)}
          >
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
            تازه‌سازی
          </Button>
        }
        description="اتصال واحد ویکی‌اکانت به سرویس صدور لایسنس شیر‌باکس"
        title="اتصال شیر‌باکس"
      >
        {!settings ? (
          <AdminState tone="danger">تنظیمات شیر‌باکس در دسترس نیست.</AdminState>
        ) : (
          <form className="space-y-5" onSubmit={saveSettings}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-md border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="rounded-md bg-primary/10 p-2 text-primary">
                      <KeyRound className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold">کلید نام‌دار ویکی‌اکانت</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {settings.hasApiKey
                          ? `کلید ثبت شده ••••${settings.apiKeyHint ?? ""}`
                          : "هنوز کلیدی ثبت نشده است."}
                      </p>
                    </div>
                  </div>
                  <span
                    className={
                      settings.enabled
                        ? "text-xs font-medium text-emerald-600 dark:text-emerald-300"
                        : "text-xs font-medium text-amber-600 dark:text-amber-300"
                    }
                  >
                    {settings.enabled ? "فعال" : "غیرفعال"}
                  </span>
                </div>
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
                <p className="text-xs text-muted-foreground">نشانی سرویس</p>
                <p className="mt-2 break-all font-mono text-xs" dir="ltr">
                  {settings.baseUrl}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  آخرین تغییر: {formatDate(settings.updatedAt)}، {formatTime(settings.updatedAt)}
                </p>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-4">
              <input
                checked={enabled}
                className="mt-0.5 size-5 accent-primary"
                type="checkbox"
                onChange={(event) => setEnabled(event.target.checked)}
              />
              <span>
                <span className="block text-sm font-bold">صدور خودکار فعال باشد</span>
                <span className="mt-1 block text-xs leading-6 text-muted-foreground">
                  پس از پرداخت محصولات شیر‌باکس، صدور لایسنس به‌صورت خودکار آغاز می‌شود.
                </span>
              </span>
            </label>

            <label className="block text-sm font-medium">
              {settings.hasApiKey ? "جایگزینی کلید API" : "کلید API"}
              <Input
                autoComplete="new-password"
                className="mt-2"
                dir="ltr"
                placeholder={
                  settings.hasApiKey
                    ? "برای حفظ کلید فعلی خالی بگذارید"
                    : "کلید نام‌دار Wikiacc"
                }
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
              <span className="mt-2 block text-xs font-normal leading-6 text-muted-foreground">
                مقدار کامل کلید فقط هنگام ذخیره ارسال می‌شود و بعداً دوباره نمایش داده نخواهد شد.
              </span>
            </label>

            {apiKey.trim() && settings.hasApiKey ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                تا زمانی که سفارش شیر‌باکسِ تعیین‌تکلیف‌نشده وجود دارد، تعویض کلید مجاز نیست. ابتدا سفارش‌های قبلی را تکمیل کنید و پیش از آن کلید فعلی را در شیر‌باکس لغو نکنید.
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button disabled={saving || refreshing} type="submit">
                <Save className="size-4" />
                {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
              </Button>
              {keysPanelUrl ? (
                <Button asChild type="button" variant="outline">
                  <a href={keysPanelUrl} rel="noreferrer" target="_blank">
                    <ExternalLink className="size-4" />
                    پنل کلیدهای API شیر‌باکس
                  </a>
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </AdminSection>
    </div>
  );
}
