"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import {
  formatCurrency,
  productTypeLabel,
  shortId,
} from "@/components/admin/admin-formatters";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import type {
  AdminDeliveryPool,
  FieldType,
  Product,
  ProductField,
  ProductCategory,
  ProductType,
} from "@/types/api";

const fieldTypes: FieldType[] = ["TEXT", "EMAIL", "PHONE", "TEXTAREA", "SELECT"];

const fieldTypeLabels: Record<FieldType, string> = {
  EMAIL: "ایمیل",
  PHONE: "موبایل",
  SELECT: "انتخابی",
  TEXT: "متن کوتاه",
  TEXTAREA: "متن بلند",
};

type ProductForm = {
  slug: string;
  title: string;
  description: string;
  type: ProductType;
  price: string;
  categoryId: string;
  deliveryPoolId: string;
  isActive: boolean;
  sortOrder: string;
};

type CategoryForm = {
  slug: string;
  title: string;
  description: string;
};

type FieldDraft = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  optionsText: string;
};

const initialProductForm: ProductForm = {
  categoryId: "",
  deliveryPoolId: "",
  description: "",
  isActive: true,
  price: "",
  slug: "",
  sortOrder: "0",
  title: "",
  type: "CUSTOM_FORM",
};

const initialCategoryForm: CategoryForm = {
  description: "",
  slug: "",
  title: "",
};

