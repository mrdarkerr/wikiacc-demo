import { Suspense } from "react";

import { AdminState } from "@/components/admin/admin-section";
import { AdminProductFormClient } from "./product-form-client";

export default function AdminProductFormPage() {
  return (
    <Suspense fallback={<AdminState>در حال آماده سازی فرم محصول...</AdminState>}>
      <AdminProductFormClient />
    </Suspense>
  );
}
