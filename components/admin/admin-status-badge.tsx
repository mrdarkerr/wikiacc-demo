import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AdminStatusBadgeProps = {
  value?: string | boolean | null;
  type?:
    | "order"
    | "payment"
    | "ticket"
    | "priority"
    | "delivery"
    | "role"
    | "product"
    | "transaction"
    | "boolean";
};

const labels: Record<string, string> = {
  ADMIN: "ادمین",
  ADMIN_CREDIT: "شارژ ادمین",
  ADMIN_DEBIT: "برداشت ادمین",
  ANSWERED: "پاسخ داده شده",
  AVAILABLE: "آماده",
  AWAITING_ADMIN: "در انتظار ادمین",
  CANCELLED: "لغو شده",
  CLOSED: "بسته",
  COMPLETED: "تکمیل شده",
  CUSTOM_FORM: "فرم اختصاصی",
  DELIVERED: "تحویل شده",
  DISABLED: "غیرفعال",
  DRAFT: "پیش نویس",
  FAILED: "ناموفق",
  GATEWAY_TOPUP: "شارژ درگاه",
  HIGH: "زیاد",
  INSTANT_DELIVERY: "تحویل فوری",
  LOW: "کم",
  NORMAL: "معمولی",
  OPEN: "باز",
  ORDER_PAYMENT: "پرداخت سفارش",
  ORDER_REFUND: "بازگشت وجه",
  PAID: "پرداخت شده",
  PENDING: "در انتظار",
  PENDING_INFO: "نیازمند اطلاعات",
  READY: "آماده تحویل",
  REFUNDED: "مسترد",
  RESERVED: "رزرو شده",
  REVERSED: "برگشت خورده",
  UNPAID: "پرداخت نشده",
  USER: "کاربر",
  false: "غیرفعال",
  true: "فعال",
};

function statusTone(value: string) {
  if (
    [
      "ACTIVE",
      "ADMIN",
      "AVAILABLE",
      "COMPLETED",
      "DELIVERED",
      "INSTANT_DELIVERY",
      "OPEN",
      "PAID",
      "READY",
      "true",
    ].includes(value)
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-200";
  }

  if (
    [
      "ANSWERED",
      "AWAITING_ADMIN",
      "CUSTOM_FORM",
      "HIGH",
      "PENDING",
      "PENDING_INFO",
      "RESERVED",
      "UNPAID",
    ].includes(value)
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-200";
  }

  if (
    [
      "CANCELLED",
      "CLOSED",
      "DISABLED",
      "FAILED",
      "REFUNDED",
      "REVERSED",
      "false",
    ].includes(value)
  ) {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950 dark:text-rose-200";
  }

  return "border-border bg-muted text-muted-foreground";
}

export function AdminStatusBadge({ value }: AdminStatusBadgeProps) {
  const key = String(value ?? "-");

  return (
    <Badge className={cn("whitespace-nowrap", statusTone(key))} variant="outline">
      {labels[key] ?? key}
    </Badge>
  );
}
