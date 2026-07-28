"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  ReceiptText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import type { DirectPaymentResult, Order } from "@/types/api";

type ResultStatus = DirectPaymentResult["status"];

function orderCode(order: Order) {
  return `WKA-${order.id.slice(-6).toUpperCase()}`;
}

function paymentErrorMessage(reason: unknown) {
  if (reason instanceof ApiError) {
    if (reason.status === 401) {
      return "برای مشاهده و بررسی این پرداخت وارد حساب کاربری شوید.";
    }
    return "ارتباط با درگاه برای بررسی نتیجه کامل نشد. پرداخت ناموفق فرض نشده است؛ دوباره تلاش کنید.";
  }
  return reason instanceof Error
    ? reason.message
    : "بررسی نتیجه پرداخت انجام نشد.";
}

export function PaymentResultClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("order") ?? "";
  const initialStatus = searchParams.get("status") as ResultStatus | null;
  const [status, setStatus] = useState<ResultStatus>(initialStatus ?? "pending");
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadResult() {
      setLoading(true);
      setError("");
      if (!orderId) {
        throw new Error("شناسه سفارش در پاسخ درگاه وجود ندارد.");
      }

      const verified = await api.payments.verifyJibitOrder(orderId);
      const resolvedStatus = verified.payment.status;
      const result = await api.orders.get(orderId);

      if (active) {
        setStatus(resolvedStatus);
        setOrder(result.order);
      }
    }

    loadResult()
      .catch((reason: unknown) => {
        if (active) {
          setError(paymentErrorMessage(reason));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [orderId, retryKey]);

  const deliveries = useMemo(
    () =>
      order?.items.flatMap((item) =>
        item.deliveries.map((delivery) => delivery.contentSnapshot),
      ) ?? [],
    [order],
  );

  const successful = status === "successful" && order?.paymentStatus === "PAID";

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12" dir="rtl">
      <Card className="mx-auto max-w-xl p-6 sm:p-8">
        {loading ? (
          <div className="flex min-h-56 flex-col items-center justify-center text-center">
            <Loader2 className="size-9 animate-spin text-primary" />
            <h1 className="mt-4 text-xl font-bold">در حال بررسی پرداخت</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              نتیجه به‌صورت مستقیم از جیبیت استعلام می‌شود.
            </p>
          </div>
        ) : error ? (
          <>
            <ResultMessage
              icon={<AlertCircle className="size-10 text-rose-500" />}
              title="بررسی پرداخت کامل نشد"
              description={error}
            />
            <Button
              className="mx-auto flex"
              onClick={() => setRetryKey((current) => current + 1)}
              type="button"
            >
              تلاش مجدد
            </Button>
          </>
        ) : successful && order ? (
          <>
            <ResultMessage
              icon={<CheckCircle2 className="size-10 text-emerald-500" />}
              title="پرداخت با موفقیت تأیید شد"
              description={`سفارش ${orderCode(order)} ثبت و پرداخت شده است.`}
            />
            {deliveries.length ? (
              <div className="mt-6 space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-100">
                  اطلاعات تحویل
                </p>
                {deliveries.map((delivery, index) => (
                  <code
                    className="block whitespace-pre-wrap rounded-md bg-background px-3 py-2 text-xs"
                    key={`${delivery}-${index}`}
                  >
                    {delivery}
                  </code>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-md bg-muted p-4 text-sm text-muted-foreground">
                سفارش برای انجام و بررسی ادمین ثبت شد.
              </p>
            )}
          </>
        ) : status === "failed" ? (
          <ResultMessage
            icon={<AlertCircle className="size-10 text-rose-500" />}
            title="پرداخت ناموفق بود"
            description="مبلغی برای این سفارش تأیید نشده و موجودی رزروشده آزاد شده است. می‌توانید دوباره سفارش بدهید."
          />
        ) : (
          <ResultMessage
            icon={<Clock3 className="size-10 text-amber-500" />}
            title="پرداخت در حال بررسی است"
            description="پرداخت هنوز به‌صورت قطعی تأیید نشده است. هیچ محصولی تا زمان تأیید تحویل داده نمی‌شود؛ وضعیت را از سفارش‌ها پیگیری کنید."
          />
        )}

        {!loading ? (
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="flex-1">
              <Link href="/orders">
                <ReceiptText className="size-4" />
                مشاهده سفارش‌ها
              </Link>
            </Button>
            <Button asChild className="flex-1" variant="outline">
              <Link href="/store">بازگشت به فروشگاه</Link>
            </Button>
          </div>
        ) : null}
      </Card>
    </main>
  );
}

function ResultMessage({
  description,
  icon,
  title,
}: {
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="py-6 text-center">
      <div className="flex justify-center">{icon}</div>
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <p className="mx-auto mt-3 max-w-md text-sm/7 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
