-- Add direct payment metadata without changing existing wallet orders.
ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'WALLET';

-- Delivery inventory is reserved while the customer is completing payment.
ALTER TABLE "DeliveryItem" ADD COLUMN "reservedForOrderItemId" TEXT;
ALTER TABLE "DeliveryItem" ADD COLUMN "reservedAt" DATETIME;

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'JIBIT',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "clientReferenceNumber" TEXT NOT NULL,
    "providerPurchaseId" TEXT,
    "providerAmountRial" INTEGER NOT NULL,
    "providerStatus" TEXT,
    "redirectUrl" TEXT,
    "pspReferenceNumber" TEXT,
    "pspMaskedCardNumber" TEXT,
    "lastErrorCode" TEXT,
    "reconcileAfter" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "failedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentAttempt_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PaymentAttempt_clientReferenceNumber_key"
  ON "PaymentAttempt"("clientReferenceNumber");
CREATE UNIQUE INDEX "PaymentAttempt_providerPurchaseId_key"
  ON "PaymentAttempt"("providerPurchaseId");
CREATE INDEX "PaymentAttempt_orderId_createdAt_idx"
  ON "PaymentAttempt"("orderId", "createdAt");
CREATE INDEX "PaymentAttempt_status_reconcileAfter_idx"
  ON "PaymentAttempt"("status", "reconcileAfter");
CREATE INDEX "DeliveryItem_reservedForOrderItemId_idx"
  ON "DeliveryItem"("reservedForOrderItemId");
