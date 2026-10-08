ALTER TABLE "Product" ADD COLUMN "priceCurrency" TEXT NOT NULL DEFAULT 'TOMAN';
ALTER TABLE "Product" ADD COLUMN "basePrice" TEXT;
ALTER TABLE "Product" ADD COLUMN "profitType" TEXT NOT NULL DEFAULT 'TOMAN';
ALTER TABLE "Product" ADD COLUMN "profitValue" TEXT NOT NULL DEFAULT '0';
UPDATE "Product" SET "basePrice" = CAST("price" AS TEXT);
ALTER TABLE "OrderItem" ADD COLUMN "priceCurrencySnapshot" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "basePriceSnapshot" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "profitTypeSnapshot" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "profitValueSnapshot" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "exchangeRateSnapshot" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "rateSourceSnapshot" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "rateFetchedAtSnapshot" DATETIME;
ALTER TABLE "OrderItem" ADD COLUMN "baseTomanSnapshot" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "profitTomanSnapshot" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "totalProfitSnapshot" INTEGER;
ALTER TABLE "TelegramSettings" ADD COLUMN "exchangeRateEventsEnabled" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "PricingSettings" (
 "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
 "fallbackRateToman" INTEGER NOT NULL DEFAULT 270000,
 "staleAfterSeconds" INTEGER NOT NULL DEFAULT 300,
 "alertCooldownSeconds" INTEGER NOT NULL DEFAULT 1800,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL
);
INSERT INTO "PricingSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);
CREATE TABLE "ExchangeRate" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "source" TEXT NOT NULL DEFAULT 'WALLEX',
 "symbol" TEXT NOT NULL DEFAULT 'USDTTMN',
 "rateToman" INTEGER NOT NULL,
 "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ExchangeRate_fetchedAt_idx" ON "ExchangeRate"("fetchedAt");
CREATE TABLE "ExchangeRateSyncState" (
 "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'USD_TOMAN',
 "lastAttemptAt" DATETIME, "lastSuccessAt" DATETIME, "lastErrorCode" TEXT,
 "incidentId" TEXT, "incidentStartedAt" DATETIME, "lastAlertAt" DATETIME,
 "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "ScheduledJob" (
 "name" TEXT NOT NULL PRIMARY KEY,
 "nextRunAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "leaseToken" TEXT, "leaseExpiresAt" DATETIME,
 "lastStartedAt" DATETIME, "lastFinishedAt" DATETIME, "lastSuccessAt" DATETIME,
 "lastErrorCode" TEXT, "runCount" INTEGER NOT NULL DEFAULT 0,
 "failureCount" INTEGER NOT NULL DEFAULT 0,
 "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "ScheduledJob_nextRunAt_leaseExpiresAt_idx" ON "ScheduledJob"("nextRunAt", "leaseExpiresAt");
