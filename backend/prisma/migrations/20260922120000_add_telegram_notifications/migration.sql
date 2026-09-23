CREATE TABLE "TelegramSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.telegram.org',
    "botTokenEncrypted" TEXT,
    "botTokenHint" TEXT,
    "botTokenFingerprint" TEXT,
    "cooldownUntil" DATETIME,
    "destinationChatId" TEXT,
    "orderEventsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ticketEventsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paymentEventsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fulfillmentEventsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "TelegramQueueJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "messageText" TEXT NOT NULL,
    "configFingerprint" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseExpiresAt" DATETIME,
    "sentAt" DATETIME,
    "failedAt" DATETIME,
    "providerMessageId" TEXT,
    "lastErrorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "TelegramQueueJob_dedupeKey_key" ON "TelegramQueueJob"("dedupeKey");
CREATE INDEX "TelegramQueueJob_status_availableAt_createdAt_idx" ON "TelegramQueueJob"("status", "availableAt", "createdAt");
CREATE INDEX "TelegramQueueJob_referenceType_referenceId_idx" ON "TelegramQueueJob"("referenceType", "referenceId");