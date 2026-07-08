"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaginationProps = {
  className?: string;
  onPageChange: (page: number) => void;
  page: number;
  totalItems?: number;
  totalPages: number;
};

const numberFormatter = new Intl.NumberFormat("fa-IR");

export function Pagination({
  className,
  onPageChange,
  page,
  totalItems,
  totalPages,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div
      className={cn(
        "mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">
        صفحه {numberFormatter.format(page)} از{" "}
        {numberFormatter.format(totalPages)}
        {typeof totalItems === "number"
          ? ` - ${numberFormatter.format(totalItems)} مورد`
          : ""}
      </p>
      <div className="flex gap-2">
        <Button
          disabled={page <= 1}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronRight className="size-4" />
          قبلی
        </Button>
        <Button
          disabled={page >= totalPages}
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onPageChange(page + 1)}
        >
          بعدی
          <ChevronLeft className="size-4" />
        </Button>
      </div>
    </div>
  );
}
