"use client";

import { FormEvent, useEffect, useState } from "react";
import { SendHorizontal } from "lucide-react";

import { formatDate } from "@/components/panel/formatters";
import { PanelSection } from "@/components/panel/panel-section";
import { StatusBadge } from "@/components/panel/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { Ticket, TicketPriority } from "@/types/api";

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("NORMAL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTickets() {
      try {
        const result = await api.tickets.list();
        if (active) {
          setTickets(result.tickets);
        }
      } catch (error) {
        if (active) {
          setMessage(
            error instanceof ApiError ? error.message : "دریافت تیکت ها انجام نشد.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadTickets();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const result = await api.tickets.create({ body, priority, subject });
      setTickets((current) => [result.ticket, ...current]);
      setSubject("");
      setBody("");
      setPriority("NORMAL");
      setMessage("تیکت ثبت شد.");
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "ثبت تیکت انجام نشد.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <PanelSection
        description="ثبت درخواست جدید برای پشتیبانی"
        title="تیکت جدید"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm font-medium">
            <span>موضوع</span>
            <Input
              className="h-11"
              required
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </label>

          <label className="block space-y-2 text-sm font-medium">
            <span>اولویت</span>
            <select
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={priority}
              onChange={(event) => setPriority(event.target.value as TicketPriority)}
            >
              <option value="LOW">کم</option>
              <option value="NORMAL">معمولی</option>
              <option value="HIGH">فوری</option>
            </select>
          </label>

          <label className="block space-y-2 text-sm font-medium">
            <span>پیام</span>
            <textarea
              className="min-h-32 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              required
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

          <Button className="w-full" disabled={submitting} type="submit">
            <SendHorizontal className="size-4" />
            {submitting ? "در حال ارسال..." : "ارسال تیکت"}
          </Button>
        </form>
      </PanelSection>

      <PanelSection
        description="آخرین مکالمات و پاسخ های پشتیبانی"
        title="تیکت ها"
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">در حال دریافت تیکت ها...</p>
        ) : tickets.length ? (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <article
                key={ticket.id}
                className="rounded-md border border-border p-4 text-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-bold leading-6">{ticket.subject}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ticket.orderId ? `سفارش: ${ticket.orderId}` : "عمومی"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge type="priority" value={ticket.priority} />
                    <StatusBadge type="ticket" value={ticket.status} />
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  آخرین بروزرسانی: {formatDate(ticket.updatedAt)}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">تیکتی ثبت نشده است.</p>
        )}
      </PanelSection>
    </div>
  );
}
