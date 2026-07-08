"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Clock3,
  Info,
  MessageSquare,
  Save,
  Send,
  Settings2,
  X,
} from "lucide-react";

import {
  formatCurrency,
  formatDate,
  orderCode,
  userLabel,
} from "@/components/admin/admin-formatters";
import { AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AdminTicket, TicketStatus } from "@/types/api";

const MESSAGE_PAGE_SIZE = 20;
const ticketStatuses: TicketStatus[] = ["OPEN", "ANSWERED", "CLOSED"];

const ticketStatusLabels: Record<TicketStatus, string> = {
  ANSWERED: "پاسخ داده شده",
  CLOSED: "بسته",
  OPEN: "باز",
};

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات تیکت انجام نشد.";
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function MobileDialog({
  children,
  onClose,
  open,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  if (!open) return null;

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm xl:hidden"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="absolute inset-x-3 bottom-20 max-h-[calc(100svh-7rem)] overflow-y-auto rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="font-bold">{title}</h3>
          <Button
            aria-label="بستن"
            size="icon"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;
  const [ticket, setTicket] = useState<AdminTicket | null>(null);
  const [status, setStatus] = useState<TicketStatus>("OPEN");
  const [replyBody, setReplyBody] = useState("");
  const [visibleMessageCount, setVisibleMessageCount] =
    useState(MESSAGE_PAGE_SIZE);
  const [activeDialog, setActiveDialog] = useState<"status" | "details" | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const previousScrollStateRef = useRef<{
    height: number;
    top: number;
  } | null>(null);
  const shouldScrollToBottomRef = useRef(true);
  const loadingOlderMessagesRef = useRef(false);

  async function loadTicket() {
    const result = await api.admin.tickets.get(ticketId);
    setTicket(result.ticket);
    setStatus(result.ticket.status);
  }

  useEffect(() => {
    let active = true;

    api.admin.tickets
      .get(ticketId)
      .then((result) => {
        if (!active) return;
        setTicket(result.ticket);
        setStatus(result.ticket.status);
        setVisibleMessageCount(MESSAGE_PAGE_SIZE);
        shouldScrollToBottomRef.current = true;
        setError("");
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [ticketId]);

  const visibleMessages = useMemo(() => {
    return ticket?.messages.slice(-visibleMessageCount) ?? [];
  }, [ticket, visibleMessageCount]);

  const hiddenMessageCount = Math.max(
    0,
    (ticket?.messages.length ?? 0) - visibleMessages.length,
  );

  useEffect(() => {
    const scrollElement = messagesScrollRef.current;
    if (!scrollElement) return;

    window.requestAnimationFrame(() => {
      const previousScrollState = previousScrollStateRef.current;

      if (previousScrollState) {
        scrollElement.scrollTop =
          scrollElement.scrollHeight -
          previousScrollState.height +
          previousScrollState.top;
        previousScrollStateRef.current = null;
        loadingOlderMessagesRef.current = false;
        return;
      }

      if (shouldScrollToBottomRef.current) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
        shouldScrollToBottomRef.current = false;
      }
    });
  }, [visibleMessages.length]);

  function loadOlderMessages() {
    if (!ticket || hiddenMessageCount <= 0 || loadingOlderMessagesRef.current) {
      return;
    }

    const scrollElement = messagesScrollRef.current;
    if (scrollElement) {
      previousScrollStateRef.current = {
        height: scrollElement.scrollHeight,
        top: scrollElement.scrollTop,
      };
    }
    loadingOlderMessagesRef.current = true;

    setVisibleMessageCount((current) =>
      Math.min(current + MESSAGE_PAGE_SIZE, ticket.messages.length),
    );
  }

  function handleMessagesScroll() {
    const scrollElement = messagesScrollRef.current;
    if (!scrollElement || hiddenMessageCount <= 0) return;

    if (scrollElement.scrollTop <= 32) {
      loadOlderMessages();
    }
  }

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket) return;

    setSaving(true);
    try {
      await api.admin.tickets.updateStatus(ticket.id, { status });
      await loadTicket();
      setActiveDialog(null);
      setMessage("وضعیت تیکت به‌روز شد.");
      setError("");
    } catch (updateError) {
      setError(errorMessage(updateError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket || !replyBody.trim()) return;

    setSaving(true);
    try {
      await api.admin.tickets.addMessage(ticket.id, {
        body: replyBody.trim(),
      });
      setReplyBody("");
      shouldScrollToBottomRef.current = true;
      await loadTicket();
      setMessage("پاسخ ارسال شد.");
      setError("");
    } catch (replyError) {
      setError(errorMessage(replyError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <AdminState>در حال دریافت تیکت...</AdminState>;
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline">
          <Link href="/admin/tickets">
            <ArrowRight className="size-4" />
            بازگشت به تیکت‌ها
          </Link>
        </Button>
        <AdminState tone="danger">{error || "تیکت پیدا نشد."}</AdminState>
      </div>
    );
  }

  function renderStatusContent(selectId: string) {
    return (
      <form className="space-y-4" onSubmit={updateStatus}>
        <div className="flex flex-wrap gap-2">
          <AdminStatusBadge type="priority" value={ticket.priority} />
          <AdminStatusBadge type="ticket" value={ticket.status} />
        </div>
        <label className="block text-sm font-medium">
          وضعیت
          <Select
            className="mt-2 h-10 w-full"
            disabled={saving}
            id={selectId}
            value={status}
            onChange={(event) => setStatus(event.target.value as TicketStatus)}
          >
            {ticketStatuses.map((nextStatus) => (
              <option key={nextStatus} value={nextStatus}>
                {ticketStatusLabels[nextStatus]}
              </option>
            ))}
          </Select>
        </label>
        <Button className="w-full" disabled={saving} type="submit">
          <Save className="size-4" />
          ذخیره وضعیت
        </Button>
      </form>
    );
  }

  function renderDetailsContent() {
    return (
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="text-muted-foreground">کاربر</dt>
          <dd className="mt-1 font-medium">{userLabel(ticket.user)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">سفارش مرتبط</dt>
          <dd className="mt-1">
            {ticket.order ? (
              <Link
                className="font-medium text-primary"
                dir="ltr"
                href={`/admin/orders/${ticket.order.id}`}
              >
                {orderCode(ticket.order.id)}
              </Link>
            ) : (
              "-"
            )}
          </dd>
        </div>
        {ticket.order ? (
          <div>
            <dt className="text-muted-foreground">مبلغ سفارش</dt>
            <dd className="mt-1">
              {formatCurrency(ticket.order.totalAmount)}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">آخرین بروزرسانی</dt>
          <dd className="mt-1">{formatDate(ticket.updatedAt)}</dd>
        </div>
      </dl>
    );
  }

  return (
    <div className="flex h-[calc(100svh-12rem)] min-h-[420px] flex-col gap-3 lg:h-[calc(100svh-8rem)]">
      <div className="shrink-0 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/tickets">
                <ArrowRight className="size-4" />
                تیکت‌ها
              </Link>
            </Button>
            <h2 className="mt-1 line-clamp-2 text-xl font-bold leading-8 sm:text-2xl">
              {ticket.subject}
            </h2>
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <Clock3 className="size-4 shrink-0" />
              آخرین بروزرسانی: {formatDate(ticket.updatedAt)}
            </p>
          </div>
          <div className="hidden flex-wrap gap-2 sm:flex">
            <AdminStatusBadge type="priority" value={ticket.priority} />
            <AdminStatusBadge type="ticket" value={ticket.status} />
          </div>
        </div>

        {message ? <AdminState tone="success">{message}</AdminState> : null}
        {error ? <AdminState tone="danger">{error}</AdminState> : null}

        <div className="flex gap-2 xl:hidden">
          <Button
            className="flex-1"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => setActiveDialog("status")}
          >
            <Settings2 className="size-4" />
            وضعیت
          </Button>
          <Button
            className="flex-1"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => setActiveDialog("details")}
          >
            <Info className="size-4" />
            اطلاعات
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/20">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 py-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <MessageSquare className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{userLabel(ticket.user)}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {ticket.order
                    ? `سفارش مرتبط: ${orderCode(ticket.order.id)}`
                    : "درخواست عمومی"}
                </p>
              </div>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">
              {ticket.messages.length} پیام
            </p>
          </div>

          <div
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 sm:p-4"
            ref={messagesScrollRef}
            onScroll={handleMessagesScroll}
          >
            {hiddenMessageCount > 0 ? (
              <div className="flex justify-center">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={loadOlderMessages}
                >
                  نمایش پیام‌های قبلی ({hiddenMessageCount})
                </Button>
              </div>
            ) : null}

            {visibleMessages.map((ticketMessage) => {
              const isSupportMessage = ticketMessage.isAdmin;

              return (
                <div
                  className={cn(
                    "flex",
                    isSupportMessage ? "justify-end" : "justify-start",
                  )}
                  key={ticketMessage.id}
                >
                  <article
                    className={cn(
                      "max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[72%]",
                      isSupportMessage
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md border border-border bg-background",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs opacity-80">
                      <span>
                        {isSupportMessage
                          ? "پشتیبانی"
                          : ticketMessage.sender?.name ?? "کاربر"}
                      </span>
                      <span>{formatMessageTime(ticketMessage.createdAt)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap leading-7">
                      {ticketMessage.body}
                    </p>
                  </article>
                </div>
              );
            })}
          </div>

          <form
            className="shrink-0 border-t border-border bg-card p-2 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] sm:p-3"
            onSubmit={sendReply}
          >
            <label className="sr-only" htmlFor="admin-ticket-reply">
              پاسخ پشتیبانی
            </label>
            <div className="flex items-end gap-2 sm:gap-3">
              <textarea
                className="max-h-32 min-h-12 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-7 ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                id="admin-ticket-reply"
                placeholder="پاسخ خود را بنویسید..."
                required
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
              />
              <Button
                className="h-12 shrink-0 px-4"
                disabled={saving || !replyBody.trim()}
                type="submit"
              >
                <Send className="size-4" />
                ارسال
              </Button>
            </div>
          </form>
        </div>

        <aside className="hidden min-h-0 space-y-4 overflow-y-auto xl:block">
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-4 font-bold">وضعیت رسیدگی</h3>
            {renderStatusContent("admin-ticket-status")}
          </section>
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-4 font-bold">جزئیات تیکت</h3>
            {renderDetailsContent()}
          </section>
        </aside>
      </div>

      <MobileDialog
        open={activeDialog === "status"}
        title="وضعیت تیکت"
        onClose={() => setActiveDialog(null)}
      >
        {renderStatusContent("admin-ticket-status-mobile")}
      </MobileDialog>
      <MobileDialog
        open={activeDialog === "details"}
        title="اطلاعات تیکت"
        onClose={() => setActiveDialog(null)}
      >
        {renderDetailsContent()}
      </MobileDialog>
    </div>
  );
}
