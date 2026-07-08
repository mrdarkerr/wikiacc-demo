"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, ListPlus, Tags } from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
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
];

function isActive(pathname: string, href: string) {
  return href === "/admin/products"
    ? pathname === href
    : pathname.startsWith(href);
}

export function ProductAdminNav() {
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
