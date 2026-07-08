"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { ArrowRight, Lock, SendHorizontal } from "lucide-react";

import { formatDate } from "@/components/panel/formatters";
import { PanelSection } from "@/components/panel/panel-section";
import { StatusBadge } from "@/components/panel/status-badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { Ticket } from "@/types/api";

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات تیکت انجام نشد.";
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadTicket() {
    const result = await api.tickets.get(ticketId);
    setTicket(result.ticket);
  }

  useEffect(() => {
    let active = true;

    api.tickets
      .get(ticketId)
      .then((result) => {
        if (!active) return;
        setTicket(result.ticket);
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

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket || !replyBody.trim()) return;

    setSaving(true);
    try {
      await api.tickets.addMessage(ticket.id, { body: replyBody.trim() });
      setReplyBody("");
      await loadTicket();
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
      await api.tickets.close(ticket.id);
      await loadTicket();
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
    return <p className="text-sm text-muted-foreground">در حال دریافت تیکت...</p>;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/tickets">
              <ArrowRight className="size-4" />
              تیکت‌ها
            </Link>
          </Button>
          <h2 className="mt-2 text-2xl font-bold">{ticket.subject}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ticket.orderId ? `سفارش مرتبط: ${ticket.orderId}` : "درخواست عمومی"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge type="priority" value={ticket.priority} />
          <StatusBadge type="ticket" value={ticket.status} />
        </div>
      </div>

      {message ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <PanelSection title="مکالمه">
          <div className="space-y-4">
            {ticket.messages.map((ticketMessage) => (
              <article
                className={`rounded-md p-4 text-sm ${
                  ticketMessage.isAdmin
                    ? "mr-auto max-w-[92%] bg-primary text-primary-foreground"
                    : "ml-auto max-w-[92%] bg-muted"
                }`}
                key={ticketMessage.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs opacity-80">
                  <span>{ticketMessage.isAdmin ? "پشتیبانی" : "شما"}</span>
                  <span>{formatDate(ticketMessage.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap leading-7">
                  {ticketMessage.body}
                </p>
              </article>
            ))}
          </div>
        </PanelSection>

        <div className="space-y-6">
          <PanelSection title="پاسخ جدید">
            {ticket.status === "CLOSED" ? (
              <p className="text-sm text-muted-foreground">
                این تیکت بسته شده است.
              </p>
            ) : (
              <form className="space-y-3" onSubmit={sendReply}>
                <label className="block text-sm font-medium">
                  پیام
                  <textarea
                    className="mt-2 min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                  />
                </label>
                <Button className="w-full" disabled={saving} type="submit">
                  <SendHorizontal className="size-4" />
                  ارسال پاسخ
                </Button>
              </form>
            )}
          </PanelSection>

          <PanelSection title="وضعیت">
            <p className="text-sm text-muted-foreground">
              آخرین به‌روزرسانی: {formatDate(ticket.updatedAt)}
            </p>
            <Button
              className="mt-4 w-full"
              disabled={saving || ticket.status === "CLOSED"}
              type="button"
              variant="outline"
              onClick={closeTicket}
            >
              <Lock className="size-4" />
              بستن تیکت
            </Button>
          </PanelSection>
        </div>
      </div>
    </div>
  );
}
