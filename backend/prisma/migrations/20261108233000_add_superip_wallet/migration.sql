CREATE TABLE "SuperipSettings" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "enabled" BOOLEAN NOT NULL DEFAULT false,
 "endpoint" TEXT NOT NULL,
 "secretEncrypted" TEXT,
 "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "SuperipFulfillment" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "orderItemId" TEXT NOT NULL,
 "username" TEXT NOT NULL,
 "amount" INTEGER NOT NULL,
 "endpoint" TEXT NOT NULL,
 "reference" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING',
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "leaseToken" TEXT,
 "leaseExpiresAt" DATETIME,
 "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastErrorCode" TEXT,
 "receiptId" TEXT,
 "deliveredAt" DATETIME,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SuperipFulfillment_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SuperipFulfillment_orderItemId_key" ON "SuperipFulfillment"("orderItemId");
CREATE UNIQUE INDEX "SuperipFulfillment_reference_key" ON "SuperipFulfillment"("reference");
CREATE INDEX "SuperipFulfillment_status_nextAttemptAt_idx" ON "SuperipFulfillment"("status", "nextAttemptAt");
