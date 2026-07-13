"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  List,
  ListPlus,
  LogOut,
  MessageSquareText,
  PackagePlus,
  PanelsTopLeft,
  Tags,
  Users,
  WalletCards,
} from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type AdminShellProps = {
  children: React.ReactNode;
};

type NavItem = {
  children?: NavItem[];
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
};

const navItems = [
  {
    href: "/admin",
    icon: LayoutDashboard,
    label: "داشبورد",
  },
  {
    href: "/admin/content",
    icon: PanelsTopLeft,
    label: "محتوای سایت",
  },
  {
    href: "/admin/sms",
    icon: MessageSquareText,
    label: "پیامک",
  },
  {
    href: "/admin/orders",
    icon: ClipboardList,
    label: "سفارش ها",
  },
  {
    children: [
      {
        href: "/admin/products",
        icon: List,
        label: "لیست محصولات",
      },
      {
        href: "/admin/products/new",
        icon: ListPlus,
        label: "ایجاد محصول",
      },
      {
        href: "/admin/products/categories",
        icon: Tags,
        label: "دسته بندی ها",
      },
    ],
    href: "/admin/products",
    icon: PackagePlus,
    label: "محصولات",
  },
  {
    children: [
      {
        href: "/admin/delivery-pools",
        icon: List,
        label: "لیست استخرها",
      },
      {
        href: "/admin/delivery-pools/new",
        icon: ListPlus,
        label: "ایجاد استخر",
      },
      {
        href: "/admin/delivery-pools/items",
        icon: Boxes,
        label: "آیتم های آماده",
      },
    ],
    href: "/admin/delivery-pools",
    icon: Boxes,
    label: "تحویل فوری",
  },
  {
    href: "/admin/users",
    icon: Users,
    label: "کاربران",
  },
  {
    href: "/admin/wallet",
    icon: WalletCards,
    label: "کیف پول",
  },
  {
    href: "/admin/tickets",
    icon: Headphones,
    label: "تیکت ها",
  },
] satisfies NavItem[];

function isActivePath(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

const exactChildHrefs = new Set(["/admin/products", "/admin/delivery-pools"]);

function isChildActivePath(pathname: string, href: string) {
  return exactChildHrefs.has(href) ? pathname === href : isActivePath(pathname, href);
}

function getPageTitle(pathname: string) {
  for (const item of navItems) {
    const child = item.children?.find((navChild) =>
      isChildActivePath(pathname, navChild.href),
    );
    if (child) return child.label;
    if (isActivePath(pathname, item.href)) return item.label;
  }

  return "پنل ادمین";
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = getPageTitle(pathname);

  async function handleLogout() {
    await api.auth.logout();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-muted/30 text-foreground" dir="rtl">
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
            <p className="text-xs text-muted-foreground">پنل ادمین</p>
          </div>
        </div>

        <nav className="grid gap-1 p-3">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;

            return (
              <div key={item.href}>
                <Link
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
                {item.children ? (
                  <div className="mt-1 grid gap-1 pr-7">
                    {item.children.map((child) => {
                      const childActive = isChildActivePath(pathname, child.href);
                      const ChildIcon = child.icon;

                      return (
                        <Link
                          className={cn(
                            "flex h-9 items-center gap-2 rounded-md px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                            childActive && "bg-muted text-foreground",
                          )}
                          href={child.href}
                          key={child.href}
                        >
                          <ChildIcon className="size-3.5" />
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-border p-4">
          <div className="rounded-md bg-muted p-3 text-sm">
            <p className="font-medium">دسترسی مدیریتی</p>
            <p className="mt-1 text-xs text-muted-foreground">
              مدیریت سفارش ها، تیکت ها و کیف پول کاربران
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
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">پنل کاربر</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="pb-24 lg:mr-64 lg:pb-8">
        <div className="mx-auto w-full max-w-7xl min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 overflow-x-auto border-t border-border bg-card lg:hidden">
        <div className="flex min-w-max">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                className={cn(
                  "flex h-16 w-24 flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground",
                  active && "text-primary",
                )}
                href={item.href}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
