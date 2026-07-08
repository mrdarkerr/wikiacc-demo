import type { ReactNode } from "react";

type AdminSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function AdminSection({
  action,
  children,
  description,
  title,
}: AdminSectionProps) {
  return (
    <section className="rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

type AdminStateProps = {
  children: ReactNode;
  tone?: "muted" | "danger" | "success";
};

export function AdminState({ children, tone = "muted" }: AdminStateProps) {
  const color =
    tone === "danger"
      ? "text-rose-600 dark:text-rose-300"
      : tone === "success"
        ? "text-emerald-600 dark:text-emerald-300"
        : "text-muted-foreground";

  return <p className={`text-sm ${color}`}>{children}</p>;
}
