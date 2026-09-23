PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;

ALTER TABLE "Product" ADD COLUMN "shareboxCategoryId" TEXT;
ALTER TABLE "Product" ADD COLUMN "shareboxCategoryName" TEXT;

CREATE TABLE "ShareboxSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyEncrypted" TEXT,
    "apiKeyHint" TEXT,
    "apiKeyFingerprint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ShareboxFulfillment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderItemId" TEXT NOT NULL,
    "unitIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "externalId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "apiKeyFingerprint" TEXT NOT NULL,
    "apiOrigin" TEXT NOT NULL,
    "lastErrorCode" TEXT,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseExpiresAt" DATETIME,
    "receiptLicenseId" TEXT,
    "receiptIssuedAt" DATETIME,
    "receiptExpiresAt" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShareboxFulfillment_orderItemId_fkey"
      FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ShareboxFulfillment_orderItemId_unitIndex_key"
ON "ShareboxFulfillment"("orderItemId", "unitIndex");
CREATE UNIQUE INDEX "ShareboxFulfillment_apiKeyFingerprint_externalId_key"
ON "ShareboxFulfillment"("apiKeyFingerprint", "externalId");
CREATE INDEX "ShareboxFulfillment_status_nextAttemptAt_leaseExpiresAt_idx"
ON "ShareboxFulfillment"("status", "nextAttemptAt", "leaseExpiresAt");

CREATE TABLE "new_OrderDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderItemId" TEXT NOT NULL,
    "deliveryItemId" TEXT,
    "shareboxFulfillmentId" TEXT,
    "contentSnapshot" TEXT NOT NULL,
    "deliveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderDelivery_orderItemId_fkey"
      FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderDelivery_deliveryItemId_fkey"
      FOREIGN KEY ("deliveryItemId") REFERENCES "DeliveryItem" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderDelivery_shareboxFulfillmentId_fkey"
      FOREIGN KEY ("shareboxFulfillmentId") REFERENCES "ShareboxFulfillment" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_OrderDelivery" (
  "contentSnapshot", "deliveredAt", "deliveryItemId", "id", "orderItemId"
)
SELECT "contentSnapshot", "deliveredAt", "deliveryItemId", "id", "orderItemId"
FROM "OrderDelivery";
DROP TABLE "OrderDelivery";
ALTER TABLE "new_OrderDelivery" RENAME TO "OrderDelivery";
CREATE UNIQUE INDEX "OrderDelivery_deliveryItemId_key"
ON "OrderDelivery"("deliveryItemId");
CREATE UNIQUE INDEX "OrderDelivery_shareboxFulfillmentId_key"
ON "OrderDelivery"("shareboxFulfillmentId");
COMMIT;
PRAGMA foreign_keys=ON;
