"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Plus,
  Save,
  Trash2,
  X,
  Zap,
} from "lucide-react";

import { productTypeLabel } from "@/components/admin/admin-formatters";
import { ProductAdminNav } from "@/components/admin/product-admin-nav";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  AdminDeliveryPool,
  FieldType,
  Product,
  ProductCategory,
  ProductField,
  ProductType,
} from "@/types/api";

const fieldTypes: FieldType[] = ["TEXT", "EMAIL", "PHONE", "TEXTAREA", "SELECT"];

const fieldTypeLabels: Record<FieldType, string> = {
  EMAIL: "ایمیل",
  PHONE: "موبایل",
  SELECT: "انتخاب از گزینه ها",
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

type FieldDraft = {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  optionDraft: string;
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

function createDraftId() {
  return `field-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseOptions(optionsJson?: string | null) {
  if (!optionsJson) return [];

  try {
    const parsed = JSON.parse(optionsJson) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map((option) => String(option).trim())
        .filter(Boolean);
    }
  } catch {
    // Old values may have been saved as plain text.
  }

  return optionsJson
    .split(/\r?\n|,|،/)
    .map((option) => option.trim())
    .filter(Boolean);
}

function createFieldDraft(field?: ProductField): FieldDraft {
  return {
    id: field?.id ?? createDraftId(),
    key: field?.key ?? "",
    label: field?.label ?? "",
    optionDraft: "",
    options: parseOptions(field?.optionsJson),
    required: field?.required ?? false,
    type: field?.type ?? "TEXT",
  };
}

function normalizedFieldKey(key: string, index: number, usedKeys: Set<string>) {
  const rawKey = key.trim() || `field_${index + 1}`;
  const safeKey = rawKey.replace(/[^A-Za-z0-9_]/g, "_") || `field_${index + 1}`;
  let nextKey = safeKey;
  let suffix = 2;

  while (usedKeys.has(nextKey)) {
    nextKey = `${safeKey}_${suffix}`;
    suffix += 1;
  }

  usedKeys.add(nextKey);
  return nextKey;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "عملیات محصول انجام نشد.";
}

export function AdminProductFormClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editProductId = searchParams.get("edit") ?? "";
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [pools, setPools] = useState<AdminDeliveryPool[]>([]);
  const [productForm, setProductForm] =
    useState<ProductForm>(initialProductForm);
  const [fieldDrafts, setFieldDrafts] = useState<FieldDraft[]>([
    createFieldDraft(),
  ]);
  const [editingProductId, setEditingProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");


  function resetForm() {
    setProductForm(initialProductForm);
    setFieldDrafts([createFieldDraft()]);
    setEditingProductId("");
  }

  function populateProduct(product: Product) {
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
  }

  useEffect(() => {
    let active = true;

    async function loadData() {
      const [productsResult, categoriesResult, poolsResult] = await Promise.all([
        api.admin.products.list(),
        api.admin.categories.list(),
        api.admin.deliveryPools.list(),
      ]);

      if (!active) return;

      setCategories(categoriesResult.categories);
      setPools(poolsResult.pools);

      if (editProductId) {
        const product = productsResult.products.find(
          (currentProduct) => currentProduct.id === editProductId,
        );

        if (product) {
          populateProduct(product);
          setError("");
        } else {
          resetForm();
          setError("محصول مورد نظر پیدا نشد.");
        }
      } else {
        resetForm();
        setError("");
      }
    }

    loadData()
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [editProductId]);

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

  function addFieldOption(id: string) {
    setFieldDrafts((current) =>
      current.map((fieldDraft) => {
        if (fieldDraft.id !== id) return fieldDraft;

        const option = fieldDraft.optionDraft.trim();
        if (!option || fieldDraft.options.includes(option)) {
          return { ...fieldDraft, optionDraft: "" };
        }

        return {
          ...fieldDraft,
          optionDraft: "",
          options: [...fieldDraft.options, option],
        };
      }),
    );
  }

  function removeFieldOption(id: string, option: string) {
    setFieldDrafts((current) =>
      current.map((fieldDraft) =>
        fieldDraft.id === id
          ? {
              ...fieldDraft,
              options: fieldDraft.options.filter(
                (currentOption) => currentOption !== option,
              ),
            }
          : fieldDraft,
      ),
    );
  }

  function handleOptionKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    fieldId: string,
  ) {
    if (event.key !== "Enter") return;

    event.preventDefault();
    addFieldOption(fieldId);
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const visibleFieldDrafts = fieldDrafts.filter((fieldDraft) =>
      fieldDraft.label.trim(),
    );
    const invalidSelectField = visibleFieldDrafts.find(
      (fieldDraft) => fieldDraft.type === "SELECT" && !fieldDraft.options.length,
    );

    if (productForm.type === "CUSTOM_FORM" && invalidSelectField) {
      setSaving(false);
      setError(`برای فیلد «${invalidSelectField.label}» حداقل یک گزینه وارد کنید.`);
      setMessage("");
      return;
    }

    const deliveryPoolId =
      productForm.type === "INSTANT_DELIVERY"
        ? optionalText(productForm.deliveryPoolId)
        : undefined;

    if (productForm.type === "INSTANT_DELIVERY" && !deliveryPoolId) {
      setSaving(false);
      setError("برای محصول تحویل فوری، استخر تحویل را انتخاب کنید.");
      setMessage("");
      return;
    }

    const usedKeys = new Set<string>();
    const fields =
      productForm.type === "CUSTOM_FORM"
        ? visibleFieldDrafts.map((fieldDraft, index) => ({
            key: normalizedFieldKey(fieldDraft.key, index, usedKeys),
            label: fieldDraft.label.trim(),
            optionsJson:
              fieldDraft.type === "SELECT" && fieldDraft.options.length
                ? JSON.stringify(fieldDraft.options)
                : undefined,
            required: fieldDraft.required,
            sortOrder: index,
            type: fieldDraft.type,
          }))
        : [];

    try {
      const body = {
        categoryId: optionalText(productForm.categoryId),
        deliveryPoolId,
        description: optionalText(productForm.description),
        fields,
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

      setMessage(editingProductId ? "محصول به روز شد." : "محصول ایجاد شد.");
      setError("");
      router.push("/admin/products");
      router.refresh();
    } catch (saveError) {
      setError(errorMessage(saveError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }

  const isInstantDelivery = productForm.type === "INSTANT_DELIVERY";

  return (
    <div className="space-y-6">
      <ProductAdminNav />

      {message ? <AdminState tone="success">{message}</AdminState> : null}
      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <form className="space-y-6" onSubmit={saveProduct}>
        <AdminSection
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/products">
                <ArrowRight className="size-4" />
                بازگشت به لیست
              </Link>
            </Button>
          }
          description={
            editingProductId
              ? "ویرایش مشخصات، قیمت و فیلدهای محصول"
              : "ثبت محصول جدید برای نمایش در فروشگاه"
          }
          title={editingProductId ? "ویرایش محصول" : "ایجاد محصول"}
        >
          {loading ? (
            <AdminState>در حال دریافت اطلاعات محصول...</AdminState>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
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
                <Select
                  className="mt-2"
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
                </Select>
              </label>
              <label className="block text-sm font-medium">
                ترتیب نمایش
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
                محصول فعال باشد
              </label>
              <label className="block text-sm font-medium lg:col-span-2">
                توضیح
                <textarea
                  className="mt-2 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
                  value={productForm.description}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          )}
        </AdminSection>

        <AdminSection title="نوع محصول">
          <div className="grid gap-3 md:grid-cols-2">
            {(["CUSTOM_FORM", "INSTANT_DELIVERY"] as ProductType[]).map(
              (type) => {
                const active = productForm.type === type;
                const Icon = type === "CUSTOM_FORM" ? FileText : Zap;

                return (
                  <button
                    className={cn(
                      "flex min-h-24 items-start gap-3 rounded-lg border border-border bg-background p-4 text-right transition hover:border-primary/60",
                      active && "border-primary bg-primary/5 ring-1 ring-primary/20",
                    )}
                    key={type}
                    type="button"
                    onClick={() =>
                      setProductForm((current) => ({
                        ...current,
                        deliveryPoolId: type === "CUSTOM_FORM" ? "" : current.deliveryPoolId,
                        type,
                      }))
                    }
                  >
                    <span
                      className={cn(
                        "mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
                        active && "bg-primary text-primary-foreground",
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-bold">
                        {productTypeLabel(type)}
                        {active ? <CheckCircle2 className="size-4 text-primary" /> : null}
                      </span>
                      <span className="mt-2 block text-sm text-muted-foreground">
                        {type === "CUSTOM_FORM"
                          ? "دریافت اطلاعات سفارش با فیلدهای قابل تنظیم"
                          : "تحویل خودکار محتوای آماده بعد از خرید"}
                      </span>
                    </span>
                  </button>
                );
              },
            )}
          </div>
          {isInstantDelivery ? (
            pools.length ? (
              <div className="mt-4 rounded-lg border border-border bg-background p-4">
                <label className="block text-sm font-medium">
                  استخر تحویل
                  <Select
                    className="mt-2"
                    required
                    value={productForm.deliveryPoolId}
                    onChange={(event) =>
                      setProductForm((current) => ({
                        ...current,
                        deliveryPoolId: event.target.value,
                      }))
                    }
                  >
                    <option value="">انتخاب استخر تحویل</option>
                    {pools.map((pool) => (
                      <option key={pool.id} value={pool.id}>
                        {pool.title}
                      </option>
                    ))}
                  </Select>
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                  موجودی آماده این استخر بعد از پرداخت به سفارش تحویل داده می شود.
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                برای ثبت محصول تحویل فوری، ابتدا در بخش تحویل فوری یک استخر تحویل بسازید.
              </div>
            )
          ) : null}
        </AdminSection>

        {!isInstantDelivery ? (
          <AdminSection
            action={
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() =>
                  setFieldDrafts((current) => [...current, createFieldDraft()])
                }
              >
                <Plus className="size-4" />
                افزودن فیلد
              </Button>
            }
            description="فیلدهایی که کاربر هنگام ثبت سفارش تکمیل می کند"
            title="فیلدهای فرم سفارش"
          >
            <div className="space-y-4">
              {fieldDrafts.map((fieldDraft, index) => (
                <div
                  className="rounded-lg border border-border bg-background p-4"
                  key={fieldDraft.id}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-bold">فیلد {index + 1}</p>
                    <Button
                      size="sm"
                      type="button"
                      variant="ghost"
                      onClick={() => removeFieldDraft(fieldDraft.id)}
                    >
                      <Trash2 className="size-4" />
                      حذف
                    </Button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[1fr_240px_160px]">
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
                      <Select
                        className="mt-2"
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
                      </Select>
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
                      اجباری باشد
                    </label>
                  </div>

                  {fieldDraft.type === "SELECT" ? (
                    <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
                      <label className="block text-sm font-medium">
                        گزینه های انتخابی
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={fieldDraft.optionDraft}
                            onChange={(event) =>
                              updateFieldDraft(fieldDraft.id, {
                                optionDraft: event.target.value,
                              })
                            }
                            onKeyDown={(event) =>
                              handleOptionKeyDown(event, fieldDraft.id)
                            }
                          />
                          <Button
                            className="sm:w-auto"
                            type="button"
                            variant="outline"
                            onClick={() => addFieldOption(fieldDraft.id)}
                          >
                            <Plus className="size-4" />
                            افزودن گزینه
                          </Button>
                        </div>
                      </label>
                      {fieldDraft.options.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {fieldDraft.options.map((option) => (
                            <span
                              className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2 text-sm"
                              key={option}
                            >
                              {option}
                              <button
                                className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                type="button"
                                onClick={() =>
                                  removeFieldOption(fieldDraft.id, option)
                                }
                              >
                                <X className="size-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">
                          هنوز گزینه ای ثبت نشده است.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </AdminSection>
        ) : null}

        <div className="sticky bottom-20 z-20 flex flex-col gap-2 rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur sm:bottom-4 sm:flex-row sm:justify-end lg:bottom-4">
          <Button asChild type="button" variant="outline">
            <Link href="/admin/products">انصراف</Link>
          </Button>
          <Button disabled={saving || loading} type="submit">
            <Save className="size-4" />
            {editingProductId ? "ذخیره تغییرات" : "ایجاد محصول"}
          </Button>
        </div>
      </form>
    </div>
  );
}
