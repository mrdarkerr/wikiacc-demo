"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { KeyRound, MessageSquareText, Plus, Save, Trash2 } from "lucide-react";

import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type {
  AdminSmsSettings,
  UpdateAdminSmsSettingsRequest,
} from "@/types/api";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function AdminSmsSettingsPage() {
  const [settings, setSettings] = useState<AdminSmsSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [defaultSenderId, setDefaultSenderId] = useState("");
  const [senderLabel, setSenderLabel] = useState("");
  const [senderLine, setSenderLine] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingSender, setAddingSender] = useState(false);
  const [removingSenderId, setRemovingSenderId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      const result = await api.admin.sms.getSettings();
      setSettings(result.settings);
      setDefaultSenderId(result.settings.defaultSenderId ?? "");
      setError("");
    } catch (loadError) {
      setError(
        errorMessage(loadError, "دریافت تنظیمات پیامک با خطا مواجه شد."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    api.admin.sms
      .getSettings()
      .then((result) => {
        if (!active) return;
        setSettings(result.settings);
        setDefaultSenderId(result.settings.defaultSenderId ?? "");
        setError("");
      })
      .catch((loadError) => {
        if (!active) return;
        setError(
          errorMessage(loadError, "دریافت تنظیمات پیامک با خطا مواجه شد."),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;

    const body: UpdateAdminSmsSettingsRequest = {};
    const trimmedApiKey = apiKey.trim();
    if (trimmedApiKey) body.apiKey = trimmedApiKey;
    if (defaultSenderId && defaultSenderId !== settings.defaultSenderId) {
      body.defaultSenderId = defaultSenderId;
    }

    if (!body.apiKey && !body.defaultSenderId) {
      setSuccess("تغییری برای ذخیره وجود ندارد.");
      setError("");
      return;
    }

    setSaving(true);
    try {
      const result = await api.admin.sms.updateSettings(body);
      setSettings(result.settings);
      setDefaultSenderId(result.settings.defaultSenderId ?? "");
      setApiKey("");
      setError("");
      setSuccess("تنظیمات پیامک ذخیره شد.");
    } catch (saveError) {
      setSuccess("");
      setError(
        errorMessage(saveError, "ذخیره تنظیمات پیامک با خطا مواجه شد."),
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeApiKey() {
    if (!settings?.hasApiKey) return;
    if (
      !window.confirm(
        "کلید API پیامک حذف شود؟ ارسال پیامک تا ثبت کلید جدید متوقف خواهد شد.",
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const result = await api.admin.sms.updateSettings({ removeApiKey: true });
      setSettings(result.settings);
      setApiKey("");
      setError("");
      setSuccess("کلید API حذف شد.");
    } catch (removeError) {
      setSuccess("");
      setError(errorMessage(removeError, "حذف کلید API انجام نشد."));
    } finally {
      setSaving(false);
    }
  }

  async function addSender(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddingSender(true);

    try {
      await api.admin.sms.createSender({
        label: senderLabel.trim(),
        lineNumber: senderLine.trim(),
      });
      setSenderLabel("");
      setSenderLine("");
      setError("");
      setSuccess("خط فرستنده جدید اضافه شد.");
      await loadSettings();
    } catch (addError) {
      setSuccess("");
      setError(errorMessage(addError, "افزودن خط فرستنده انجام نشد."));
    } finally {
      setAddingSender(false);
    }
  }

  async function removeSender(id: string) {
    if (!window.confirm("این خط فرستنده حذف شود؟")) return;
    setRemovingSenderId(id);

    try {
      await api.admin.sms.removeSender(id);
      setError("");
      setSuccess("خط فرستنده حذف شد.");
      await loadSettings();
    } catch (removeError) {
      setSuccess("");
      setError(errorMessage(removeError, "حذف خط فرستنده انجام نشد."));
    } finally {
      setRemovingSenderId("");
    }
  }

  if (loading) {
    return <AdminState>در حال دریافت تنظیمات پیامک...</AdminState>;
  }

  return (
    <div className="space-y-6">
      {error ? <AdminState tone="danger">{error}</AdminState> : null}
      {success ? <AdminState tone="success">{success}</AdminState> : null}

      <AdminSection
        description="کلید دسترسی IranPayamak و خط پیش‌فرض ارسال پیامک‌های پترنی را مدیریت کنید."
        title="تنظیمات سرویس پیامک"
      >
        {!settings ? (
          <AdminState tone="danger">تنظیمات پیامک در دسترس نیست.</AdminState>
        ) : (
          <form className="grid gap-5 lg:grid-cols-2" onSubmit={saveSettings}>
            <div className="rounded-md border border-border bg-muted/30 p-4 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-primary/10 p-2 text-primary">
                    <MessageSquareText className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">IranPayamak</p>
                    <p className="text-xs text-muted-foreground">
                      فقط ارسال پیامک بر اساس پترن فعال است.
                    </p>
                  </div>
                </div>
                <span
                  className={
                    settings.hasApiKey
                      ? "text-sm text-emerald-600 dark:text-emerald-300"
                      : "text-sm text-amber-600 dark:text-amber-300"
                  }
                >
                  {settings.hasApiKey
                    ? `کلید ثبت شده ••••${settings.apiKeyHint ?? ""}`
                    : "کلید API ثبت نشده است"}
                </span>
              </div>
            </div>

            <label className="block text-sm font-medium">
              کلید API جدید
              <Input
                autoComplete="new-password"
                className="mt-2"
                dir="ltr"
                placeholder={
                  settings.hasApiKey
                    ? "برای حفظ کلید فعلی خالی بگذارید"
                    : "Api-Key"
                }
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
              <span className="mt-2 block text-xs font-normal text-muted-foreground">
                مقدار کامل کلید بعد از ذخیره از سرور برگردانده نمی‌شود.
              </span>
            </label>

            <label className="block text-sm font-medium">
              خط پیش‌فرض ارسال
              <Select
                className="mt-2"
                options={settings.senders.map((sender) => ({
                  label: `${sender.label} — ${sender.lineNumber}`,
                  value: sender.id,
                }))}
                placeholder="خط فرستنده را انتخاب کنید"
                value={defaultSenderId}
                onValueChange={setDefaultSenderId}
              />
              <span className="mt-2 block text-xs font-normal text-muted-foreground">
                سرویس ارسال در صورت مشخص نشدن فرستنده، از این خط استفاده می‌کند.
              </span>
            </label>

            <div className="flex flex-wrap gap-2 lg:col-span-2">
              <Button disabled={saving} type="submit">
                <Save className="size-4" />
                {saving ? "در حال ذخیره..." : "ذخیره تنظیمات"}
              </Button>
              {settings.hasApiKey ? (
                <Button
                  disabled={saving}
                  type="button"
                  variant="outline"
                  onClick={removeApiKey}
                >
                  <KeyRound className="size-4" />
                  حذف کلید API
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </AdminSection>

      <AdminSection
        description="شماره یا شناسه‌ی خطی را که در سامانه پیامک در دسترس است اضافه کنید."
        title="خطوط فرستنده"
      >
        <form
          className="mb-5 grid gap-4 rounded-md border border-dashed border-border p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
          onSubmit={addSender}
        >
          <label className="block text-sm font-medium">
            عنوان خط
            <Input
              className="mt-2"
              placeholder="مثلاً خط خدماتی"
              required
              value={senderLabel}
              onChange={(event) => setSenderLabel(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            شماره یا شناسه خط
            <Input
              className="mt-2"
              dir="ltr"
              placeholder="5000... یا PRO"
              required
              value={senderLine}
              onChange={(event) => setSenderLine(event.target.value)}
            />
          </label>
          <Button disabled={addingSender} type="submit">
            <Plus className="size-4" />
            {addingSender ? "در حال افزودن..." : "افزودن خط"}
          </Button>
        </form>

        <div className="grid gap-3">
          {settings?.senders.map((sender) => {
            const isDefault = sender.id === settings.defaultSenderId;

            return (
              <div
                className="flex flex-col gap-3 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                key={sender.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{sender.label}</p>
                    {isDefault ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        پیش‌فرض
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-sm text-muted-foreground" dir="ltr">
                    {sender.lineNumber}
                  </p>
                </div>
                <Button
                  disabled={isDefault || removingSenderId === sender.id}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => void removeSender(sender.id)}
                >
                  <Trash2 className="size-4" />
                  حذف
                </Button>
              </div>
            );
          })}
        </div>
      </AdminSection>
    </div>
  );
}
