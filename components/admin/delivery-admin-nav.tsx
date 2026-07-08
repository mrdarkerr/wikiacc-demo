"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, List, ListPlus } from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
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
];

function isActive(pathname: string, href: string) {
  return href === "/admin/delivery-pools"
    ? pathname === href
    : pathname.startsWith(href);
}

export function DeliveryAdminNav() {
  const pathname = usePathname();

  return (
    <div className="w-full overflow-x-auto overscroll-x-contain">
      <nav className="flex min-w-max gap-2 rounded-lg border border-border bg-card p-2 shadow-sm">
        {links.map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;

          return (
            <Link
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
              )}
              href={link.href}
              key={link.href}
            >
              <Icon className="size-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
