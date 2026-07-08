"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Boxes, PackageOpen, Plus, Search } from "lucide-react";

import { formatDate, shortId } from "@/components/admin/admin-formatters";
import { DeliveryAdminNav } from "@/components/admin/delivery-admin-nav";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { api, ApiError } from "@/lib/api";
import type { AdminDeliveryPool } from "@/types/api";

const POOLS_PER_PAGE = 10;

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات تحویل فوری انجام نشد.";
}

export default function AdminDeliveryPoolsPage() {
  const [pools, setPools] = useState<AdminDeliveryPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [poolsPage, setPoolsPage] = useState(1);

  useEffect(() => {
    let active = true;

    async function loadInitialPools() {
      const result = await api.admin.deliveryPools.list();

      if (!active) return;

      setPools(result.pools);
      setError("");
    }

    loadInitialPools()
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

  const filteredPools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return pools;

    return pools.filter((pool) =>
      [pool.title, pool.slug, pool.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [pools, query]);

  const poolsTotalPages = Math.max(
    1,
    Math.ceil(filteredPools.length / POOLS_PER_PAGE),
  );
  const paginatedPools = filteredPools.slice(
    (poolsPage - 1) * POOLS_PER_PAGE,
    poolsPage * POOLS_PER_PAGE,
  );
  const totalItems = pools.reduce((sum, pool) => sum + (pool._count?.items ?? 0), 0);
  const connectedProducts = pools.reduce(
    (sum, pool) => sum + (pool._count?.products ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <DeliveryAdminNav />

      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">استخرهای تحویل</p>
          <p className="mt-2 text-2xl font-bold">{pools.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">آیتم آماده/ثبت شده</p>
          <p className="mt-2 text-2xl font-bold">{totalItems}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">محصول متصل</p>
          <p className="mt-2 text-2xl font-bold">{connectedProducts}</p>
        </div>
      </div>

      <AdminSection
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/delivery-pools/items">
                <Boxes className="size-4" />
                مدیریت آیتم ها
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/delivery-pools/new">
                <Plus className="size-4" />
                ایجاد استخر
              </Link>
            </Button>
          </div>
        }
        description="استخرهایی که محصول تحویل فوری از موجودی آماده آن ها استفاده می کند"
        title="لیست استخرهای تحویل"
      >
        <label className="relative block max-w-md text-sm font-medium">
          <span className="sr-only">جستجو</span>
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pr-9"
            placeholder="جستجو با عنوان یا اسلاگ"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPoolsPage(1);
            }}
          />
        </label>

        {loading ? (
          <AdminState>در حال دریافت استخرهای تحویل...</AdminState>
        ) : filteredPools.length ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:hidden">
              {paginatedPools.map((pool) => (
                <article
                  className="rounded-lg border border-border bg-background p-4"
                  key={pool.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold">{pool.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                        {pool.slug}
                      </p>
                    </div>
                    <Badge variant="secondary">{shortId(pool.id)}</Badge>
                  </div>
                  {pool.description ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {pool.description}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">{pool._count?.items ?? 0} آیتم</Badge>
                    <Badge variant="outline">
                      {pool._count?.products ?? 0} محصول متصل
                    </Badge>
                    <Badge variant="outline">{formatDate(pool.createdAt)}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/delivery-pools/items?pool=${pool.id}`}>
                        <PackageOpen className="size-4" />
                        آیتم ها
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden w-full max-w-full overflow-x-auto overscroll-x-contain md:block">
              <table className="w-full min-w-[860px] text-right text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-3 font-medium">شناسه</th>
                    <th className="py-3 font-medium">عنوان</th>
                    <th className="py-3 font-medium">اسلاگ</th>
                    <th className="py-3 font-medium">آیتم</th>
                    <th className="py-3 font-medium">محصول</th>
                    <th className="py-3 font-medium">ثبت</th>
                    <th className="py-3 font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPools.map((pool) => (
                    <tr key={pool.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-medium" dir="ltr">
                        {shortId(pool.id)}
                      </td>
                      <td className="py-3 font-medium">{pool.title}</td>
                      <td className="py-3 text-muted-foreground" dir="ltr">
                        {pool.slug}
                      </td>
                      <td className="py-3">{pool._count?.items ?? 0}</td>
                      <td className="py-3">{pool._count?.products ?? 0}</td>
                      <td className="py-3 text-muted-foreground">
                        {formatDate(pool.createdAt)}
                      </td>
                      <td className="py-3">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/delivery-pools/items?pool=${pool.id}`}>
                            <PackageOpen className="size-4" />
                            آیتم ها
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={poolsPage}
              totalItems={filteredPools.length}
              totalPages={poolsTotalPages}
              onPageChange={setPoolsPage}
            />
          </div>
        ) : (
          <AdminState>استخر تحویلی با این جستجو پیدا نشد.</AdminState>
        )}
      </AdminSection>
    </div>
  );
}
