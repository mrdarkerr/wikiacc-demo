"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Boxes,
  ClipboardList,
  Headphones,
  LayoutDashboard,
  List,
  ListPlus,
  LogOut,
  Menu,
  MessageSquareText,
  PackagePlus,
  PanelsTopLeft,
  Tags,
  Users,
  WalletCards,
  X,
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

type AdminNavigationProps = {
  className?: string;
  onNavigate?: () => void;
  pathname: string;
};

function AdminNavigation({
  className,
  onNavigate,
  pathname,
}: AdminNavigationProps) {
  return (
    <nav
      aria-label="منوی مدیریت"
      className={cn("grid content-start gap-1 p-3", className)}
    >
      {navItems.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;

        return (
          <div key={item.href}>
            <Link
              aria-current={active && !item.children ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                active &&
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              )}
              href={item.href}
              onClick={onNavigate}
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
                      aria-current={childActive ? "page" : undefined}
                      className={cn(
                        "flex h-9 items-center gap-2 rounded-md px-3 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                        childActive && "bg-muted text-foreground",
                      )}
                      href={child.href}
                      key={child.href}
                      onClick={onNavigate}
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
  );
}

type AdminSidebarFooterProps = {
  onLogout: () => void;
};

function AdminSidebarFooter({ onLogout }: AdminSidebarFooterProps) {
  return (
    <div className="border-t border-border p-4">
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
        onClick={onLogout}
      >
        <LogOut className="size-4" />
        خروج
      </Button>
    </div>
  );
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = getPageTitle(pathname);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuCloseButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    mobileMenuCloseButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const desktopMediaQuery = window.matchMedia("(min-width: 1024px)");

    function handleDesktopChange(event: MediaQueryListEvent) {
      if (event.matches) setMobileMenuOpen(false);
    }

    desktopMediaQuery.addEventListener("change", handleDesktopChange);
    return () =>
      desktopMediaQuery.removeEventListener("change", handleDesktopChange);
  }, []);

  async function handleLogout() {
    setMobileMenuOpen(false);
    await api.auth.logout();
    router.push("/login");
    router.refresh();
  }

  function handleMobileMenuKeyDown(
    event: React.KeyboardEvent<HTMLElement>,
  ) {
    if (event.key !== "Tab") return;

    const focusableElements = Array.from(
      mobileMenuRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    const firstElement = focusableElements.at(0);
    const lastElement = focusableElements.at(-1);

    if (!firstElement || !lastElement) return;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
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

        <AdminNavigation
          className="min-h-0 flex-1 overflow-y-auto"
          pathname={pathname}
        />
        <AdminSidebarFooter onLogout={handleLogout} />
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur lg:mr-64">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              aria-controls="admin-mobile-navigation"
              aria-expanded={mobileMenuOpen}
              aria-label="باز کردن منوی مدیریت"
              className="lg:hidden"
              size="icon"
              type="button"
              variant="outline"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">ویکی اکانت</p>
              <h1 className="truncate text-lg font-bold">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">پنل کاربر</Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="pb-8 lg:mr-64">
        <div className="mx-auto w-full max-w-7xl min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-hidden="true"
            className="absolute inset-0 animate-in bg-foreground/40 fade-in duration-200"
            tabIndex={-1}
            type="button"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            ref={mobileMenuRef}
            aria-label="منوی مدیریت"
            aria-modal="true"
            className="absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] animate-in flex-col border-l border-border bg-card shadow-2xl slide-in-from-right duration-200"
            id="admin-mobile-navigation"
            role="dialog"
            onKeyDown={handleMobileMenuKeyDown}
          >
            <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
              <Image
                alt="ویکی اکانت"
                className="size-9 rounded-md object-contain"
                height={36}
                src="/wiki-high-resolution-logo-transparent.png"
                width={36}
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold">ویکی اکانت</p>
                <p className="text-xs text-muted-foreground">پنل ادمین</p>
              </div>
              <Button
                ref={mobileMenuCloseButtonRef}
                aria-label="بستن منوی مدیریت"
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>

            <AdminNavigation
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
              pathname={pathname}
              onNavigate={() => setMobileMenuOpen(false)}
            />
            <AdminSidebarFooter onLogout={handleLogout} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
