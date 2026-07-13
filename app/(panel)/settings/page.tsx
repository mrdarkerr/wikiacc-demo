"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, Mail, Phone, Save, ShieldCheck, UserRound } from "lucide-react";

import { PanelSection } from "@/components/panel/panel-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/types/api";

function message(error: unknown, fallback: string) {
  if (!(error instanceof ApiError)) return fallback;
  const code = error.payload?.error?.code;
  if (code === "EMAIL_ALREADY_EXISTS") return "این ایمیل قبلاً ثبت شده است.";
  if (code === "CURRENT_PASSWORD_REQUIRED") return "رمز عبور فعلی را وارد کنید.";
  if (code === "CURRENT_PASSWORD_INVALID") return "رمز عبور فعلی نادرست است.";
  return error.message;
}

export default function AccountSettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    let active = true;
    api.auth.me().then(
      (result) => {
        if (!active) return;
        setUser(result.user);
        setName(result.user.name);
        setEmail(result.user.email ?? "");
      },
      () => {
        if (active) setProfileError("دریافت اطلاعات حساب انجام نشد.");
      },
    ).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileNotice("");
    try {
      const result = await api.auth.updateProfile({
        email: email.trim(),
        name: name.trim(),
      });
      setUser(result.user);
      setEmail(result.user.email ?? "");
      setName(result.user.name);
      setProfileNotice("اطلاعات حساب ذخیره شد.");
    } catch (error) {
      setProfileError(message(error, "ذخیره اطلاعات حساب انجام نشد."));
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordNotice("");
    if (password !== confirmPassword) {
      setPasswordError("تکرار رمز عبور با رمز جدید یکسان نیست.");
      return;
    }

    setSavingPassword(true);
    try {
      const result = await api.auth.setPassword({
        ...(user?.hasPassword ? { currentPassword } : {}),
        password,
      });
      setUser(result.user);
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      setPasswordNotice(
        user?.hasPassword ? "رمز عبور تغییر کرد." : "رمز عبور برای حساب شما فعال شد.",
      );
    } catch (error) {
      setPasswordError(message(error, "ثبت رمز عبور انجام نشد."));
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        در حال دریافت تنظیمات حساب...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PanelSection
        description="شماره موبایل شناسه اصلی حساب شماست؛ ایمیل اختیاری است."
        title="اطلاعات حساب"
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={saveProfile}>
          <label className="block text-sm font-medium">
            نام و نام خانوادگی
            <div className="relative mt-2">
              <UserRound className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pr-9"
                maxLength={120}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </label>
          <label className="block text-sm font-medium">
            شماره موبایل
            <div className="relative mt-2">
              <Phone className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pr-9 text-left" dir="ltr" disabled value={user?.phone ?? "ثبت نشده"} />
            </div>
          </label>
          <label className="block text-sm font-medium md:col-span-2">
            ایمیل <span className="font-normal text-muted-foreground">(اختیاری)</span>
            <div className="relative mt-2">
              <Mail className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pr-9 text-left"
                dir="ltr"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </label>
          {profileError ? <p className="text-sm text-rose-600 md:col-span-2">{profileError}</p> : null}
          {profileNotice ? <p className="text-sm text-emerald-600 md:col-span-2">{profileNotice}</p> : null}
          <div className="md:col-span-2">
            <Button disabled={savingProfile} type="submit">
              {savingProfile ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              ذخیره اطلاعات
            </Button>
          </div>
        </form>
      </PanelSection>

      <PanelSection
        description="ورود با کد یک‌بارمصرف همیشه روش پیش‌فرض می‌ماند؛ رمز عبور فقط یک روش جایگزین است."
        title={user?.hasPassword ? "تغییر رمز عبور" : "فعال‌سازی رمز عبور"}
      >
        <div className="mb-5 flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-4 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="leading-6">
            حساب شما با شماره موبایل محافظت می‌شود. ساخت رمز عبور اختیاری است و ورود پیامکی را غیرفعال نمی‌کند.
          </p>
        </div>
        <form className="grid max-w-xl gap-4" onSubmit={savePassword}>
          {user?.hasPassword ? (
            <label className="block text-sm font-medium">
              رمز عبور فعلی
              <Input
                autoComplete="current-password"
                className="mt-2 text-left"
                dir="ltr"
                required
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
          ) : null}
          <label className="block text-sm font-medium">
            رمز عبور جدید
            <Input
              autoComplete="new-password"
              className="mt-2 text-left"
              dir="ltr"
              minLength={8}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            تکرار رمز عبور جدید
            <Input
              autoComplete="new-password"
              className="mt-2 text-left"
              dir="ltr"
              minLength={8}
              required
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          {passwordError ? <p className="text-sm text-rose-600">{passwordError}</p> : null}
          {passwordNotice ? <p className="text-sm text-emerald-600">{passwordNotice}</p> : null}
          <div>
            <Button disabled={savingPassword} type="submit">
              {savingPassword ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {user?.hasPassword ? "تغییر رمز عبور" : "فعال‌سازی رمز عبور"}
            </Button>
          </div>
        </form>
      </PanelSection>
    </div>
  );
}
