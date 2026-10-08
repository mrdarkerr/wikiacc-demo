"use client";

import Link from "next/link";
import { RefreshCw, Settings2 } from "lucide-react";
import { usePricingStatus } from "../../lib/use-pricing";
import { AdminSection, AdminState } from "./admin-section";
import { RateSummary } from "./pricing-widgets";
import { Button } from "../ui/button";

export function ExchangeRatePanel({ status, dashboard = false }: { status: ReturnType<typeof usePricingStatus>; dashboard?: boolean }) {
  return <AdminSection title="نرخ مبنای قیمت‌گذاری" description="دریافت خودکار والکس هر ۲ دقیقه؛ تازه‌سازی این کارت فقط وضعیت ذخیره‌شده را می‌خواند."
    action={<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" type="button" disabled={status.refreshing} onClick={() => void status.refresh()}><RefreshCw className={`size-4 ${status.refreshing ? "animate-spin" : ""}`} />تازه‌سازی</Button>{dashboard ? <Button asChild size="sm" variant="outline"><Link href="/admin/pricing"><Settings2 className="size-4" />تنظیمات نرخ</Link></Button> : null}</div>}>
    {status.error ? <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300" role="alert">{status.error}{status.data ? <p className="mt-1 text-xs">اطلاعات زیر مربوط به آخرین دریافت موفق این صفحه است؛ وضعیت جدید تأیید نشده است.</p> : null}</div> : null}
    {status.data ? <RateSummary rate={status.data.exchangeRate} /> : <AdminState>{status.refreshing ? "در حال دریافت نرخ و وضعیت..." : "نرخ دریافت نشده است؛ دوباره تلاش کنید."}</AdminState>}
  </AdminSection>;
}

export function ExchangeRateCard({ dashboard = false }: { dashboard?: boolean }) {
  const status = usePricingStatus(dashboard);
  return <ExchangeRatePanel status={status} dashboard={dashboard} />;
}
