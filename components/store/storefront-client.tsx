"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  WalletCards,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { OtpAuthForm } from "@/components/auth/otp-auth-form";
import { api, ApiError } from "@/lib/api";
import { dashboardPath, useCurrentUser } from "@/lib/use-current-user";
import type { Order, Product, ProductField } from "@/types/api";

type FieldValues = Record<string, string>;

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
  const searchParams = useSearchParams();
  const { loading: authLoading, refresh: refreshUser, user } = useCurrentUser();
  const requestedProduct = searchParams.get("product") ?? "";
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
        const product = result.products.find(
          (item) => item.slug === requestedProduct || item.id === requestedProduct,
        );
        setSelectedProductId(product?.id ?? "");
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
  }, [requestedProduct]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const orderDeliveries = useMemo(
    () => (createdOrder ? deliveryMessages(createdOrder) : []),
    [createdOrder],
  );

  const availableDeliveryItems = selectedProduct?.deliveryPool?._count?.items;
  const isUnavailable =
    Boolean(selectedProduct?.deliveryPool) && availableDeliveryItems === 0;
  const hasInsufficientDeliveryStock =
    typeof availableDeliveryItems === "number" &&
    availableDeliveryItems > 0 &&
    quantity > availableDeliveryItems;
  const totalAmount = selectedProduct ? selectedProduct.price * quantity : 0;

  function updateFieldValue(key: string, value: string) {
    setFieldValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProduct) {
      return;
    }

    if (isUnavailable) {
      setSubmitError("این محصول ناموجود است و در حال حاضر امکان خرید آن وجود ندارد.");
      return;
    }

    if (hasInsufficientDeliveryStock) {
      setSubmitError("موجودی تحویل برای تعداد انتخاب‌شده کافی نیست.");
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
            {authLoading ? (
              <div
                aria-hidden="true"
                className="h-9 w-16 animate-pulse rounded-md bg-muted"
              />
            ) : (
              <Button asChild size="sm">
                <Link href={user ? dashboardPath(user) : "/login"}>
                  {user ? "داشبورد" : "ورود"}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <ReceiptText className="size-6" />
              صورت‌حساب
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              جزئیات محصول را بررسی کنید و سفارش را با موجودی کیف پول ثبت کنید.
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
              <Card className="min-h-72 animate-pulse space-y-5 p-6">
                <div className="h-6 w-40 rounded-full bg-muted" />
                <div className="space-y-3">
                  <div className="h-4 w-full rounded-full bg-muted" />
                  <div className="h-4 w-3/4 rounded-full bg-muted" />
                </div>
                <div className="space-y-3 pt-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div className="flex items-center gap-2" key={index}>
                      <div className="size-5 rounded-full bg-muted" />
                      <div className="h-4 w-36 rounded-full bg-muted" />
                    </div>
                  ))}
                </div>
              </Card>
            ) : loadError ? (
              <Card className="flex items-center gap-2 border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                <AlertCircle className="size-4" />
                {loadError}
              </Card>
            ) : selectedProduct ? (
              <Card className="overflow-hidden">
                <div className="border-b border-border bg-muted/30 p-6">
                  <p className="text-xs font-medium text-muted-foreground">محصول انتخاب‌شده</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold">{selectedProduct.title}</h2>
                    {isUnavailable ? (
                      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-200">
                        ناموجود
                      </span>
                    ) : null}
                  </div>
                  {selectedProduct.description ? (
                    <p className="mt-3 max-w-2xl text-sm/7 text-muted-foreground">
                      {selectedProduct.description}
                    </p>
                  ) : null}
                </div>
                <div className="p-6">
                  {selectedProduct.features?.length ? (
                    <div>
                      <h3 className="text-sm font-bold">ویژگی‌های محصول</h3>
                      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                        {selectedProduct.features.map((feature) => (
                          <li className="flex items-center gap-2 text-sm" key={feature.id}>
                            <CheckCircle className="size-4 shrink-0 text-emerald-500" />
                            {feature.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
                    <div>
                      <p className="text-xs text-muted-foreground">قیمت واحد</p>
                      <p className="mt-1 text-xl font-bold">{formatCurrency(selectedProduct.price)}</p>
                    </div>
                    <Button asChild variant="outline">
                      <Link href="/#services">
                        <ArrowRight className="size-4" />
                        انتخاب محصول دیگر
                      </Link>
                    </Button>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-6 text-center">
                <AlertCircle className="mx-auto size-8 text-muted-foreground" />
                <h2 className="mt-3 font-bold">محصول انتخاب‌شده پیدا نشد</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  ممکن است محصول غیرفعال شده باشد یا لینکی که باز کرده‌اید کامل نباشد.
                </p>
                <Button asChild className="mt-5">
                  <Link href="/#services">بازگشت به محصولات</Link>
                </Button>
              </Card>
            )}
          </section>

          <Card className="lg:sticky lg:top-6">
            {authLoading ? (
              <div className="space-y-4 p-5">
                <div className="h-6 w-40 animate-pulse rounded-full bg-muted" />
                <div className="h-20 animate-pulse rounded-md bg-muted" />
                <div className="h-10 animate-pulse rounded-md bg-muted" />
              </div>
            ) : isUnavailable ? (
              <div className="p-5">
                <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 size-5 shrink-0" />
                    <div>
                      <h2 className="font-bold">ناموجود</h2>
                      <p className="mt-1 text-sm/6">
                        موجودی تحویل این محصول تمام شده است. تا زمان شارژ مجدد، امکان ثبت و پرداخت سفارش وجود ندارد.
                      </p>
                    </div>
                  </div>
                </div>
                <Button asChild className="mt-4 w-full" variant="outline">
                  <Link href="/#services">انتخاب محصول دیگر</Link>
                </Button>
              </div>
            ) : !user ? (
              <div className="p-5">
                <div className="mb-5 rounded-md border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                      <h2 className="font-bold">یک قدم تا نهایی کردن خرید</h2>
                      <p className="mt-1 text-sm/6 text-muted-foreground">
                        نام و شماره موبایل را وارد کنید. اگر حساب دارید وارد می‌شوید و اگر ندارید همان‌جا حساب شما ساخته می‌شود.
                      </p>
                    </div>
                  </div>
                </div>
                <OtpAuthForm
                  mode="checkout"
                  onAuthenticated={async () => {
                    await refreshUser();
                  }}
                />
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  محصول انتخاب‌شده حفظ می‌شود و بعد از تأیید، همین صورت‌حساب نمایش داده خواهد شد.
                </p>
              </div>
            ) : (
              <form className="space-y-5 p-5" onSubmit={handleSubmit}>
              <div>
                <h2 className="text-base font-bold">جزئیات صورت‌حساب</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedProduct
                    ? selectedProduct.title
                    : loading ? "در حال آماده‌سازی..." : "محصولی انتخاب نشده است."}
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
                        max={
                          typeof availableDeliveryItems === "number"
                            ? Math.min(10, availableDeliveryItems)
                            : 10
                        }
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

                  {hasInsufficientDeliveryStock ? (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>موجودی تحویل برای تعداد انتخاب‌شده کافی نیست.</span>
                    </div>
                  ) : null}

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

                  <Button
                    className="w-full"
                    disabled={submitting || hasInsufficientDeliveryStock}
                    type="submit"
                  >
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
                  از صفحهٔ اصلی محصول موردنظر را انتخاب کنید تا صورت‌حساب آن اینجا نمایش داده شود.
                </div>
              )}
              </form>
            )}
          </Card>
        </div>
      </div>
    </main>
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
        <Select
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
        </Select>
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
