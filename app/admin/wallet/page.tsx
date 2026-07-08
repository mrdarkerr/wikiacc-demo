"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { WalletCards } from "lucide-react";

import {
  formatCurrency,
  formatDate,
  shortId,
} from "@/components/admin/admin-formatters";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type { AdminUser } from "@/types/api";

type WalletForm = {
  amount: string;
  mode: "credit" | "debit";
  note: string;
  userId: string;
};

const initialForm: WalletForm = {
  amount: "",
  mode: "credit",
  note: "",
  userId: "",
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات کیف پول انجام نشد.";
}

export default function AdminWalletPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [form, setForm] = useState<WalletForm>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadUsers(nextUserId?: string) {
    const result = await api.admin.users.list();
    setUsers(result.users);
    setForm((current) => ({
      ...current,
      userId:
        nextUserId ||
        current.userId ||
        new URLSearchParams(window.location.search).get("userId") ||
        result.users[0]?.id ||
        "",
    }));
  }

  useEffect(() => {
    let active = true;

    api.admin.users
      .list()
      .then((result) => {
        if (!active) return;
        const queryUserId = new URLSearchParams(window.location.search).get(
          "userId",
        );
        setUsers(result.users);
        setForm((current) => ({
          ...current,
          userId: queryUserId || result.users[0]?.id || "",
        }));
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
  }, []);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === form.userId),
    [form.userId, users],
  );

  async function adjustWallet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.userId) {
      setError("ابتدا کاربر را انتخاب کنید.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        amount: Number(form.amount),
        note: optionalText(form.note),
      };

      if (form.mode === "credit") {
        await api.admin.wallet.credit(form.userId, body);
      } else {
        await api.admin.wallet.debit(form.userId, body);
      }

      await loadUsers(form.userId);
      setForm((current) => ({ ...current, amount: "", note: "" }));
      setMessage("کیف پول به روز شد.");
      setError("");
    } catch (adjustError) {
      setError(errorMessage(adjustError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {message ? <AdminState tone="success">{message}</AdminState> : null}
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <AdminSection title="شارژ کیف پول">
          <form className="space-y-4" onSubmit={adjustWallet}>
            <label className="block text-sm font-medium">
              کاربر
              <select
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                required
                value={form.userId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    userId: event.target.value,
                  }))
                }
              >
                <option value="">انتخاب کنید</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              نوع عملیات
              <select
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.mode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    mode: event.target.value as WalletForm["mode"],
                  }))
                }
              >
                <option value="credit">افزایش موجودی</option>
                <option value="debit">کاهش موجودی</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              مبلغ
              <Input
                className="mt-2"
                min={1}
                required
                type="number"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block text-sm font-medium">
              توضیح
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.note}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
              />
            </label>
            <Button disabled={saving || loading} type="submit">
              <WalletCards className="size-4" />
              ثبت عملیات
            </Button>
          </form>
        </AdminSection>

        <AdminSection title="کاربر انتخاب شده">
          {selectedUser ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">نام</p>
                <p className="mt-2 font-medium">{selectedUser.name}</p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">ایمیل</p>
                <p className="mt-2 font-medium" dir="ltr">
                  {selectedUser.email}
                </p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">موجودی</p>
                <p className="mt-2 text-lg font-bold">
                  {formatCurrency(selectedUser.wallet?.balance ?? 0)}
                </p>
              </div>
              <div className="rounded-md border border-border p-4">
                <p className="text-sm text-muted-foreground">نقش</p>
                <div className="mt-2">
                  <AdminStatusBadge type="role" value={selectedUser.role} />
                </div>
              </div>
            </div>
          ) : (
            <AdminState>کاربری انتخاب نشده است.</AdminState>
          )}
        </AdminSection>
      </div>

      <AdminSection
        description="شارژ و برداشت از POST /api/v1/admin/wallet/users/:userId/credit|debit انجام می شود."
        title="موجودی کاربران"
      >
        {loading ? (
          <AdminState>در حال دریافت کاربران...</AdminState>
        ) : users.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3 font-medium">شناسه</th>
                  <th className="py-3 font-medium">نام</th>
                  <th className="py-3 font-medium">ایمیل</th>
                  <th className="py-3 font-medium">موجودی</th>
                  <th className="py-3 font-medium">نقش</th>
                  <th className="py-3 font-medium">ثبت نام</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-3 font-medium" dir="ltr">
                      {shortId(user.id)}
                    </td>
                    <td className="py-3">{user.name}</td>
                    <td className="py-3" dir="ltr">
                      {user.email}
                    </td>
                    <td className="py-3">{formatCurrency(user.wallet?.balance ?? 0)}</td>
                    <td className="py-3">
                      <AdminStatusBadge type="role" value={user.role} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminState>کاربری ثبت نشده است.</AdminState>
        )}
      </AdminSection>
    </div>
  );
}
