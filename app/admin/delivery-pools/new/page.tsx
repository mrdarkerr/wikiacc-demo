"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, PackagePlus, Save } from "lucide-react";
import { useRouter } from "next/navigation";

import { DeliveryAdminNav } from "@/components/admin/delivery-admin-nav";
import { AdminSection, AdminState } from "@/components/admin/admin-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";

type PoolForm = {
  slug: string;
  title: string;
  description: string;
};

const initialPoolForm: PoolForm = {
  description: "",
  slug: "",
  title: "",
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "استخر تحویل ایجاد نشد.";
}

export default function AdminDeliveryPoolCreatePage() {
  const router = useRouter();
  const [poolForm, setPoolForm] = useState<PoolForm>(initialPoolForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createPool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const result = await api.admin.deliveryPools.create({
        description: optionalText(poolForm.description),
        slug: poolForm.slug.trim(),
        title: poolForm.title.trim(),
      });

      setError("");
      router.push(`/admin/delivery-pools/items?pool=${result.pool.id}`);
      router.refresh();
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <DeliveryAdminNav />

      {error ? <AdminState tone="danger">{error}</AdminState> : null}

      <AdminSection
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/delivery-pools">
              <ArrowRight className="size-4" />
              بازگشت به لیست
            </Link>
          </Button>
        }
        description="استخر تحویل محل نگهداری آیتم های آماده برای محصولات تحویل فوری است"
        title="ایجاد استخر تحویل"
      >
        <form className="grid gap-4 lg:grid-cols-2" onSubmit={createPool}>
          <label className="block text-sm font-medium">
            عنوان
            <Input
              className="mt-2"
              required
              value={poolForm.title}
              onChange={(event) =>
                setPoolForm((current) => ({
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
              value={poolForm.slug}
              onChange={(event) =>
                setPoolForm((current) => ({
                  ...current,
                  slug: event.target.value,
                }))
              }
            />
          </label>
          <label className="block text-sm font-medium lg:col-span-2">
            توضیح
            <textarea
              className="mt-2 min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
              value={poolForm.description}
              onChange={(event) =>
                setPoolForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <div className="flex flex-wrap gap-2 lg:col-span-2">
            <Button disabled={saving} type="submit">
              <Save className="size-4" />
              ایجاد استخر
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href="/admin/delivery-pools/items">
                <PackagePlus className="size-4" />
                افزودن آیتم به استخر موجود
              </Link>
            </Button>
          </div>
        </form>
      </AdminSection>
    </div>
  );
}
