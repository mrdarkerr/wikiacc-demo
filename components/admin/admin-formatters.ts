import type { ProductType, User } from "@/types/api";

const numberFormatter = new Intl.NumberFormat("fa-IR");

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatCurrency(amount: number) {
  return `${numberFormatter.format(amount)} تومان`;
}

export function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("fa-IR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function shortId(id?: string | null, length = 8) {
  if (!id) return "-";
  return id.slice(-length).toUpperCase();
}

export function orderCode(id?: string | null) {
  return id ? `WKA-${shortId(id, 6)}` : "-";
}

export function userLabel(
  user?: (Pick<User, "name" | "email"> & Partial<Pick<User, "phone">>) | null,
) {
  if (!user) return "-";
  const identity = user.email || user.phone || "بدون ایمیل";
  return user.name ? `${user.name} (${identity})` : identity;
}

export function productTypeLabel(type: ProductType) {
  return type === "INSTANT_DELIVERY" ? "تحویل فوری" : "فرم اختصاصی";
}
