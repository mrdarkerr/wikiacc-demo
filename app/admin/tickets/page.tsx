"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Send } from "lucide-react";

import {
  formatDate,
  orderCode,
  shortId,
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

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadTickets(nextSelectedId?: string) {
    const result = await api.admin.tickets.list();
    setTickets(result.tickets);
    setSelectedTicketId((current) => {
      if (nextSelectedId) return nextSelectedId;
      if (current && result.tickets.some((ticket) => ticket.id === current)) {
        return current;
      }
      return result.tickets[0]?.id ?? "";
    });
  }

  useEffect(() => {
    let active = true;

    api.admin.tickets
      .list()
      .then((result) => {
        if (active) {
          setTickets(result.tickets);
          setSelectedTicketId(result.tickets[0]?.id ?? "");
          setError("");
        }
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
  }, []);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId),
    [selectedTicketId, tickets],
  );

  async function updateStatus(ticketId: string, status: TicketStatus) {
    setSaving(true);
    try {
      await api.admin.tickets.updateStatus(ticketId, { status });
      await loadTickets(ticketId);
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

    if (!selectedTicketId) {
      setError("ابتدا تیکت را انتخاب کنید.");
      return;
    }

    setSaving(true);
    try {
      await api.admin.tickets.addMessage(selectedTicketId, {
        body: replyBody.trim(),
      });
      setReplyBody("");
      await loadTickets(selectedTicketId);
      setMessage("پاسخ ارسال شد.");
      setError("");
    } catch (replyError) {
      setError(errorMessage(replyError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? <AdminState tone="success">{message}</AdminState> : null}
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <AdminSection
          description="لیست از GET /api/v1/admin/tickets خوانده می شود."
          title="تیکت ها"
        >
          {loading ? (
            <AdminState>در حال دریافت تیکت ها...</AdminState>
          ) : tickets.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-right text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-3 font-medium">شناسه</th>
                    <th className="py-3 font-medium">موضوع</th>
                    <th className="py-3 font-medium">کاربر</th>
                    <th className="py-3 font-medium">اولویت</th>
                    <th className="py-3 font-medium">وضعیت</th>
                    <th className="py-3 font-medium">به روزرسانی</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <td className="py-3 font-medium" dir="ltr">
                        {shortId(ticket.id)}
                      </td>
                      <td className="py-3">{ticket.subject}</td>
                      <td className="py-3">{userLabel(ticket.user)}</td>
                      <td className="py-3">
                        <AdminStatusBadge
                          type="priority"
                          value={ticket.priority}
                        />
                      </td>
                      <td className="py-3">
                        <AdminStatusBadge type="ticket" value={ticket.status} />
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(ticket.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AdminState>تیکتی ثبت نشده است.</AdminState>
          )}
        </AdminSection>

        <AdminSection title="جزئیات و پاسخ">
          {selectedTicket ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{selectedTicket.subject}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {userLabel(selectedTicket.user)}
                      {selectedTicket.order
                        ? ` - ${orderCode(selectedTicket.order.id)}`
                        : ""}
                    </p>
                  </div>
                  <AdminStatusBadge
                    type="ticket"
                    value={selectedTicket.status}
                  />
                </div>
                <label className="mt-4 block text-sm font-medium">
                  وضعیت
                  <select
                    className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    disabled={saving}
                    value={selectedTicket.status}
                    onChange={(event) =>
                      updateStatus(
                        selectedTicket.id,
                        event.target.value as TicketStatus,
                      )
                    }
                  >
                    {ticketStatuses.map((status) => (
                      <option key={status} value={status}>
                        {ticketStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-md border border-border p-3">
                {selectedTicket.messages.map((ticketMessage) => (
                  <article
                    key={ticketMessage.id}
                    className={`rounded-md p-3 text-sm ${
                      ticketMessage.isAdmin
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs opacity-80">
                      <span>
                        {ticketMessage.isAdmin
                          ? "ادمین"
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

              <form className="space-y-3" onSubmit={sendReply}>
                <label className="block text-sm font-medium">
                  پاسخ
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
          ) : (
            <AdminState>تیکتی انتخاب نشده است.</AdminState>
          )}
        </AdminSection>
      </div>
    </div>
  );
}
