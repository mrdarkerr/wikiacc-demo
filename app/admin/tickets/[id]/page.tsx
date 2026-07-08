"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { ArrowRight, Save, Send } from "lucide-react";

import {
  formatCurrency,
  formatDate,
  orderCode,
  userLabel,
} from "@/components/admin/admin-formatters";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import type { AdminTicket, TicketStatus } from "@/types/api";

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

export default function AdminTicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;
  const [ticket, setTicket] = useState<AdminTicket | null>(null);
  const [status, setStatus] = useState<TicketStatus>("OPEN");
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

  async function updateStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket) return;

    setSaving(true);
    try {
      await api.admin.tickets.updateStatus(ticket.id, { status });
      await loadTicket();
      setMessage("وضعیت تیکت به روز شد.");
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/tickets">
              <ArrowRight className="size-4" />
              تیکت‌ها
            </Link>
          </Button>
          <h2 className="mt-2 text-2xl font-bold">{ticket.subject}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminStatusBadge type="priority" value={ticket.priority} />
          <AdminStatusBadge type="ticket" value={ticket.status} />
        </div>
      </div>

      {message ? <AdminState tone="success">{message}</AdminState> : null}
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <AdminSection title="مکالمه">
          <div className="space-y-4">
            <div className="space-y-3">
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
                    <span>
                      {ticketMessage.isAdmin
                        ? "پشتیبانی"
                        : ticketMessage.sender?.name ?? "کاربر"}
                    </span>
                    <span>{formatDate(ticketMessage.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap leading-7">
                    {ticketMessage.body}
                  </p>
                </article>
              ))}
            </div>

            <form className="space-y-3 border-t border-border pt-4" onSubmit={sendReply}>
              <label className="block text-sm font-medium">
                پاسخ پشتیبانی
                <textarea
                  className="mt-2 min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                />
              </label>
              <Button disabled={saving} type="submit">
                <Send className="size-4" />
                ارسال پاسخ
              </Button>
            </form>
          </div>
        </AdminSection>

        <div className="space-y-6">
          <AdminSection title="جزئیات تیکت">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">کاربر</dt>
                <dd className="mt-1 font-medium">{userLabel(ticket.user)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">آخرین به‌روزرسانی</dt>
                <dd className="mt-1">{formatDate(ticket.updatedAt)}</dd>
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
            </dl>
          </AdminSection>

          <AdminSection title="وضعیت رسیدگی">
            <form className="space-y-4" onSubmit={updateStatus}>
              <label className="block text-sm font-medium">
                وضعیت
                <select
                  className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={saving}
                  value={status}
                  onChange={(event) => setStatus(event.target.value as TicketStatus)}
                >
                  {ticketStatuses.map((nextStatus) => (
                    <option key={nextStatus} value={nextStatus}>
                      {ticketStatusLabels[nextStatus]}
                    </option>
                  ))}
                </select>
              </label>
              <Button className="w-full" disabled={saving} type="submit">
                <Save className="size-4" />
                ذخیره وضعیت
              </Button>
            </form>
          </AdminSection>
        </div>
      </div>
    </div>
  );
}
