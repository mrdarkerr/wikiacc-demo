"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OrderDelivery } from "@/types/api";

type Delivery = Pick<OrderDelivery, "id" | "contentSnapshot" | "sharebox">;
type DeliveryContentListProps = {
  deliveries: Delivery[];
  className?: string;
};

const expiryFormatter = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});

export function DeliveryContentList({
  className = "",
  deliveries,
}: DeliveryContentListProps) {
  const [copiedId, setCopiedId] = useState("");
  const [copyErrorId, setCopyErrorId] = useState("");

  async function copyDelivery(delivery: Delivery) {
    setCopyErrorId("");
    try {
      await navigator.clipboard.writeText(delivery.sharebox?.licenseKey ?? delivery.contentSnapshot);
      setCopiedId(delivery.id);
      window.setTimeout(() => setCopiedId(""), 1800);
    } catch {
      setCopiedId("");
      setCopyErrorId(delivery.id);
    }
  }

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {deliveries.map((delivery) => {
        const copied = copiedId === delivery.id;
        const license = delivery.sharebox;
        return (
          <div className={license ? "rounded-md border bg-background p-3 text-foreground" : "rounded-md bg-muted p-2"} key={delivery.id}>
            {license ? (
              <>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound className="size-4 text-primary" />
                  لایسنس شیر‌باکس
                </p>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                  این کد را کپی کنید و در بخش ورود برنامه شیر‌باکس وارد کنید.
                </p>
              </>
            ) : null}
            <div className={`flex items-start gap-2 ${license ? "mt-3 rounded-md border bg-muted/50 p-2" : ""}`}>
              <code className="min-w-0 flex-1 select-all whitespace-pre-wrap break-words px-1 py-1 text-xs [overflow-wrap:anywhere]" dir="ltr">
                {license?.licenseKey ?? delivery.contentSnapshot}
              </code>
              <Button
                aria-label={license ? "کپی لایسنس" : "کپی اطلاعات تحویل"}
                className="min-h-10 shrink-0"
                size="sm"
                type="button"
                variant="outline"
                onClick={() => void copyDelivery(delivery)}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "کپی شد" : "کپی"}
              </Button>
            </div>
            {license ? (
              <dl className="mt-3 space-y-2 text-xs">
                {license.validityDays !== null ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <dt className="text-muted-foreground">مدت اعتبار از زمان صدور</dt>
                    <dd className="font-medium">{license.validityDays.toLocaleString("fa-IR")} روز</dd>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <dt className="text-muted-foreground">انقضا (به وقت تهران)</dt>
                  <dd className="font-medium">{expiryFormatter.format(new Date(license.expiresAt))}</dd>
                </div>
              </dl>
            ) : null}
            {copyErrorId === delivery.id ? (
              <p className="mt-2 text-xs text-rose-600" role="status">کپی خودکار انجام نشد؛ متن را انتخاب و کپی کنید.</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
