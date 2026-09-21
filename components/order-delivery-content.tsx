"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OrderDelivery } from "@/types/api";

type DeliveryContentListProps = {
  deliveries: Array<Pick<OrderDelivery, "id" | "contentSnapshot">>;
  className?: string;
};

export function DeliveryContentList({
  className = "",
  deliveries,
}: DeliveryContentListProps) {
  const [copiedId, setCopiedId] = useState("");

  async function copyDelivery(delivery: Pick<OrderDelivery, "id" | "contentSnapshot">) {
    try {
      await navigator.clipboard.writeText(delivery.contentSnapshot);
      setCopiedId(delivery.id);
      window.setTimeout(() => setCopiedId(""), 1800);
    } catch {
      setCopiedId("");
    }
  }

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      {deliveries.map((delivery) => {
        const copied = copiedId === delivery.id;
        return (
          <div
            className="flex items-start gap-2 rounded-md bg-muted p-2"
            key={delivery.id}
          >
            <code
              className="min-w-0 flex-1 whitespace-pre-wrap break-words px-1 py-1 text-xs [overflow-wrap:anywhere]"
              dir="ltr"
            >
              {delivery.contentSnapshot}
            </code>
            <Button
              aria-label="کپی اطلاعات تحویل"
              className="shrink-0"
              size="sm"
              type="button"
              variant="outline"
              onClick={() => void copyDelivery(delivery)}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "کپی شد" : "کپی"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
