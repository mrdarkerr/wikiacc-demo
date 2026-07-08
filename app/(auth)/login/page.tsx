"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, LockKeyhole, LogIn, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";

type SubmitState = "idle" | "loading" | "success" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SubmitState>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");

    try {
      await api.auth.login({ email, password });
      setState("success");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(
        error instanceof ApiError
          ? error.message
          : "ورود انجام نشد. وضعیت بک اند را بررسی کنید.",
      );
    }
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
              <h2 className="mt-1 text-2xl font-bold">ورود به پنل</h2>
            </div>
            <Image
              alt="ویکی اکانت"
              className="size-12 rounded-md object-contain lg:hidden"
              height={48}
              src="/wiki-high-resolution-logo-transparent.png"
              width={48}
            />
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2 text-sm font-medium">
              <span>ایمیل</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pr-10"
                  inputMode="email"
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </label>

            <label className="block space-y-2 text-sm font-medium">
              <span>رمز عبور</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 pr-10"
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </label>

            {message ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {message}
              </p>
            ) : null}

            <Button className="h-11 w-full" disabled={state === "loading"} type="submit">
              <LogIn className="size-4" />
              {state === "loading" ? "در حال ورود..." : "ورود"}
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
