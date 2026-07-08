"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Clock3,
  Info,
  Lock,
  MessageSquare,
  SendHorizontal,
  Settings2,
  X,
} from "lucide-react";

import { formatDate } from "@/components/panel/formatters";
import { PanelSection } from "@/components/panel/panel-section";
import { StatusBadge } from "@/components/panel/status-badge";
import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiMeta, Ticket, TicketMessage } from "@/types/api";

const MESSAGE_PAGE_SIZE = 20;

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
    <DialogOverlay
      className="xl:hidden"
      contentClassName="max-h-[calc(100svh-2rem)] max-w-md overflow-y-auto rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xl"
      onClose={onClose}
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
    </DialogOverlay>
  );
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [messagesMeta, setMessagesMeta] = useState<ApiMeta | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [activeDialog, setActiveDialog] = useState<"status" | "details" | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
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
    const result = await api.tickets.get(ticketId);
    setTicket(result.ticket);
  }

  const loadMessages = useCallback(
    async function loadMessages(
      nextPage = 1,
      mode: "replace" | "prepend" = "replace",
    ) {
      setMessagesLoading(true);
      try {
        const result = await api.tickets.messages(ticketId, {
          page: nextPage,
          perPage: MESSAGE_PAGE_SIZE,
        });
        setMessages((current) =>
          mode === "prepend"
            ? [...result.data.messages, ...current]
            : result.data.messages,
        );
        setMessagesMeta(result.meta ?? null);
      } finally {
        setMessagesLoading(false);
      }
    },
    [ticketId],
  );

  useEffect(() => {
    let active = true;

    api.tickets
      .get(ticketId)
      .then(async (result) => {
        if (!active) return;
        setTicket(result.ticket);
        shouldScrollToBottomRef.current = true;
        await loadMessages(1);
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
  }, [loadMessages, ticketId]);

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
        return;
      }

      if (shouldScrollToBottomRef.current) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
        shouldScrollToBottomRef.current = false;
      }
    });
  }, [messages.length]);

  async function handleMessagesScroll() {
    const scrollElement = messagesScrollRef.current;
    const messagePage = messagesMeta?.page ?? 1;
    const messageTotalPages = messagesMeta?.totalPages ?? 1;

    if (
      !scrollElement ||
      scrollElement.scrollTop > 32 ||
      messagePage >= messageTotalPages ||
      loadingOlderMessagesRef.current
    ) {
      return;
    }

    previousScrollStateRef.current = {
      height: scrollElement.scrollHeight,
      top: scrollElement.scrollTop,
    };
    loadingOlderMessagesRef.current = true;

    try {
      await loadMessages(messagePage + 1, "prepend");
    } finally {
      loadingOlderMessagesRef.current = false;
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket || !replyBody.trim()) return;

    setSaving(true);
    try {
      await api.tickets.addMessage(ticket.id, { body: replyBody.trim() });
      setReplyBody("");
      await loadTicket();
      shouldScrollToBottomRef.current = true;
      await loadMessages(1);
      setMessage("پاسخ شما ارسال شد.");
      setError("");
    } catch (replyError) {
      setError(errorMessage(replyError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function closeTicket() {
    if (!ticket) return;

    setSaving(true);
    try {
      const result = await api.tickets.close(ticket.id);
      setTicket(result.ticket);
      setActiveDialog(null);
      setMessage("تیکت بسته شد.");
      setError("");
    } catch (closeError) {
      setError(errorMessage(closeError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">در حال دریافت تیکت...</p>
    );
  }

  if (!ticket) {
    return (
      <PanelSection title="تیکت پیدا نشد" description={error}>
        <Button asChild variant="outline">
          <Link href="/tickets">
            <ArrowRight className="size-4" />
            بازگشت به تیکت‌ها
          </Link>
        </Button>
      </PanelSection>
    );
  }

  const currentTicket = ticket;
  const messagePage = messagesMeta?.page ?? 1;
  const messageTotalPages = messagesMeta?.totalPages ?? 1;
  const ticketClosed = currentTicket.status === "CLOSED";

  function renderStatusContent() {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <StatusBadge type="ticket" value={currentTicket.status} />
          <StatusBadge type="priority" value={currentTicket.priority} />
        </div>
        <p className="text-sm text-muted-foreground">
          آخرین بروزرسانی: {formatDate(currentTicket.updatedAt)}
        </p>
        <Button
          className="w-full"
          disabled={saving || ticketClosed}
          type="button"
          variant="outline"
          onClick={closeTicket}
        >
          <Lock className="size-4" />
          بستن تیکت
        </Button>
      </div>
    );
  }

  function renderDetailsContent() {
    return (
      <dl className="space-y-4 text-sm">
        <div>
          <dt className="text-muted-foreground">نوع درخواست</dt>
          <dd className="mt-1 font-medium">
            {currentTicket.orderId ? "مرتبط با سفارش" : "عمومی"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">سفارش</dt>
          <dd className="mt-1" dir={currentTicket.orderId ? "ltr" : "rtl"}>
            {currentTicket.orderId ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            تعداد پیام‌های نمایش داده‌شده
          </dt>
          <dd className="mt-1">{messages.length}</dd>
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
              <Link href="/tickets">
                <ArrowRight className="size-4" />
                تیکت‌ها
              </Link>
            </Button>
            <h2 className="mt-1 line-clamp-2 text-xl font-bold leading-8 sm:text-2xl">
              {currentTicket.subject}
            </h2>
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <Clock3 className="size-4 shrink-0" />
              آخرین بروزرسانی: {formatDate(currentTicket.updatedAt)}
            </p>
          </div>
          <div className="hidden flex-wrap gap-2 sm:flex">
            <StatusBadge type="priority" value={currentTicket.priority} />
            <StatusBadge type="ticket" value={currentTicket.status} />
          </div>
        </div>

        {message ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-300">
            {message}
          </p>
        ) : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

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

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/20">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 py-3 sm:px-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <MessageSquare className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">پشتیبانی ویکی اکانت</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {currentTicket.orderId
                    ? `سفارش مرتبط: ${currentTicket.orderId}`
                    : "درخواست عمومی"}
                </p>
              </div>
            </div>
            <p className="shrink-0 text-xs text-muted-foreground">
              {messages.length} پیام
            </p>
          </div>

          <div
            className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3 sm:p-4"
            ref={messagesScrollRef}
            onScroll={handleMessagesScroll}
          >
            {messagePage < messageTotalPages ? (
              <div className="flex justify-center">
                <Button
                  disabled={messagesLoading}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => loadMessages(messagePage + 1, "prepend")}
                >
                  {messagesLoading ? "در حال دریافت..." : "نمایش پیام‌های قبلی"}
                </Button>
              </div>
            ) : null}

            {messages.map((ticketMessage) => {
              const isUserMessage = !ticketMessage.isAdmin;

              return (
                <div
                  className={cn(
                    "flex",
                    isUserMessage ? "justify-end" : "justify-start",
                  )}
                  key={ticketMessage.id}
                >
                  <article
                    className={cn(
                      "max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[72%]",
                      isUserMessage
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md border border-border bg-background",
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs opacity-80">
                      <span>{ticketMessage.isAdmin ? "پشتیبانی" : "شما"}</span>
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
            {ticketClosed ? (
              <div className="rounded-md border border-border bg-muted/50 px-3 py-4 text-sm text-muted-foreground">
                این تیکت بسته شده است و امکان ارسال پیام جدید ندارد.
              </div>
            ) : (
              <>
                <label className="sr-only" htmlFor="ticket-reply">
                  پیام
                </label>
                <div className="flex items-end gap-2 sm:gap-3">
                  <textarea
                    className="max-h-32 min-h-12 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-7 ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    id="ticket-reply"
                    placeholder="پیام خود را بنویسید..."
                    required
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                  />
                  <Button
                    className="h-12 shrink-0 px-4"
                    disabled={saving || !replyBody.trim()}
                    type="submit"
                  >
                    <SendHorizontal className="size-4" />
                    ارسال
                  </Button>
                </div>
              </>
            )}
          </form>
        </div>

        <aside className="hidden min-h-0 space-y-4 overflow-y-auto xl:block">
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-4 font-bold">وضعیت تیکت</h3>
            {renderStatusContent()}
          </section>
          <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-4 font-bold">اطلاعات مرتبط</h3>
            {renderDetailsContent()}
          </section>
        </aside>
      </div>

      <MobileDialog
        open={activeDialog === "status"}
        title="وضعیت تیکت"
        onClose={() => setActiveDialog(null)}
      >
        {renderStatusContent()}
      </MobileDialog>
      <MobileDialog
        open={activeDialog === "details"}
        title="اطلاعات مرتبط"
        onClose={() => setActiveDialog(null)}
      >
        {renderDetailsContent()}
      </MobileDialog>
    </div>
  );
}
