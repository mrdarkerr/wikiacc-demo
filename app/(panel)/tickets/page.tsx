"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Eye, Search, SendHorizontal } from "lucide-react";

import { formatDate } from "@/components/panel/formatters";
import { PanelSection } from "@/components/panel/panel-section";
import { StatusBadge } from "@/components/panel/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type { ApiMeta, Ticket, TicketPriority } from "@/types/api";

const PER_PAGE = 8;

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("NORMAL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Ticket["status"]>(
    "ALL",
  );

  useEffect(() => {
    let active = true;

    async function loadTickets() {
      setLoading(true);
      try {
        const result = await api.tickets.listPage({
          page,
          perPage: PER_PAGE,
          search: search.trim() || undefined,
          status: statusFilter === "ALL" ? undefined : statusFilter,
        });
        if (active) {
          setTickets(result.data.tickets);
          setMeta(result.meta ?? null);
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
  }, [page, search, statusFilter]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const result = await api.tickets.create({ body, priority, subject });
      setTickets((current) => [result.ticket, ...current]);
      setPage(1);
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

  const totalPages = meta?.totalPages ?? 1;

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
            <Select
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={priority}
              onChange={(event) => setPriority(event.target.value as TicketPriority)}
            >
              <option value="LOW">کم</option>
              <option value="NORMAL">معمولی</option>
              <option value="HIGH">فوری</option>
            </Select>
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
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pr-9"
              placeholder="جست‌وجوی موضوع یا متن پیام"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <Select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as "ALL" | Ticket["status"]);
              setPage(1);
            }}
          >
            <option value="ALL">همه وضعیت‌ها</option>
            <option value="OPEN">باز</option>
            <option value="ANSWERED">پاسخ داده شده</option>
            <option value="CLOSED">بسته</option>
          </Select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">در حال دریافت تیکت ها...</p>
        ) : tickets.length ? (
          <>
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
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    آخرین بروزرسانی: {formatDate(ticket.updatedAt)}
                  </p>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/tickets/${ticket.id}`}>
                      <Eye className="size-4" />
                      مشاهده مکالمه
                    </Link>
                  </Button>
                </div>
              </article>
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">تیکتی با این فیلتر پیدا نشد.</p>
        )}
      </PanelSection>
    </div>
  );
}

function Pagination({
  onPageChange,
  page,
  totalPages,
}: {
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        صفحه {page} از {totalPages}
      </p>
      <div className="flex gap-2">
        <Button
          disabled={page <= 1}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
        >
          قبلی
        </Button>
        <Button
          disabled={page >= totalPages}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page + 1)}
        >
          بعدی
        </Button>
      </div>
    </div>
  );
}
