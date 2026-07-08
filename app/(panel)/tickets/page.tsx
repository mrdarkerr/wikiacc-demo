"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Eye, Plus, Search, SendHorizontal, X } from "lucide-react";

import { formatDate } from "@/components/panel/formatters";
import { PanelSection } from "@/components/panel/panel-section";
import { StatusBadge } from "@/components/panel/status-badge";
import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog";
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
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
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
          setNotice(
            error instanceof ApiError ? error.message : "دریافت تیکت‌ها انجام نشد.",
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
    setFormError("");
    setNotice("");

    try {
      const result = await api.tickets.create({
        body: body.trim(),
        priority,
        subject: subject.trim(),
      });
      setTickets((current) => [result.ticket, ...current]);
      setPage(1);
      setSearch("");
      setStatusFilter("ALL");
      setSubject("");
      setBody("");
      setPriority("NORMAL");
      setCreateOpen(false);
      setNotice("تیکت جدید ثبت شد.");
    } catch (error) {
      setFormError(
        error instanceof ApiError ? error.message : "ثبت تیکت انجام نشد.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PanelSection
        action={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            تیکت جدید
          </Button>
        }
        description="آخرین مکالمات، پاسخ‌های پشتیبانی و وضعیت پیگیری‌ها"
        title="تیکت‌ها"
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

        {notice ? (
          <p className="mb-4 rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            {notice}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">در حال دریافت تیکت‌ها...</p>
        ) : tickets.length ? (
          <>
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <article
                  key={ticket.id}
                  className="rounded-md border border-border bg-background/60 p-4 text-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
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
          <p className="text-sm text-muted-foreground">
            تیکتی با این فیلتر پیدا نشد.
          </p>
        )}
      </PanelSection>

      {createOpen ? (
        <DialogOverlay
          contentClassName="max-h-[calc(100svh-2rem)] max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-4 text-card-foreground shadow-lg sm:p-6"
          onClose={() => {
            if (!submitting) setCreateOpen(false);
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">درخواست پشتیبانی</p>
              <h3 className="mt-1 text-xl font-bold">تیکت جدید</h3>
            </div>
            <Button
              aria-label="بستن"
              disabled={submitting}
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
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
                onChange={(event) =>
                  setPriority(event.target.value as TicketPriority)
                }
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

            {formError ? (
              <p className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
                {formError}
              </p>
            ) : null}

            <Button className="w-full" disabled={submitting} type="submit">
              <SendHorizontal className="size-4" />
              {submitting ? "در حال ارسال..." : "ارسال تیکت"}
            </Button>
          </form>
        </DialogOverlay>
      ) : null}
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
