"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { OtpChallenge, OtpRequest, User } from "@/types/api";

type OtpAuthMode = "login" | "register" | "checkout";

type OtpAuthFormProps = {
  mode: OtpAuthMode;
  onAuthenticated: (user: User) => void | Promise<void>;
};

function errorDetails(error: ApiError) {
  const details = error.payload?.error?.details;
  return details && typeof details === "object"
    ? (details as Record<string, unknown>)
    : {};
}

function otpErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "ارتباط با سرور برقرار نشد. دوباره تلاش کنید.";
  }

  const code = error.payload?.error?.code;
  const details = errorDetails(error);

  if (code === "AUTH_ACCOUNT_NOT_FOUND") {
    return "حسابی با این شماره پیدا نشد. از بخش ساخت حساب وارد شوید.";
  }
  if (code === "PHONE_ALREADY_EXISTS") {
    return "این شماره قبلاً ثبت شده است. از بخش ورود استفاده کنید.";
  }
  if (code === "EMAIL_ALREADY_EXISTS") {
    return "این ایمیل قبلاً برای حساب دیگری ثبت شده است.";
  }
  if (code === "OTP_ALREADY_SENT") {
    return "کد قبلی هنوز معتبر است؛ تا پایان شمارش معکوس صبر کنید.";
  }
  if (code === "OTP_RATE_LIMITED") {
    return "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.";
  }
  if (code === "OTP_INVALID") {
    const attempts = Number(details.attemptsRemaining);
    return Number.isFinite(attempts)
      ? `کد نادرست است؛ ${new Intl.NumberFormat("fa-IR").format(attempts)} تلاش باقی مانده.`
      : "کد واردشده نادرست است.";
  }
  if (code === "OTP_ATTEMPTS_EXCEEDED") {
    return "تعداد تلاش ناموفق بیش از حد مجاز شد. یک کد جدید دریافت کنید.";
  }
  if (code === "OTP_EXPIRED") {
    return "اعتبار کد تمام شده است. کد جدید دریافت کنید.";
  }
  if (
    code === "SMS_API_KEY_NOT_CONFIGURED" ||
    code === "SMS_AUTH_PATTERN_NOT_CONFIGURED" ||
    code === "SMS_SENDER_NOT_CONFIGURED"
  ) {
    return "سرویس پیامک هنوز کامل تنظیم نشده است. با پشتیبانی تماس بگیرید.";
  }

  return error.message;
}

export function OtpAuthForm({ mode, onAuthenticated }: OtpAuthFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const codeInputRef = useRef<HTMLInputElement>(null);
  const needsName = mode !== "login";

  useEffect(() => {
    if (!challenge) return;
    const expiresAt = challenge.expiresAt;

    function updateCountdown() {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsRemaining(remaining);
    }

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [challenge]);

  async function requestCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSending(true);
    setError("");

    const trimmedEmail = email.trim();
    const request: OtpRequest =
      mode === "login"
        ? { mode, phone: phone.trim() }
        : mode === "register"
          ? {
              ...(trimmedEmail ? { email: trimmedEmail } : {}),
              mode,
              name: name.trim(),
              phone: phone.trim(),
            }
          : { mode, name: name.trim(), phone: phone.trim() };

    try {
      const result = await api.auth.requestOtp(request);
      setChallenge(result.challenge);
      setSecondsRemaining(result.challenge.retryAfterSeconds);
      setCode("");
      window.setTimeout(() => codeInputRef.current?.focus(), 0);
    } catch (requestError) {
      setError(otpErrorMessage(requestError));
    } finally {
      setSending(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;

    setVerifying(true);
    setError("");
    try {
      const result = await api.auth.verifyOtp({
        challengeId: challenge.challengeId,
        code: code.trim(),
      });
      await onAuthenticated(result.user);
    } catch (verifyError) {
      const errorCode =
        verifyError instanceof ApiError
          ? verifyError.payload?.error?.code
          : undefined;
      if (errorCode === "OTP_ATTEMPTS_EXCEEDED" || errorCode === "OTP_EXPIRED") {
        setSecondsRemaining(0);
      }
      setError(otpErrorMessage(verifyError));
    } finally {
      setVerifying(false);
    }
  }

  if (challenge) {
    return (
      <form className="space-y-4" onSubmit={verifyCode}>
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium">کد تأیید ارسال شد</p>
              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                {challenge.maskedPhone}
              </p>
            </div>
          </div>
        </div>

        <label className="block text-sm font-medium" htmlFor={`otp-code-${mode}`}>
          کد ۶ رقمی
          <Input
            ref={codeInputRef}
            autoComplete="one-time-code"
            className="mt-2 text-center text-lg tracking-[0.35em]"
            dir="ltr"
            id={`otp-code-${mode}`}
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9۰-۹٠-٩]{6}"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {secondsRemaining > 0
              ? `${new Intl.NumberFormat("fa-IR").format(secondsRemaining)} ثانیه تا پایان اعتبار`
              : "اعتبار کد تمام شده است"}
          </span>
          <button
            className="font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50"
            disabled={sending || secondsRemaining > 0}
            type="button"
            onClick={() => void requestCode()}
          >
            ارسال کد جدید
          </button>
        </div>

        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </p>
        ) : null}

        <Button
          className="w-full"
          disabled={verifying || secondsRemaining === 0 || code.length !== 6}
          type="submit"
        >
          {verifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          تأیید و ادامه
        </Button>
        <Button
          className="w-full"
          type="button"
          variant="ghost"
          onClick={() => {
            setChallenge(null);
            setCode("");
            setError("");
          }}
        >
          <ArrowRight className="size-4" />
          ویرایش اطلاعات
        </Button>
      </form>
    );
  }

  return (
    <form className="space-y-4" onSubmit={requestCode}>
      {needsName ? (
        <label className="block text-sm font-medium" htmlFor={`otp-name-${mode}`}>
          نام و نام خانوادگی
          <div className="relative mt-2">
            <UserRound className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pr-9"
              id={`otp-name-${mode}`}
              maxLength={120}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
        </label>
      ) : null}

      <label className="block text-sm font-medium" htmlFor={`otp-phone-${mode}`}>
        شماره موبایل
        <div className="relative mt-2">
          <Phone className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoComplete="tel"
            className="pr-9 text-left"
            dir="ltr"
            id={`otp-phone-${mode}`}
            inputMode="tel"
            placeholder="09120000000"
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
      </label>

      {mode === "register" ? (
        <label className="block text-sm font-medium" htmlFor="otp-email-register">
          ایمیل <span className="font-normal text-muted-foreground">(اختیاری)</span>
          <div className="relative mt-2">
            <Mail className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoComplete="email"
              className="pr-9 text-left"
              dir="ltr"
              id="otp-email-register"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </label>
      ) : null}

      {error ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      <Button className="w-full" disabled={sending} type="submit">
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Phone className="size-4" />}
        ارسال کد یک‌بارمصرف
      </Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        کد فقط ۶۰ ثانیه معتبر است و پس از چند تلاش ناموفق غیرفعال می‌شود.
      </p>
    </form>
  );
}