function createFieldDraft(field?: ProductField): FieldDraft {
  return {
    id: field?.id ?? `field-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    key: field?.key ?? "",
    label: field?.label ?? "",
    optionsText: field?.optionsJson ?? "",
    required: field?.required ?? false,
    type: field?.type ?? "TEXT",
  };
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات محصولات انجام نشد.";
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [pools, setPools] = useState<AdminDeliveryPool[]>([]);
  const [productForm, setProductForm] =
    useState<ProductForm>(initialProductForm);
  const [fieldDrafts, setFieldDrafts] = useState<FieldDraft[]>([
    createFieldDraft(),
  ]);
  const [categoryForm, setCategoryForm] =
    useState<CategoryForm>(initialCategoryForm);
  const [editingProductId, setEditingProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadData() {
    const [productsResult, categoriesResult, poolsResult] = await Promise.all([
      api.admin.products.list(),
      api.admin.categories.list(),
      api.admin.deliveryPools.list(),
    ]);

    setProducts(productsResult.products);
    setCategories(categoriesResult.categories);
    setPools(poolsResult.pools);
  }

  useEffect(() => {
    let active = true;

    Promise.all([
      api.admin.products.list(),
      api.admin.categories.list(),
      api.admin.deliveryPools.list(),
    ])
      .then(([productsResult, categoriesResult, poolsResult]) => {
        if (active) {
          setProducts(productsResult.products);
          setCategories(categoriesResult.categories);
          setPools(poolsResult.pools);
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

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.admin.categories.create({
        description: optionalText(categoryForm.description),
        isActive: true,
        slug: categoryForm.slug.trim(),
        title: categoryForm.title.trim(),
      });
      setCategoryForm(initialCategoryForm);
      await loadData();
      setMessage("دسته بندی ایجاد شد.");
      setError("");
    } catch (createError) {
      setError(errorMessage(createError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const field =
      productForm.type === "CUSTOM_FORM"
        ? fieldDrafts
            .filter((fieldDraft) => fieldDraft.key.trim() && fieldDraft.label.trim())
            .map((fieldDraft, index) => ({
              key: fieldDraft.key.trim(),
              label: fieldDraft.label.trim(),
              optionsJson: optionalText(fieldDraft.optionsText),
              required: fieldDraft.required,
              sortOrder: index,
              type: fieldDraft.type,
            }))
        : [];

    try {
      const body = {
        categoryId: optionalText(productForm.categoryId),
        deliveryPoolId:
          productForm.type === "INSTANT_DELIVERY"
            ? optionalText(productForm.deliveryPoolId)
            : undefined,
        description: optionalText(productForm.description),
        fields: field,
        isActive: productForm.isActive,
        price: Number(productForm.price),
        slug: productForm.slug.trim(),
        sortOrder: Number(productForm.sortOrder || 0),
        title: productForm.title.trim(),
        type: productForm.type,
      };

      if (editingProductId) {
        await api.admin.products.update(editingProductId, body);
      } else {
        await api.admin.products.create(body);
      }

      setProductForm(initialProductForm);
      setFieldDrafts([createFieldDraft()]);
      setEditingProductId("");
      await loadData();
      setMessage(editingProductId ? "محصول به روز شد." : "محصول ایجاد شد.");
      setError("");
    } catch (createError) {
      setError(errorMessage(createError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  function updateFieldDraft(id: string, patch: Partial<FieldDraft>) {
    setFieldDrafts((current) =>
      current.map((fieldDraft) =>
        fieldDraft.id === id ? { ...fieldDraft, ...patch } : fieldDraft,
      ),
    );
  }

  function removeFieldDraft(id: string) {
    setFieldDrafts((current) =>
      current.length > 1
        ? current.filter((fieldDraft) => fieldDraft.id !== id)
        : [createFieldDraft()],
    );
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id);
    setProductForm({
      categoryId: product.category?.id ?? "",
      deliveryPoolId: product.deliveryPool?.id ?? "",
      description: product.description ?? "",
      isActive: product.isActive,
      price: String(product.price),
      slug: product.slug,
      sortOrder: String(product.sortOrder),
      title: product.title,
      type: product.type,
    });
    setFieldDrafts(
      product.fields.length
        ? product.fields.map(createFieldDraft)
        : [createFieldDraft()],
    );
    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  function resetProductForm() {
    setProductForm(initialProductForm);
    setFieldDrafts([createFieldDraft()]);
    setEditingProductId("");
  }

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

  return (
    <div className="space-y-6">
      {message ? <AdminState tone="success">{message}</AdminState> : null}
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <div className="grid gap-6 xl:grid-cols-[0.7fr_1.3fr]">
        <AdminSection title="دسته بندی جدید">
          <form className="space-y-4" onSubmit={createCategory}>
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
              توضیح
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>
            <Button disabled={saving} type="submit">
              <Plus className="size-4" />
              ایجاد دسته بندی
            </Button>
          </form>
        </AdminSection>

        <AdminSection title={editingProductId ? "ویرایش محصول" : "محصول جدید"}>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveProduct}>
            <label className="block text-sm font-medium">
              عنوان
              <Input
                className="mt-2"
                required
                value={productForm.title}
                onChange={(event) =>
                  setProductForm((current) => ({
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
                value={productForm.slug}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    slug: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block text-sm font-medium">
              نوع
              <select
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={productForm.type}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    deliveryPoolId: "",
                    type: event.target.value as ProductType,
                  }))
                }
              >
                <option value="CUSTOM_FORM">فرم اختصاصی</option>
                <option value="INSTANT_DELIVERY">تحویل فوری</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              قیمت
              <Input
                className="mt-2"
                min={0}
                required
                type="number"
                value={productForm.price}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    price: event.target.value,
                  }))
                }
              />
            </label>
            <label className="block text-sm font-medium">
              دسته بندی
              <select
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={productForm.categoryId}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    categoryId: event.target.value,
                  }))
                }
              >
                <option value="">بدون دسته بندی</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              مخزن تحویل فوری
              <select
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={productForm.type !== "INSTANT_DELIVERY"}
                required={productForm.type === "INSTANT_DELIVERY"}
                value={productForm.deliveryPoolId}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    deliveryPoolId: event.target.value,
                  }))
                }
              >
                <option value="">انتخاب نشده</option>
                {pools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium">
              ترتیب
              <Input
                className="mt-2"
                type="number"
                value={productForm.sortOrder}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    sortOrder: event.target.value,
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2 pt-8 text-sm font-medium">
              <input
                checked={productForm.isActive}
                className="size-4"
                type="checkbox"
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
              />
              فعال باشد
            </label>
            <label className="block text-sm font-medium md:col-span-2">
              توضیح
              <textarea
                className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={productForm.description}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </label>

            {productForm.type === "CUSTOM_FORM" ? (
              <div className="space-y-4 rounded-md border border-border p-4 md:col-span-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-medium">فیلدهای فرم سفارش</p>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setFieldDrafts((current) => [
                        ...current,
                        createFieldDraft(),
                      ])
                    }
                  >
                    <Plus className="size-4" />
                    افزودن فیلد
                  </Button>
                </div>

                {fieldDrafts.map((fieldDraft, index) => (
                  <div
                    className="grid gap-4 rounded-md bg-muted/40 p-3 md:grid-cols-2"
                    key={fieldDraft.id}
                  >
                    <p className="text-xs font-medium text-muted-foreground md:col-span-2">
                      فیلد {index + 1}
                    </p>
                    <label className="block text-sm font-medium">
                      کلید
                      <Input
                        className="mt-2"
                        dir="ltr"
                        pattern="[A-Za-z0-9_]+"
                        value={fieldDraft.key}
                        onChange={(event) =>
                          updateFieldDraft(fieldDraft.id, {
                            key: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      عنوان قابل نمایش
                      <Input
                        className="mt-2"
                        value={fieldDraft.label}
                        onChange={(event) =>
                          updateFieldDraft(fieldDraft.id, {
                            label: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      نوع فیلد
                      <select
                        className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={fieldDraft.type}
                        onChange={(event) =>
                          updateFieldDraft(fieldDraft.id, {
                            type: event.target.value as FieldType,
                          })
                        }
                      >
                        {fieldTypes.map((type) => (
                          <option key={type} value={type}>
                            {fieldTypeLabels[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 pt-8 text-sm font-medium">
                      <input
                        checked={fieldDraft.required}
                        className="size-4"
                        type="checkbox"
                        onChange={(event) =>
                          updateFieldDraft(fieldDraft.id, {
                            required: event.target.checked,
                          })
                        }
                      />
                      اجباری
                    </label>
                    <label className="block text-sm font-medium md:col-span-2">
                      گزینه‌های انتخابی
                      <Input
                        className="mt-2"
                        dir="ltr"
                        placeholder='["گزینه ۱","گزینه ۲"]'
                        value={fieldDraft.optionsText}
                        onChange={(event) =>
                          updateFieldDraft(fieldDraft.id, {
                            optionsText: event.target.value,
                          })
                        }
                      />
                    </label>
                    <div className="md:col-span-2">
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => removeFieldDraft(fieldDraft.id)}
                      >
                        حذف فیلد
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button disabled={saving} type="submit">
                <Plus className="size-4" />
                {editingProductId ? "ذخیره تغییرات" : "ایجاد محصول"}
              </Button>
              {editingProductId ? (
                <Button
                  disabled={saving}
                  type="button"
                  variant="outline"
                  onClick={resetProductForm}
                >
                  لغو ویرایش
                </Button>
              ) : null}
            </div>
          </form>
        </AdminSection>
      </div>

      <AdminSection
        description="مدیریت قیمت، وضعیت، فرم سفارش و اتصال به موجودی تحویل فوری"
        title="محصولات"
      >
        {loading ? (
          <AdminState>در حال دریافت محصولات...</AdminState>
        ) : products.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-right text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-3 font-medium">شناسه</th>
                  <th className="py-3 font-medium">عنوان</th>
                  <th className="py-3 font-medium">اسلاگ</th>
                  <th className="py-3 font-medium">نوع</th>
                  <th className="py-3 font-medium">قیمت</th>
                  <th className="py-3 font-medium">دسته</th>
                  <th className="py-3 font-medium">مخزن تحویل</th>
                  <th className="py-3 font-medium">وضعیت</th>
                  <th className="py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="py-3 font-medium" dir="ltr">
                      {shortId(product.id)}
                    </td>
                    <td className="py-3">{product.title}</td>
                    <td className="py-3" dir="ltr">
                      {product.slug}
                    </td>
                    <td className="py-3">{productTypeLabel(product.type)}</td>
                    <td className="py-3">{formatCurrency(product.price)}</td>
                    <td className="py-3">{product.category?.title ?? "-"}</td>
                    <td className="py-3">{product.deliveryPool?.title ?? "-"}</td>
                    <td className="py-3">
                      <AdminStatusBadge type="boolean" value={product.isActive} />
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={saving}
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => startEditProduct(product)}
                        >
                          ویرایش
                        </Button>
                        <Button
                          disabled={saving}
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => toggleActive(product)}
                        >
                          {product.isActive ? "غیرفعال" : "فعال"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminState>محصولی ثبت نشده است.</AdminState>
        )}
      </AdminSection>
    </div>
  );
}
