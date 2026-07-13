"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { KeyRound, Loader2, LockKeyhole, LogIn, UserPlus } from "lucide-react";

import { OtpAuthForm } from "@/components/auth/otp-auth-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/types/api";

type AuthMode = "login" | "register";
type LoginMethod = "otp" | "password";

function destination(user: User) {
  return user.role === "ADMIN" ? "/admin" : "/dashboard";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("otp");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    let active = true;

    api.auth.me().then(
      (result) => {
        if (active) router.replace(destination(result.user));
      },
      () => {
        if (active) setIsCheckingAuth(false);
      },
    );

    return () => {
      active = false;
    };
  }, [router]);

  function completeAuthentication(user: User) {
    router.push(destination(user));
    router.refresh();
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordLoading(true);
    setPasswordError("");

    try {
      const result = await api.auth.login({
        identifier: identifier.trim(),
        password,
      });
      completeAuthentication(result.user);
    } catch (error) {
      setPasswordError(
        error instanceof ApiError
          ? "شماره، ایمیل یا رمز عبور نادرست است."
          : "ورود انجام نشد. دوباره تلاش کنید.",
      );
    } finally {
      setPasswordLoading(false);
    }
  }

  if (isCheckingAuth) {
    return (
      <main className="min-h-screen bg-muted/30 px-4 py-8 text-foreground" dir="rtl">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 text-foreground" dir="rtl">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_430px]">
        <section className="hidden lg:block">
          <div className="max-w-lg">
            <Image
              alt="ویکی اکانت"
              className="mb-6 size-16 rounded-lg object-contain"
              height={64}
              priority
              src="/wiki-high-resolution-logo-transparent.png"
              width={64}
            />
            <p className="text-sm font-medium text-primary">ورود امن و سریع</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight">
              بدون نیاز به رمز عبور، با شماره موبایل وارد شوید
            </h1>
            <p className="mt-4 max-w-md text-sm/7 text-muted-foreground">
              کد یک‌بارمصرف فقط برای شماره شما ارسال می‌شود. در صورت تمایل می‌توانید بعداً از تنظیمات حساب، رمز عبور هم بسازید.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">WikiAcc</p>
              <h2 className="mt-1 text-2xl font-bold">
                {mode === "register" ? "ساخت حساب" : "ورود به حساب"}
              </h2>
            </div>
            <Image
              alt="ویکی اکانت"
              className="size-12 rounded-md object-contain lg:hidden"
              height={48}
              src="/wiki-high-resolution-logo-transparent.png"
              width={48}
            />
          </div>

          <div className="mb-5 grid grid-cols-2 rounded-md border border-border bg-muted p-1 text-sm">
            <button
              className={`rounded px-3 py-2 font-medium transition ${
                mode === "login" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
              type="button"
              onClick={() => {
                setMode("login");
                setPasswordError("");
              }}
            >
              <LogIn className="ml-2 inline size-4" />
              ورود
            </button>
            <button
              className={`rounded px-3 py-2 font-medium transition ${
                mode === "register" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
              type="button"
              onClick={() => {
                setMode("register");
                setLoginMethod("otp");
                setPasswordError("");
              }}
            >
              <UserPlus className="ml-2 inline size-4" />
              ثبت‌نام
            </button>
          </div>

          {mode === "register" ? (
            <OtpAuthForm mode="register" onAuthenticated={completeAuthentication} />
          ) : loginMethod === "otp" ? (
            <>
              <OtpAuthForm mode="login" onAuthenticated={completeAuthentication} />
              <Button
                className="mt-3 w-full"
                type="button"
                variant="ghost"
                onClick={() => setLoginMethod("password")}
              >
                <KeyRound className="size-4" />
                ورود با رمز عبور
              </Button>
            </>
          ) : (
            <form className="space-y-4" onSubmit={submitPassword}>
              <label className="block text-sm font-medium" htmlFor="identifier">
                شماره موبایل یا ایمیل
                <Input
                  autoComplete="username"
                  className="mt-2 text-left"
                  dir="ltr"
                  id="identifier"
                  required
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                />
              </label>
              <label className="block text-sm font-medium" htmlFor="password">
                رمز عبور
                <Input
                  autoComplete="current-password"
                  className="mt-2 text-left"
                  dir="ltr"
                  id="password"
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {passwordError ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                  {passwordError}
                </p>
              ) : null}
              <Button className="w-full" disabled={passwordLoading} type="submit">
                {passwordLoading ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
                ورود با رمز عبور
              </Button>
              <Button
                className="w-full"
                type="button"
                variant="ghost"
                onClick={() => setLoginMethod("otp")}
              >
                ورود با کد یک‌بارمصرف
              </Button>
            </form>
          )}

        </section>
      </div>
    </main>
  );
}
