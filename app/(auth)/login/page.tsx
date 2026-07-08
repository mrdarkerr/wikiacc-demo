"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, LogIn, Mail, Phone, User, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";

type SubmitState = "idle" | "loading" | "success" | "error";
type AuthMode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const isRegisterMode = mode === "register";

  useEffect(() => {
    let active = true;

    async function redirectIfAuthenticated() {
      try {
        const result = await api.auth.me();
        if (!active) return;
        const dashboard = result.user.role === "ADMIN" ? "/admin" : "/dashboard";
        router.replace(dashboard);
      } catch {
        if (active) {
          setIsCheckingAuth(false);
        }
      }
    }

    redirectIfAuthenticated();

    return () => {
      active = false;
    };
  }, [router]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setState("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");

    try {
      const result = isRegisterMode
        ? await api.auth.register({
            email: email.trim(),
            name: name.trim(),
            password,
            phone: phone.trim() || undefined,
          })
        : await api.auth.login({ email: email.trim(), password });
      setState("success");
      router.push(result.user.role === "ADMIN" ? "/admin" : "/dashboard");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof ApiError
          ? error.message
          : isRegisterMode
            ? "ثبت‌نام انجام نشد. وضعیت بک اند را بررسی کنید."
            : "ورود انجام نشد. وضعیت بک اند را بررسی کنید.",
      );
    }
  }

  if (isCheckingAuth) {
    return (
      <main className="min-h-screen bg-muted/30 px-4 py-8 text-foreground" dir="rtl">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
          <p className="text-sm text-muted-foreground">در حال بررسی وضعیت ورود...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 text-foreground" dir="rtl">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_420px]">
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
            <h1 className="text-3xl font-bold leading-tight">
              داشبورد سفارش، تیکت و کیف پول ویکی اکانت
            </h1>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              ورود با session cookie انجام می شود؛ توکن در localStorage ذخیره نمی شود.
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">WikiAcc</p>
              <h2 className="mt-1 text-2xl font-bold">
                {isRegisterMode ? "ثبت‌نام کاربر" : "ورود به پنل"}
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

          <div className="mb-5 grid grid-cols-2 rounded-md border border-border bg-muted p-1 text-sm font-medium">
            <button
              aria-pressed={!isRegisterMode}
              className={`rounded px-3 py-2 transition ${
                !isRegisterMode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              type="button"
              onClick={() => switchMode("login")}
            >
              ورود
            </button>
            <button
              aria-pressed={isRegisterMode}
              className={`rounded px-3 py-2 transition ${
                isRegisterMode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              type="button"
              onClick={() => switchMode("register")}
            >
              ثبت‌نام
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isRegisterMode ? (
              <label className="block space-y-2 text-sm font-medium">
                <span>نام</span>
                <div className="relative">
                  <User className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoComplete="name"
                    className="h-11 pr-10"
                    minLength={2}
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
              </label>
            ) : null}

            <label className="block space-y-2 text-sm font-medium">
              <span>ایمیل</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoComplete="email"
                  className="h-11 pr-10"
                  inputMode="email"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </label>

            {isRegisterMode ? (
              <label className="block space-y-2 text-sm font-medium">
                <span>شماره تماس اختیاری</span>
                <div className="relative">
                  <Phone className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    autoComplete="tel"
                    className="h-11 pr-10"
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
              </label>
            ) : null}

            <label className="block space-y-2 text-sm font-medium">
              <span>رمز عبور</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoComplete={isRegisterMode ? "new-password" : "current-password"}
                  className="h-11 pr-10"
                  minLength={isRegisterMode ? 8 : undefined}
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </label>

            {isRegisterMode ? (
              <p className="text-xs leading-6 text-muted-foreground">
                رمز عبور باید حداقل ۸ کاراکتر باشد. بعد از ثبت‌نام مستقیم وارد پنل کاربری می‌شوید.
              </p>
            ) : null}

            {message ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {message}
              </p>
            ) : null}

            <Button className="h-11 w-full" disabled={state === "loading"} type="submit">
              {isRegisterMode ? <UserPlus className="size-4" /> : <LogIn className="size-4" />}
              {state === "loading"
                ? isRegisterMode
                  ? "در حال ثبت‌نام..."
                  : "در حال ورود..."
                : isRegisterMode
                  ? "ثبت‌نام و ورود"
                  : "ورود"}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between gap-3 text-sm">
            <Link className="text-muted-foreground transition hover:text-foreground" href="/">
              بازگشت به سایت
            </Link>
            <Link
              className="inline-flex items-center gap-1 font-medium text-primary"
              href="/dashboard"
            >
              مشاهده پنل
              <ArrowLeft className="size-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
