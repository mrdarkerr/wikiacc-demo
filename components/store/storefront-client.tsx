"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Package,
  ShoppingCart,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Order, Product, ProductField } from "@/types/api";

type FieldValues = Record<string, string>;

const productTypeLabels: Record<Product["type"], string> = {
  CUSTOM_FORM: "فرم اختصاصی",
  INSTANT_DELIVERY: "تحویل فوری",
};

function formatCurrency(amount: number) {
  return `${new Intl.NumberFormat("fa-IR").format(amount)} تومان`;
}

function orderCode(order: Order) {
  return `WKA-${order.id.slice(-6).toUpperCase()}`;
}

function deliveryMessages(order: Order) {
  return order.items
    .flatMap((item) => item.deliveries)
    .map((delivery) => delivery.contentSnapshot);
}

function fieldInputType(type: ProductField["type"]) {
  if (type === "EMAIL") {
    return "email";
  }

  if (type === "PHONE") {
    return "tel";
  }

  return "text";
}

function optionLabel(option: unknown) {
  if (typeof option === "string" || typeof option === "number") {
    return String(option);
  }

  if (option && typeof option === "object") {
    const record = option as Record<string, unknown>;
    if (typeof record.label === "string") {
      return record.label;
    }

    if (typeof record.value === "string" || typeof record.value === "number") {
      return String(record.value);
    }
  }

  return "";
}

function fieldOptions(optionsJson?: string | null) {
  if (!optionsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(optionsJson) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(optionLabel).filter(Boolean);
    }
  } catch {
    return optionsJson
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function apiErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "ثبت سفارش انجام نشد.";
  }

  const code = error.payload?.error?.code;

  if (error.status === 401) {
    return "برای ثبت سفارش ابتدا وارد حساب کاربری شوید.";
  }

  if (code === "INSUFFICIENT_WALLET_BALANCE") {
    return "موجودی کیف پول برای این خرید کافی نیست.";
  }

  if (code === "OUT_OF_STOCK") {
    return "موجودی تحویل فوری این محصول تمام شده است.";
  }

  if (code === "PRODUCT_NOT_FOUND") {
    return "این محصول دیگر فعال نیست.";
  }

  return error.message;
}

