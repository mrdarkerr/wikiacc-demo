import type { Metadata } from "next";
import { Suspense } from "react";

import { StorefrontClient } from "@/components/store/storefront-client";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "فروشگاه | ویکی اکانت",
};

export default function StorePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-muted/30 p-6" dir="rtl">
          <Card className="mx-auto min-h-72 max-w-6xl animate-pulse bg-muted/60" />
        </main>
      }
    >
      <StorefrontClient />
    </Suspense>
  );
}
