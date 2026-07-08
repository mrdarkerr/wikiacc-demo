import type {
  OrderStatus,
  TicketPriority,
  TicketStatus,
  TransactionStatus,
  TransactionType,
} from "@/types/api";
import { cn } from "@/lib/utils";

type StatusTone = "amber" | "blue" | "emerald" | "gray" | "rose";

const toneClasses: Record<StatusTone, string> = {
  amber:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  gray: "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
};

const orderLabels: Record<OrderStatus, { label: string; tone: StatusTone }> = {
  AWAITING_ADMIN: { label: "در انتظار بررسی", tone: "blue" },
  CANCELLED: { label: "لغوشده", tone: "rose" },
  DELIVERED: { label: "تحویل شده", tone: "emerald" },
  DRAFT: { label: "پیش نویس", tone: "gray" },
  PENDING_INFO: { label: "نیازمند اطلاعات", tone: "amber" },
  READY: { label: "آماده", tone: "emerald" },
  REFUNDED: { label: "مرجوع شده", tone: "gray" },
};

const ticketLabels: Record<TicketStatus, { label: string; tone: StatusTone }> = {
  ANSWERED: { label: "پاسخ داده شده", tone: "emerald" },
  CLOSED: { label: "بسته", tone: "gray" },
  OPEN: { label: "باز", tone: "amber" },
};

const priorityLabels: Record<TicketPriority, { label: string; tone: StatusTone }> = {
  HIGH: { label: "فوری", tone: "rose" },
  LOW: { label: "کم", tone: "gray" },
  NORMAL: { label: "معمولی", tone: "blue" },
};

const transactionStatusLabels: Record<
  TransactionStatus,
  { label: string; tone: StatusTone }
> = {
  COMPLETED: { label: "موفق", tone: "emerald" },
  FAILED: { label: "ناموفق", tone: "rose" },
  PENDING: { label: "در انتظار", tone: "amber" },
  REVERSED: { label: "برگشتی", tone: "gray" },
};

const transactionTypeLabels: Record<TransactionType, string> = {
  ADMIN_CREDIT: "شارژ ادمین",
  ADMIN_DEBIT: "برداشت ادمین",
  GATEWAY_TOPUP: "شارژ درگاه",
  ORDER_PAYMENT: "خرید",
  ORDER_REFUND: "بازگشت وجه",
};

type StatusBadgeProps =
  | { type: "order"; value: OrderStatus }
  | { type: "ticket"; value: TicketStatus }
  | { type: "priority"; value: TicketPriority }
  | { type: "transaction"; value: TransactionStatus };

export function StatusBadge(props: StatusBadgeProps) {
  const status =
    props.type === "order"
      ? orderLabels[props.value]
      : props.type === "ticket"
        ? ticketLabels[props.value]
        : props.type === "priority"
          ? priorityLabels[props.value]
          : transactionStatusLabels[props.value];

  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-medium",
        toneClasses[status.tone],
      )}
    >
      {status.label}
    </span>
  );
}

export function transactionTypeLabel(type: TransactionType) {
  return transactionTypeLabels[type];
}
