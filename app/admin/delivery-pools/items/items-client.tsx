"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Boxes, PackageOpen, Plus, Search } from "lucide-react";

import { formatDate, shortId } from "@/components/admin/admin-formatters";
import { DeliveryAdminNav } from "@/components/admin/delivery-admin-nav";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type {
  AdminDeliveryItem,
  AdminDeliveryPool,
  DeliveryItemStatus,
} from "@/types/api";

const ITEMS_PER_PAGE = 10;
type StatusFilter = DeliveryItemStatus | "ALL";

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات آیتم های تحویل انجام نشد.";
}

function splitItems(text: string) {
  return text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function DeliveryItemsClient() {
  const searchParams = useSearchParams();
  const initialPoolId = searchParams.get("pool") ?? "";
  const [pools, setPools] = useState<AdminDeliveryPool[]>([]);
  const [items, setItems] = useState<AdminDeliveryItem[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [itemsPage, setItemsPage] = useState(1);

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      const poolsResult = await api.admin.deliveryPools.list();
      const nextPoolId =
        initialPoolId && poolsResult.pools.some((pool) => pool.id === initialPoolId)
          ? initialPoolId
          : poolsResult.pools[0]?.id ?? "";
      const itemsResult = nextPoolId
        ? await api.admin.deliveryPools.items(nextPoolId)
        : { items: [] };

      if (!active) return;

      setPools(poolsResult.pools);
      setSelectedPoolId(nextPoolId);
      setItems(itemsResult.items);
      setError("");
    }

    loadInitialData()
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialPoolId]);

  async function loadPools() {
    const result = await api.admin.deliveryPools.list();
    setPools(result.pools);
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
    setQuery("");
    setStatusFilter("ALL");
    void loadItems(poolId);
  }

  async function addItems(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextItems = splitItems(itemsText);

    if (!selectedPoolId || !nextItems.length) {
      setError("حداقل یک آیتم برای استخر انتخاب شده وارد کنید.");
      setMessage("");
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

  const selectedPool = pools.find((pool) => pool.id === selectedPoolId) ?? null;
  const preparedItems = splitItems(itemsText);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesQuery = normalizedQuery
        ? item.content.toLowerCase().includes(normalizedQuery) ||
          item.id.toLowerCase().includes(normalizedQuery)
        : true;
      const matchesStatus =
        statusFilter === "ALL" ? true : item.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [items, query, statusFilter]);

  const availableCount = items.filter((item) => item.status === "AVAILABLE").length;
  const reservedCount = items.filter((item) => item.status === "RESERVED").length;
  const deliveredCount = items.filter((item) => item.status === "DELIVERED").length;
  const disabledCount = items.filter((item) => item.status === "DISABLED").length;
  const itemsTotalPages = Math.max(
    1,
    Math.ceil(filteredItems.length / ITEMS_PER_PAGE),
  );
  const paginatedItems = filteredItems.slice(
    (itemsPage - 1) * ITEMS_PER_PAGE,
    itemsPage * ITEMS_PER_PAGE,
  );

  return (
    <div className="space-y-6">
      <DeliveryAdminNav />

      {message ? <AdminState tone="success">{message}</AdminState> : null}
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">آماده</p>
          <p className="mt-2 text-2xl font-bold">{availableCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">رزرو شده</p>
          <p className="mt-2 text-2xl font-bold">{reservedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">تحویل شده</p>
          <p className="mt-2 text-2xl font-bold">{deliveredCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">غیرفعال</p>
          <p className="mt-2 text-2xl font-bold">{disabledCount}</p>
        </div>
      </div>

      <AdminSection
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/delivery-pools/new">
              <Plus className="size-4" />
              ایجاد استخر
            </Link>
          </Button>
        }
        description="استخر را انتخاب کنید و آیتم های آماده را خط به خط وارد کنید"
        title="افزودن آیتم تحویل"
      >
        {loading ? (
          <AdminState>در حال دریافت استخرها...</AdminState>
        ) : pools.length ? (
          <form className="grid gap-4 lg:grid-cols-[320px_1fr]" onSubmit={addItems}>
            <div className="space-y-4">
              <label className="block text-sm font-medium">
                استخر تحویل
                <Select
                  className="mt-2"
                  required
                  value={selectedPoolId}
                  onChange={(event) => selectPool(event.target.value)}
                >
                  <option value="">انتخاب استخر</option>
                  {pools.map((pool) => (
                    <option key={pool.id} value={pool.id}>
                      {pool.title}
                    </option>
                  ))}
                </Select>
              </label>
              {selectedPool ? (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <Boxes className="size-4" />
                    {selectedPool.title}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground" dir="ltr">
                    {selectedPool.slug}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">{selectedPool._count?.items ?? 0} آیتم</Badge>
                    <Badge variant="outline">
                      {selectedPool._count?.products ?? 0} محصول متصل
                    </Badge>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium">
                هر آیتم در یک خط
                <textarea
                  className="mt-2 min-h-44 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                  dir="ltr"
                  required
                  value={itemsText}
                  onChange={(event) => setItemsText(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <Button disabled={saving || !selectedPoolId} type="submit">
                  <Plus className="size-4" />
                  افزودن آیتم ها
                </Button>
                <Badge variant="secondary">{preparedItems.length} آیتم آماده افزودن</Badge>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            <AdminState>هنوز استخر تحویلی ثبت نشده است.</AdminState>
            <Button asChild>
              <Link href="/admin/delivery-pools/new">
                <Plus className="size-4" />
                ایجاد استخر تحویل
              </Link>
            </Button>
          </div>
        )}
      </AdminSection>

      <AdminSection
        description="آیتم های ثبت شده برای استخر انتخاب شده"
        title="لیست آیتم ها"
      >
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative block text-sm font-medium">
            <span className="sr-only">جستجو</span>
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pr-9"
              placeholder="جستجو در محتوا یا شناسه"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setItemsPage(1);
              }}
            />
          </label>
          <Select
            aria-label="فیلتر وضعیت آیتم"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setItemsPage(1);
            }}
          >
            <option value="ALL">همه وضعیت ها</option>
            <option value="AVAILABLE">آماده</option>
            <option value="RESERVED">رزرو شده</option>
            <option value="DELIVERED">تحویل شده</option>
            <option value="DISABLED">غیرفعال</option>
          </Select>
        </div>

        {itemsLoading ? (
          <AdminState>در حال دریافت آیتم ها...</AdminState>
        ) : filteredItems.length ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:hidden">
              {paginatedItems.map((item) => (
                <article
                  className="rounded-lg border border-border bg-background p-4"
                  key={item.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium" dir="ltr">
                      {shortId(item.id)}
                    </p>
                    <AdminStatusBadge type="delivery" value={item.status} />
                  </div>
                  <code className="mt-3 block max-h-36 overflow-auto whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-xs">
                    {item.content}
                  </code>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">ثبت {formatDate(item.createdAt)}</Badge>
                    <Badge variant="outline">تحویل {formatDate(item.deliveredAt)}</Badge>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden w-full max-w-full overflow-x-auto overscroll-x-contain md:block">
              <table className="w-full min-w-[900px] text-right text-sm">
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
                        <code className="block max-w-xl whitespace-pre-wrap rounded-md bg-muted px-2 py-1 text-xs">
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
            </div>

            <Pagination
              page={itemsPage}
              totalItems={filteredItems.length}
              totalPages={itemsTotalPages}
              onPageChange={setItemsPage}
            />
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-border p-6 text-center">
            <PackageOpen className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              برای این فیلتر یا استخر، آیتمی پیدا نشد.
            </p>
          </div>
        )}
      </AdminSection>
    </div>
  );
}