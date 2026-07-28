import { Suspense } from "react";

import { PaymentResultClient } from "./payment-result-client";

export default function PaymentResultPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-muted/30" />}>
      <PaymentResultClient />
    </Suspense>
  );
}
