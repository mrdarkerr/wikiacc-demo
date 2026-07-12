"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";

import {
  formatCurrency,
  productTypeLabel,
  shortId,
} from "@/components/admin/admin-formatters";
import { ProductAdminNav } from "@/components/admin/product-admin-nav";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type { Product, ProductCategory, ProductType } from "@/types/api";

const PRODUCTS_PER_PAGE = 10;
type ProductTypeFilter = ProductType | "ALL";

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات محصولات انجام نشد.";
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [productsPage, setProductsPage] = useState(1);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProductTypeFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [archiveOpen, setArchiveOpen] = useState(false);

  async function loadData() {
    const [productsResult, categoriesResult] = await Promise.all([
      api.admin.products.list(),
      api.admin.categories.list(),
    ]);

    setProducts(productsResult.products);
    setCategories(categoriesResult.categories);
  }

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      const [productsResult, categoriesResult] = await Promise.all([
        api.admin.products.list(),
        api.admin.categories.list(),
      ]);

      if (!active) return;

      setProducts(productsResult.products);
      setCategories(categoriesResult.categories);
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
  }, []);

  async function toggleActive(product: Product) {
    setSaving(true);
    try {
      await api.admin.products.setActive(product.id, {
        isActive: !product.isActive,
      });
      await loadData();
      setMessage("وضعیت محصول به روز شد.");
      setError("");
    } catch (updateError) {
      setError(errorMessage(updateError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(product: Product) {
    const hasOrders = (product._count?.orderItems ?? 0) > 0;
    const confirmed = window.confirm(
      hasOrders
        ? `محصول «${product.title}» سابقه خرید دارد و حذف نمی‌شود. آن را آرشیو می‌کنید؟`
        : `محصول «${product.title}» برای همیشه حذف شود؟`,
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const result = await api.admin.products.remove(product.id);
      await loadData();
      setMessage(
        result.action === "ARCHIVED"
          ? "محصول به دلیل داشتن سابقه خرید آرشیو شد."
          : "محصول حذف شد.",
      );
      setError("");
    } catch (removeError) {
      setError(errorMessage(removeError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function restoreProduct(product: Product) {
    setSaving(true);
    try {
      await api.admin.products.setActive(product.id, { isActive: true });
      await loadData();
      setMessage("محصول از آرشیو خارج و فعال شد.");
      setError("");
    } catch (restoreError) {
      setError(errorMessage(restoreError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  const archivedProducts = useMemo(
    () => products.filter((product) => Boolean(product.archivedAt)),
    [products],
  );
  const currentProducts = useMemo(
    () => products.filter((product) => !product.archivedAt),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return currentProducts.filter((product) => {
      const matchesQuery = normalizedQuery
        ? [product.title, product.slug, product.category?.title]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(normalizedQuery))
        : true;
      const matchesType =
        typeFilter === "ALL" ? true : product.type === typeFilter;
      const matchesCategory =
        categoryFilter === "ALL"
          ? true
          : categoryFilter === "NONE"
            ? !product.category
            : product.category?.id === categoryFilter;

      return matchesQuery && matchesType && matchesCategory;
    });
  }, [categoryFilter, currentProducts, query, typeFilter]);

  const productsTotalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE),
  );
  const paginatedProducts = filteredProducts.slice(
    (productsPage - 1) * PRODUCTS_PER_PAGE,
    productsPage * PRODUCTS_PER_PAGE,
  );
  const activeCount = currentProducts.filter((product) => product.isActive).length;
  const customFormCount = currentProducts.filter(
    (product) => product.type === "CUSTOM_FORM",
  ).length;
  const instantDeliveryCount = currentProducts.filter(
    (product) => product.type === "INSTANT_DELIVERY",
  ).length;

  return (
    <div className="space-y-6">
      <ProductAdminNav />

      {message ? <AdminState tone="success">{message}</AdminState> : null}
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">محصولات فعال</p>
          <p className="mt-2 text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">فرم اختصاصی</p>
          <p className="mt-2 text-2xl font-bold">{customFormCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">تحویل فوری</p>
          <p className="mt-2 text-2xl font-bold">{instantDeliveryCount}</p>
        </div>
      </div>

      <AdminSection
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="button" variant="outline" onClick={() => setArchiveOpen(true)}>
              <Archive className="size-4" />
              آرشیو محصولات ({archivedProducts.length})
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/products/categories">
                <Tags className="size-4" />
                دسته بندی ها
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/products/new">
                <Plus className="size-4" />
                ایجاد محصول
              </Link>
            </Button>
          </div>
        }
        description="جستجو، فیلتر و مدیریت وضعیت محصولات فروشگاه"
        title="لیست محصولات"
      >
        <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
          <label className="relative block text-sm font-medium">
            <span className="sr-only">جستجو</span>
            <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pr-9"
              placeholder="جستجو با عنوان، اسلاگ یا دسته بندی"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setProductsPage(1);
              }}
            />
          </label>
          <Select
            aria-label="فیلتر نوع محصول"
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as ProductTypeFilter);
              setProductsPage(1);
            }}
          >
            <option value="ALL">همه نوع ها</option>
            <option value="CUSTOM_FORM">فرم اختصاصی</option>
            <option value="INSTANT_DELIVERY">تحویل فوری</option>
          </Select>
          <Select
            aria-label="فیلتر دسته بندی"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setProductsPage(1);
            }}
          >
            <option value="ALL">همه دسته بندی ها</option>
            <option value="NONE">بدون دسته بندی</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.title}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <AdminState>در حال دریافت محصولات...</AdminState>
        ) : filteredProducts.length ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:hidden">
              {paginatedProducts.map((product) => (
                <article
                  className="rounded-lg border border-border bg-background p-4"
                  key={product.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold">{product.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                        {product.slug}
                      </p>
                    </div>
                    <AdminStatusBadge type="boolean" value={product.isActive} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="secondary">{productTypeLabel(product.type)}</Badge>
                    <Badge variant="outline">
                      {product.category?.title ?? "بدون دسته بندی"}
                    </Badge>
                    <Badge variant="outline">{product.fields.length} فیلد</Badge>
                    <Badge variant="outline">
                      {product._count?.orderItems ?? 0} خرید
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm font-semibold">
                    {formatCurrency(product.price)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/products/new?edit=${product.id}`}>
                        <Pencil className="size-4" />
                        ویرایش
                      </Link>
                    </Button>
                    <Button
                      disabled={saving}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => toggleActive(product)}
                    >
                      <Power className="size-4" />
                      {product.isActive ? "غیرفعال" : "فعال"}
                    </Button>
                    <Button
                      disabled={saving}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => removeProduct(product)}
                    >
                      {(product._count?.orderItems ?? 0) > 0 ? (
                        <Archive className="size-4" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      {(product._count?.orderItems ?? 0) > 0
                        ? "آرشیو"
                        : "حذف"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden w-full max-w-full overflow-x-auto overscroll-x-contain md:block">
              <table className="w-full min-w-[900px] text-right text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-3 font-medium">شناسه</th>
                    <th className="py-3 font-medium">عنوان</th>
                    <th className="py-3 font-medium">اسلاگ</th>
                    <th className="py-3 font-medium">نوع</th>
                    <th className="py-3 font-medium">قیمت</th>
                    <th className="py-3 font-medium">دسته</th>
                    <th className="py-3 font-medium">فیلد</th>
                    <th className="py-3 font-medium">وضعیت</th>
                    <th className="py-3 font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="py-3 font-medium" dir="ltr">
                        {shortId(product.id)}
                      </td>
                      <td className="py-3 font-medium">{product.title}</td>
                      <td className="py-3 text-muted-foreground" dir="ltr">
                        {product.slug}
                      </td>
                      <td className="py-3">{productTypeLabel(product.type)}</td>
                      <td className="py-3">{formatCurrency(product.price)}</td>
                      <td className="py-3">{product.category?.title ?? "-"}</td>
                      <td className="py-3">{product.fields.length}</td>
                      <td className="py-3">
                        <AdminStatusBadge type="boolean" value={product.isActive} />
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/products/new?edit=${product.id}`}>
                              <Pencil className="size-4" />
                              ویرایش
                            </Link>
                          </Button>
                          <Button
                            disabled={saving}
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => toggleActive(product)}
                          >
                            <Power className="size-4" />
                            {product.isActive ? "غیرفعال" : "فعال"}
                          </Button>
                          <Button
                            disabled={saving}
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => removeProduct(product)}
                          >
                            {(product._count?.orderItems ?? 0) > 0 ? (
                              <Archive className="size-4" />
                            ) : (
                              <Trash2 className="size-4" />
                            )}
                            {(product._count?.orderItems ?? 0) > 0
                              ? "آرشیو"
                              : "حذف"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={productsPage}
              totalItems={filteredProducts.length}
              totalPages={productsTotalPages}
              onPageChange={setProductsPage}
            />
          </div>
        ) : (
          <AdminState>محصولی با این فیلترها پیدا نشد.</AdminState>
        )}
      </AdminSection>

      {archiveOpen ? (
        <DialogOverlay
          ariaLabel="محصولات آرشیوشده"
          contentClassName="max-w-3xl"
          onClose={() => setArchiveOpen(false)}
        >
          <section
            className="max-h-[calc(100dvh-2rem)] overflow-hidden rounded-lg border border-border bg-card shadow-xl"
            dir="rtl"
          >
            <header className="flex items-center justify-between gap-4 border-b border-border p-4 sm:p-5">
              <div>
                <h2 className="text-lg font-bold">محصولات آرشیوشده</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  این محصولات در فروشگاه نمایش داده نمی‌شوند و سابقه خریدشان محفوظ است.
                </p>
              </div>
              <Button
                aria-label="بستن"
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => setArchiveOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </header>
            <div className="max-h-[calc(100dvh-9rem)] overflow-y-auto p-4 sm:p-5">
              {archivedProducts.length ? (
                <div className="space-y-3">
                  {archivedProducts.map((product) => (
                    <article
                      className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
                      key={product.id}
                    >
                      <div className="min-w-0">
                        <h3 className="font-bold">{product.title}</h3>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{productTypeLabel(product.type)}</Badge>
                          <Badge variant="outline">
                            {product._count?.orderItems ?? 0} خرید
                          </Badge>
                          <Badge variant="outline">
                            {product.category?.title ?? "بدون دسته بندی"}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        className="shrink-0"
                        disabled={saving}
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => restoreProduct(product)}
                      >
                        <RotateCcw className="size-4" />
                        بازگردانی و فعال‌سازی
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <AdminState>محصول آرشیوشده‌ای وجود ندارد.</AdminState>
              )}
            </div>
          </section>
        </DialogOverlay>
      ) : null}
    </div>
  );
}


