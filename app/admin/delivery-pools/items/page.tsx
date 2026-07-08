import { Suspense } from "react";

import { AdminState } from "@/components/admin/admin-section";
import { DeliveryItemsClient } from "./items-client";

export default function AdminDeliveryItemsPage() {
  return (
    <Suspense fallback={<AdminState>در حال آماده سازی آیتم های تحویل...</AdminState>}>
      <DeliveryItemsClient />
    </Suspense>
  );
}