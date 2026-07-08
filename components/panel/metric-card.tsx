import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  tone?: "blue" | "emerald" | "amber" | "rose";
};

const tones: Record<NonNullable<MetricCardProps["tone"]>, string> = {
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
};

export function MetricCard({
  helper,
  icon: Icon,
  label,
  tone = "blue",
  value,
}: MetricCardProps) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <strong className="mt-2 block text-2xl font-bold tracking-normal">
            {value}
          </strong>
        </div>
        <span className={cn("grid size-10 place-items-center rounded-md", tones[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{helper}</p>
    </article>
  );
}
