"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { formatDate, shortId } from "@/components/admin/admin-formatters";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type { AdminDeliveryItem, AdminDeliveryPool } from "@/types/api";

const ITEMS_PER_PAGE = 10;
const POOLS_PER_PAGE = 10;

type PoolForm = {
  slug: string;
  title: string;
  description: string;
};

const initialPoolForm: PoolForm = {
  description: "",
  slug: "",
  title: "",
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات موجودی تحویل انجام نشد.";
}

export default function AdminDeliveryPoolsPage() {
  const [pools, setPools] = useState<AdminDeliveryPool[]>([]);
  const [items, setItems] = useState<AdminDeliveryItem[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [poolForm, setPoolForm] = useState<PoolForm>(initialPoolForm);
  const [itemsText, setItemsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [itemsPage, setItemsPage] = useState(1);
  const [poolsPage, setPoolsPage] = useState(1);

  async function loadPools(nextSelectedId?: string) {
    const result = await api.admin.deliveryPools.list();
    setPools(result.pools);
    setSelectedPoolId((current) => {
      if (nextSelectedId) return nextSelectedId;
      if (current && result.pools.some((pool) => pool.id === current)) {
        return current;
      }
      return result.pools[0]?.id ?? "";
    });
  }

  async function loadItems(poolId: string) {
    if (!poolId) {
      setItems([]);
      return;
    }

    setItemsLoading(true);
    try {
      const result = await api.admin.deliveryPools.items(poolId);
      setItems(result.items);
      setError("");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setItemsLoading(false);
    }
  }

  function selectPool(poolId: string) {
    setSelectedPoolId(poolId);
    setItemsPage(1);
    void loadItems(poolId);
  }

  useEffect(() => {
    let active = true;

    api.admin.deliveryPools
      .list()
      .then((result) => {
        if (active) {
          setPools(result.pools);
          setSelectedPoolId(result.pools[0]?.id ?? "");
          void loadItems(result.pools[0]?.id ?? "");
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

  async function createPool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api.admin.deliveryPools.create({
        description: optionalText(poolForm.description),
        slug: poolForm.slug.trim(),
        title: poolForm.title.trim(),
      });
      setPoolForm(initialPoolForm);
      await loadPools(result.pool.id);
      setMessage("مخزن تحویل ایجاد شد.");
      setError("");
    } catch (createError) {
      setError(errorMessage(createError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function addItems(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextItems = itemsText
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!selectedPoolId || !nextItems.length) {
      setError("حداقل یک آیتم برای مخزن انتخاب‌شده وارد کنید.");
      return;
    }

    setSaving(true);
    try {
      await api.admin.deliveryPools.addItems(selectedPoolId, {
        items: nextItems,
      });
      setItemsText("");
      await Promise.all([loadPools(), loadItems(selectedPoolId)]);
      setItemsPage(1);
      setMessage("آیتم ها اضافه شدند.");
      setError("");
    } catch (addError) {
      setError(errorMessage(addError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  const poolsTotalPages = Math.max(1, Math.ceil(pools.length / POOLS_PER_PAGE));
  const paginatedPools = pools.slice(
    (poolsPage - 1) * POOLS_PER_PAGE,
    poolsPage * POOLS_PER_PAGE,
  );
  const itemsTotalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const paginatedItems = items.slice(
    (itemsPage - 1) * ITEMS_PER_PAGE,
    itemsPage * ITEMS_PER_PAGE,
  );

  return (
    <div className="space-y-6">
      {message ? <AdminState tone="success">{message}</AdminState> : null}
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <AdminSection title="مخزن تحویل جدید">
          <form className="space-y-4" onSubmit={createPool}>
            <label className="block text-sm font-medium">
              عنوان
              <Input
                className="mt-2"
                required
                value={poolForm.title}
                onChange={(event) =>
                  setPoolForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block text-sm font-medium">
              اسلاگ
              <Input
                className="mt-2"
                dir="ltr"
                pattern="[a-z0-9-]+"
                required
                value={poolForm.slug}
                onChange={(event) =>
                  setPoolForm((current) => ({
                    ...current,
                    slug: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block text-sm font-medium">
              توضیح
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={poolForm.description}
                onChange={(event) =>
                  setPoolForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <Button disabled={saving} type="submit">
              <Plus className="size-4" />
              ایجاد مخزن
            </Button>
          </form>
        </AdminSection>

        <AdminSection title="افزودن آیتم تحویل">
          <form className="space-y-4" onSubmit={addItems}>
            <label className="block text-sm font-medium">
              مخزن تحویل
              <Select
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                required
                value={selectedPoolId}
                onChange={(event) => selectPool(event.target.value)}
              >
                <option value="">انتخاب کنید</option>
                {pools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.title}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block text-sm font-medium">
              هر آیتم در یک خط
              <textarea
                className="mt-2 min-h-36 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                dir="ltr"
                required
                value={itemsText}
                onChange={(event) => setItemsText(event.target.value)}
              />
            </label>
            <Button disabled={saving || !selectedPoolId} type="submit">
              <Plus className="size-4" />
              افزودن آیتم ها
            </Button>
          </form>
        </AdminSection>
      </div>

      <AdminSection
        description="مخزن‌هایی که برای تحویل فوری محصولات استفاده می‌شوند."
        title="مخزن‌های تحویل"
      >
        {loading ? (
          <AdminState>در حال دریافت مخزن‌ها...</AdminState>
        ) : pools.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3 font-medium">شناسه</th>
                  <th className="py-3 font-medium">عنوان</th>
                  <th className="py-3 font-medium">اسلاگ</th>
                  <th className="py-3 font-medium">آیتم</th>
                  <th className="py-3 font-medium">محصول</th>
                  <th className="py-3 font-medium">ثبت</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPools.map((pool) => (
                  <tr key={pool.id} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium" dir="ltr">
                      {shortId(pool.id)}
                    </td>
                    <td className="py-3">{pool.title}</td>
                    <td className="py-3" dir="ltr">
                      {pool.slug}
                    </td>
                    <td className="py-3">{pool._count?.items ?? 0}</td>
                    <td className="py-3">{pool._count?.products ?? 0}</td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(pool.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={poolsPage}
              totalItems={pools.length}
              totalPages={poolsTotalPages}
              onPageChange={setPoolsPage}
            />
          </div>
        ) : (
          <AdminState>مخزنی ثبت نشده است.</AdminState>
        )}
      </AdminSection>

      <AdminSection
        description="محتواهای آماده‌ای که بعد از خرید به کاربر تحویل داده می‌شوند."
        title="آیتم‌های مخزن انتخاب‌شده"
      >
        {itemsLoading ? (
          <AdminState>در حال دریافت آیتم ها...</AdminState>
        ) : items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3 font-medium">شناسه</th>
                  <th className="py-3 font-medium">محتوا</th>
                  <th className="py-3 font-medium">وضعیت</th>
                  <th className="py-3 font-medium">تحویل</th>
                  <th className="py-3 font-medium">ثبت</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="py-3 font-medium" dir="ltr">
                      {shortId(item.id)}
                    </td>
                    <td className="py-3">
                      <code className="block max-w-lg whitespace-pre-wrap rounded-md bg-muted px-2 py-1 text-xs">
                        {item.content}
                      </code>
                    </td>
                    <td className="py-3">
                      <AdminStatusBadge type="delivery" value={item.status} />
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(item.deliveredAt)}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={itemsPage}
              totalItems={items.length}
              totalPages={itemsTotalPages}
              onPageChange={setItemsPage}
            />
          </div>
        ) : (
          <AdminState>برای این مخزن آیتمی ثبت نشده است.</AdminState>
        )}
      </AdminSection>
    </div>
  );
}
