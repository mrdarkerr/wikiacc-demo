"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Power, RotateCcw, Search, Save } from "lucide-react";

import { shortId } from "@/components/admin/admin-formatters";
import { ProductAdminNav } from "@/components/admin/product-admin-nav";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { api, ApiError } from "@/lib/api";
import type { ProductCategory } from "@/types/api";

const CATEGORIES_PER_PAGE = 10;

type CategoryForm = {
  slug: string;
  title: string;
  description: string;
  isActive: boolean;
  sortOrder: string;
};

const initialCategoryForm: CategoryForm = {
  description: "",
  isActive: true,
  slug: "",
  sortOrder: "0",
  title: "",
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات دسته بندی انجام نشد.";
}

export default function AdminProductCategoriesPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [categoryForm, setCategoryForm] =
    useState<CategoryForm>(initialCategoryForm);
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [categoriesPage, setCategoriesPage] = useState(1);

  async function loadCategories() {
    const result = await api.admin.categories.list();
    setCategories(result.categories);
  }

  useEffect(() => {
    let active = true;

    async function loadInitialCategories() {
      const result = await api.admin.categories.list();

      if (!active) return;

      setCategories(result.categories);
      setError("");
    }

    loadInitialCategories()
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

  function startEditCategory(category: ProductCategory) {
    setEditingCategoryId(category.id);
    setCategoryForm({
      description: category.description ?? "",
      isActive: category.isActive,
      slug: category.slug,
      sortOrder: String(category.sortOrder),
      title: category.title,
    });
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  function resetCategoryForm() {
    setCategoryForm(initialCategoryForm);
    setEditingCategoryId("");
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const body = {
      description: optionalText(categoryForm.description),
      isActive: categoryForm.isActive,
      slug: categoryForm.slug.trim(),
      sortOrder: Number(categoryForm.sortOrder || 0),
      title: categoryForm.title.trim(),
    };

    try {
      if (editingCategoryId) {
        await api.admin.categories.update(editingCategoryId, body);
      } else {
        await api.admin.categories.create(body);
      }

      resetCategoryForm();
      await loadCategories();
      setMessage(
        editingCategoryId ? "دسته بندی به روز شد." : "دسته بندی ایجاد شد.",
      );
      setError("");
    } catch (saveError) {
      setError(errorMessage(saveError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCategory(category: ProductCategory) {
    setSaving(true);
    try {
      await api.admin.categories.update(category.id, {
        isActive: !category.isActive,
      });
      await loadCategories();
      setMessage("وضعیت دسته بندی به روز شد.");
      setError("");
    } catch (updateError) {
      setError(errorMessage(updateError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  const filteredCategories = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return categories;

    return categories.filter((category) =>
      [category.title, category.slug, category.description]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [categories, query]);

  const categoriesTotalPages = Math.max(
    1,
    Math.ceil(filteredCategories.length / CATEGORIES_PER_PAGE),
  );
  const paginatedCategories = filteredCategories.slice(
    (categoriesPage - 1) * CATEGORIES_PER_PAGE,
    categoriesPage * CATEGORIES_PER_PAGE,
  );
  const activeCount = categories.filter((category) => category.isActive).length;
  const inactiveCount = categories.length - activeCount;

  return (
    <div className="space-y-6">
      <ProductAdminNav />

      {message ? <AdminState tone="success">{message}</AdminState> : null}
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">همه دسته ها</p>
          <p className="mt-2 text-2xl font-bold">{categories.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">فعال</p>
          <p className="mt-2 text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">غیرفعال</p>
          <p className="mt-2 text-2xl font-bold">{inactiveCount}</p>
        </div>
      </div>

      <AdminSection
        description="ایجاد و ویرایش دسته بندی محصولات فروشگاه"
        title={editingCategoryId ? "ویرایش دسته بندی" : "دسته بندی جدید"}
      >
        <form className="grid gap-4 lg:grid-cols-2" onSubmit={saveCategory}>
          <label className="block text-sm font-medium">
            عنوان
            <Input
              className="mt-2"
              required
              value={categoryForm.title}
              onChange={(event) =>
                setCategoryForm((current) => ({
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
              value={categoryForm.slug}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  slug: event.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm font-medium">
            ترتیب نمایش
            <Input
              className="mt-2"
              type="number"
              value={categoryForm.sortOrder}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  sortOrder: event.target.value,
                }))
              }
            />
          </label>
          <label className="flex items-center gap-2 pt-8 text-sm font-medium">
            <input
              checked={categoryForm.isActive}
              className="size-4"
              type="checkbox"
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
            />
            دسته بندی فعال باشد
          </label>
          <label className="block text-sm font-medium lg:col-span-2">
            توضیح
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              value={categoryForm.description}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <div className="flex flex-wrap gap-2 lg:col-span-2">
            <Button disabled={saving} type="submit">
              {editingCategoryId ? <Save className="size-4" /> : <Plus className="size-4" />}
              {editingCategoryId ? "ذخیره تغییرات" : "ایجاد دسته بندی"}
            </Button>
            {editingCategoryId ? (
              <Button
                disabled={saving}
                type="button"
                variant="outline"
                onClick={resetCategoryForm}
              >
                <RotateCcw className="size-4" />
                لغو ویرایش
              </Button>
            ) : null}
          </div>
        </form>
      </AdminSection>

      <AdminSection
        description="لیست دسته بندی ها مستقل از فرم ایجاد محصول مدیریت می شود"
        title="لیست دسته بندی ها"
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
              setCategoriesPage(1);
            }}
          />
        </label>

        {loading ? (
          <AdminState>در حال دریافت دسته بندی ها...</AdminState>
        ) : filteredCategories.length ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 md:hidden">
              {paginatedCategories.map((category) => (
                <article
                  className="rounded-lg border border-border bg-background p-4"
                  key={category.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold">{category.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                        {category.slug}
                      </p>
                    </div>
                    <AdminStatusBadge type="boolean" value={category.isActive} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline">ترتیب {category.sortOrder}</Badge>
                    <Badge variant="secondary">{shortId(category.id)}</Badge>
                  </div>
                  {category.description ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {category.description}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => startEditCategory(category)}
                    >
                      <Pencil className="size-4" />
                      ویرایش
                    </Button>
                    <Button
                      disabled={saving}
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => toggleCategory(category)}
                    >
                      <Power className="size-4" />
                      {category.isActive ? "غیرفعال" : "فعال"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden w-full max-w-full overflow-x-auto overscroll-x-contain md:block">
              <table className="w-full min-w-[760px] text-right text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-3 font-medium">شناسه</th>
                    <th className="py-3 font-medium">عنوان</th>
                    <th className="py-3 font-medium">اسلاگ</th>
                    <th className="py-3 font-medium">ترتیب</th>
                    <th className="py-3 font-medium">وضعیت</th>
                    <th className="py-3 font-medium">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCategories.map((category) => (
                    <tr
                      className="border-b border-border last:border-0"
                      key={category.id}
                    >
                      <td className="py-3 font-medium" dir="ltr">
                        {shortId(category.id)}
                      </td>
                      <td className="py-3 font-medium">{category.title}</td>
                      <td className="py-3 text-muted-foreground" dir="ltr">
                        {category.slug}
                      </td>
                      <td className="py-3">{category.sortOrder}</td>
                      <td className="py-3">
                        <AdminStatusBadge type="boolean" value={category.isActive} />
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => startEditCategory(category)}
                          >
                            <Pencil className="size-4" />
                            ویرایش
                          </Button>
                          <Button
                            disabled={saving}
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => toggleCategory(category)}
                          >
                            <Power className="size-4" />
                            {category.isActive ? "غیرفعال" : "فعال"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={categoriesPage}
              totalItems={filteredCategories.length}
              totalPages={categoriesTotalPages}
              onPageChange={setCategoriesPage}
            />
          </div>
        ) : (
          <AdminState>دسته بندی با این جستجو پیدا نشد.</AdminState>
        )}
      </AdminSection>
    </div>
  );
}