export function StorefrontClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [fieldValues, setFieldValues] = useState<FieldValues>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    api.catalog
      .products()
      .then((result) => {
        if (!active) {
          return;
        }

        setProducts(result.products);
        setSelectedProductId((current) => current || result.products[0]?.id || "");
      })
      .catch(() => {
        if (active) {
          setLoadError("دریافت محصولات انجام نشد.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const orderDeliveries = useMemo(
    () => (createdOrder ? deliveryMessages(createdOrder) : []),
    [createdOrder],
  );

  const totalAmount = selectedProduct ? selectedProduct.price * quantity : 0;

  function selectProduct(product: Product) {
    setSelectedProductId(product.id);
    setFieldValues({});
    setQuantity(1);
    setNote("");
    setCreatedOrder(null);
    setSubmitError("");
  }

  function updateFieldValue(key: string, value: string) {
    setFieldValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProduct) {
      return;
    }

    const normalizedQuantity = Math.min(10, Math.max(1, quantity || 1));
    const values =
      selectedProduct.type === "CUSTOM_FORM"
        ? Object.fromEntries(
            selectedProduct.fields.map((field) => [
              field.key,
              fieldValues[field.key]?.trim() ?? "",
            ]),
          )
        : undefined;

    const missingRequired = selectedProduct.fields.filter(
      (field) => field.required && !values?.[field.key],
    );

    if (selectedProduct.type === "CUSTOM_FORM" && missingRequired.length > 0) {
      setSubmitError("فیلدهای ضروری را تکمیل کنید.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setCreatedOrder(null);

    try {
      const result = await api.orders.create({
        productId: selectedProduct.id,
        quantity: normalizedQuantity,
        ...(values ? { fieldValues: values } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      });

      setCreatedOrder(result.order);
    } catch (error) {
      setSubmitError(apiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/30 text-foreground" dir="rtl">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link className="inline-flex items-center gap-3" href="/">
            <Image
              alt="ویکی اکانت"
              className="size-9 rounded-md object-contain"
              height={36}
              src="/wiki-high-resolution-logo-transparent.png"
              width={36}
            />
            <span className="font-bold">ویکی اکانت</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/orders">
                <ClipboardList className="size-4" />
                سفارش‌ها
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">ورود</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">فروشگاه</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              محصول را انتخاب کنید و سفارش را با موجودی کیف پول ثبت کنید.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/wallet">
              <WalletCards className="size-4" />
              کیف پول
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <section className="space-y-4">
            {loading ? (
              <Card className="flex min-h-48 items-center justify-center p-6 text-sm text-muted-foreground">
                <Loader2 className="ms-2 size-4 animate-spin" />
                در حال دریافت محصولات...
              </Card>
            ) : loadError ? (
              <Card className="flex items-center gap-2 border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                <AlertCircle className="size-4" />
                {loadError}
              </Card>
            ) : products.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    selected={product.id === selectedProductId}
                    onSelect={() => selectProduct(product)}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-5 text-sm text-muted-foreground">
                محصول فعالی برای نمایش وجود ندارد.
              </Card>
            )}
          </section>

          <Card className="lg:sticky lg:top-6">
            <form className="space-y-5 p-5" onSubmit={handleSubmit}>
              <div>
                <h2 className="text-base font-bold">ثبت سفارش</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedProduct
                    ? selectedProduct.title
                    : "ابتدا یک محصول انتخاب کنید."}
                </p>
              </div>

              {selectedProduct ? (
                <>
                  <div className="rounded-md border border-border bg-muted/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-muted-foreground">مبلغ واحد</span>
                      <span className="font-medium">
                        {formatCurrency(selectedProduct.price)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <label className="text-sm text-muted-foreground" htmlFor="quantity">
                        تعداد
                      </label>
                      <Input
                        className="h-9 w-24 text-center"
                        id="quantity"
                        max={10}
                        min={1}
                        type="number"
                        value={quantity}
                        onChange={(event) =>
                          setQuantity(Number.parseInt(event.target.value, 10) || 1)
                        }
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                      <span className="text-sm text-muted-foreground">جمع کل</span>
                      <span className="text-lg font-bold">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>
                  </div>

                  {selectedProduct.type === "CUSTOM_FORM" ? (
                    <div className="space-y-4">
                      {selectedProduct.fields.map((field) => (
                        <ProductFieldInput
                          key={field.id}
                          field={field}
                          value={fieldValues[field.key] ?? ""}
                          onChange={(value) => updateFieldValue(field.key, value)}
                        />
                      ))}
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="note">
                      توضیحات
                    </label>
                    <textarea
                      className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      id="note"
                      maxLength={1000}
                      placeholder="اختیاری"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                    />
                  </div>

                  {submitError ? (
                    <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  ) : null}

                  {createdOrder ? (
                    <OrderResult order={createdOrder} deliveries={orderDeliveries} />
                  ) : null}

                  <Button className="w-full" disabled={submitting} type="submit">
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ShoppingCart className="size-4" />
                    )}
                    ثبت و پرداخت از کیف پول
                  </Button>
                </>
              ) : (
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  بعد از دریافت محصولات، فرم سفارش اینجا نمایش داده می‌شود.
                </div>
              )}
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}

function ProductCard({
  product,
  selected,
  onSelect,
}: {
  product: Product;
  selected: boolean;
  onSelect: () => void;
}) {
  const availableItems = product.deliveryPool?._count?.items;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors",
        selected && "border-primary bg-primary/5",
      )}
    >
      <button
        aria-pressed={selected}
        className="block h-full w-full p-5 text-right"
        type="button"
        onClick={onSelect}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold">{product.title}</h2>
              <Badge variant={selected ? "default" : "secondary"}>
                {productTypeLabels[product.type]}
              </Badge>
            </div>
            {product.description ? (
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                {product.description}
              </p>
            ) : null}
          </div>
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted">
            <Package className="size-5 text-muted-foreground" />
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">قیمت</p>
            <p className="mt-1 text-lg font-bold">{formatCurrency(product.price)}</p>
          </div>
          <div className="text-left text-xs text-muted-foreground">
            {product.category?.title ? <p>{product.category.title}</p> : null}
            {product.type === "INSTANT_DELIVERY" &&
            typeof availableItems === "number" ? (
              <p className="mt-1">{availableItems} آماده تحویل</p>
            ) : null}
          </div>
        </div>
      </button>
    </Card>
  );
}

function ProductFieldInput({
  field,
  value,
  onChange,
}: {
  field: ProductField;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = fieldOptions(field.optionsJson);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={field.key}>
        {field.label}
        {field.required ? <span className="text-rose-500"> *</span> : null}
      </label>

      {field.type === "TEXTAREA" ? (
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id={field.key}
          maxLength={5000}
          required={field.required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : field.type === "SELECT" ? (
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id={field.key}
          required={field.required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">انتخاب کنید</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={field.key}
          maxLength={5000}
          required={field.required}
          type={fieldInputType(field.type)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function OrderResult({
  order,
  deliveries,
}: {
  order: Order;
  deliveries: string[];
}) {
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">
            سفارش {orderCode(order)} ثبت و پرداخت شد.
          </p>
          {deliveries.length ? (
            <div className="mt-3 space-y-2">
              {deliveries.map((delivery, index) => (
                <code
                  className="block whitespace-pre-wrap rounded-md bg-background/80 px-3 py-2 text-xs text-foreground"
                  key={`${delivery}-${index}`}
                >
                  {delivery}
                </code>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-emerald-700 dark:text-emerald-200">
              سفارش برای بررسی ادمین ارسال شد.
            </p>
          )}
          <Button asChild className="mt-3" size="sm" variant="outline">
            <Link href="/orders">مشاهده سفارش‌ها</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
