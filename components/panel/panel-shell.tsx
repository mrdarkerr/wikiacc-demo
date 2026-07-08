"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  LogOut,
  WalletCards,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type PanelShellProps = {
  children: React.ReactNode;
};

const navItems = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "داشبورد",
  },
  {
    href: "/orders",
    icon: ClipboardList,
    label: "سفارش ها",
  },
  {
    href: "/tickets",
    icon: Headphones,
    label: "تیکت ها",
  },
  {
    href: "/wallet",
    icon: WalletCards,
    label: "کیف پول",
  },
];

export function PanelShell({ children }: PanelShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle =
    navItems.find((item) => pathname.startsWith(item.href))?.label ?? "پنل";

  async function handleLogout() {
    await api.auth.logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-muted/30 text-foreground" dir="rtl">
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-64 border-l border-border bg-card lg:flex lg:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <Image
            alt="ویکی اکانت"
            className="size-9 rounded-md object-contain"
            height={36}
            src="/wiki-high-resolution-logo-transparent.png"
            width={36}
          />
          <div>
            <p className="font-bold">ویکی اکانت</p>
            <p className="text-xs text-muted-foreground">پنل کاربری</p>
          </div>
        </div>

        <nav className="grid gap-1 p-3">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                  active &&
                    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
                href={item.href}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border p-4">
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">حساب کاربری</p>
            <p className="mt-1 text-xs text-muted-foreground">
              session cookie فعال
            </p>
          </div>
          <Button
            className="mt-3 w-full justify-start"
            type="button"
            variant="ghost"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            خروج
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur lg:mr-64">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs text-muted-foreground">ویکی اکانت</p>
            <h1 className="text-lg font-bold">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden h-8 items-center rounded-md border border-border px-3 text-xs text-muted-foreground sm:inline-flex">
              API: Fastify
            </span>
            <Button aria-label="اعلان ها" size="icon" variant="outline">
              <Bell className="size-4" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="pb-20 lg:mr-64 lg:pb-8">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border bg-card lg:hidden">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground",
                active && "text-primary",
              )}
              href={item.href}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
