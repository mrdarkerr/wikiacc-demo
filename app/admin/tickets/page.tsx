"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";

import {
  formatDate,
  orderCode,
  shortId,
  userLabel,
} from "@/components/admin/admin-formatters";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { AdminTicket, TicketPriority, TicketStatus } from "@/types/api";

const ticketStatuses: TicketStatus[] = ["OPEN", "ANSWERED", "CLOSED"];
const ticketPriorities: TicketPriority[] = ["LOW", "NORMAL", "HIGH"];

const ticketStatusLabels: Record<TicketStatus, string> = {
  ANSWERED: "پاسخ داده شده",
  CLOSED: "بسته",
  OPEN: "باز",
};

const priorityLabels: Record<TicketPriority, string> = {
  HIGH: "فوری",
  LOW: "کم",
  NORMAL: "معمولی",
};

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات تیکت انجام نشد.";
}

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TicketStatus>("ALL");
  const [priorityFilter, setPriorityFilter] =
    useState<"ALL" | TicketPriority>("ALL");

  useEffect(() => {
    let active = true;

    api.admin.tickets
      .list()
      .then((result) => {
        if (active) {
          setTickets(result.tickets);
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

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === "ALL" ? true : ticket.status === statusFilter;
      const matchesPriority =
        priorityFilter === "ALL" ? true : ticket.priority === priorityFilter;
      const searchableText = [
        ticket.id,
        shortId(ticket.id),
        ticket.subject,
        userLabel(ticket.user),
        ticket.order ? orderCode(ticket.order.id) : "",
        ...ticket.messages.map((message) => message.body),
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesPriority &&
        searchableText.includes(normalizedSearch)
      );
    });
  }, [priorityFilter, search, statusFilter, tickets]);

  const metrics = useMemo(
    () => [
      {
        label: "باز",
        value: tickets.filter((ticket) => ticket.status === "OPEN").length,
      },
      {
        label: "پاسخ داده شده",
        value: tickets.filter((ticket) => ticket.status === "ANSWERED").length,
      },
      {
        label: "فوری",
        value: tickets.filter((ticket) => ticket.priority === "HIGH").length,
      },
    ],
    [tickets],
  );

  return (
    <div className="space-y-6">
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
            key={metric.label}
          >
            <p className="text-sm text-muted-foreground">تیکت {metric.label}</p>
            <p className="mt-2 text-2xl font-bold">{metric.value}</p>
          </div>
        ))}
      </div>

      <AdminSection title="تیکت‌ها" description="لیست مکالمات پشتیبانی و وضعیت رسیدگی">
        <div className="mb-4 grid gap-3 xl:grid-cols-[1fr_180px_180px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pr-9"
              placeholder="جست‌وجوی موضوع، کاربر، سفارش یا متن پیام"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "ALL" | TicketStatus)
            }
          >
            <option value="ALL">همه وضعیت‌ها</option>
            {ticketStatuses.map((status) => (
              <option key={status} value={status}>
                {ticketStatusLabels[status]}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-md border border-input bg-background px-3 text-sm"
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(event.target.value as "ALL" | TicketPriority)
            }
          >
            <option value="ALL">همه اولویت‌ها</option>
            {ticketPriorities.map((priority) => (
              <option key={priority} value={priority}>
                {priorityLabels[priority]}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <AdminState>در حال دریافت تیکت‌ها...</AdminState>
        ) : filteredTickets.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3 font-medium">شناسه</th>
                  <th className="py-3 font-medium">موضوع</th>
                  <th className="py-3 font-medium">کاربر</th>
                  <th className="py-3 font-medium">سفارش</th>
                  <th className="py-3 font-medium">اولویت</th>
                  <th className="py-3 font-medium">وضعیت</th>
                  <th className="py-3 font-medium">به‌روزرسانی</th>
                  <th className="py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="border-b border-border last:border-0 hover:bg-muted/40"
                  >
                    <td className="py-3 font-medium" dir="ltr">
                      {shortId(ticket.id)}
                    </td>
                    <td className="py-3 font-medium">{ticket.subject}</td>
                    <td className="py-3">{userLabel(ticket.user)}</td>
                    <td className="py-3" dir="ltr">
                      {ticket.order ? orderCode(ticket.order.id) : "-"}
                    </td>
                    <td className="py-3">
                      <AdminStatusBadge type="priority" value={ticket.priority} />
                    </td>
                    <td className="py-3">
                      <AdminStatusBadge type="ticket" value={ticket.status} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(ticket.updatedAt)}
                    </td>
                    <td className="py-3">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/tickets/${ticket.id}`}>
                          <Eye className="size-4" />
                          جزئیات
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminState>تیکتی با این فیلتر پیدا نشد.</AdminState>
        )}
      </AdminSection>
    </div>
  );
}
