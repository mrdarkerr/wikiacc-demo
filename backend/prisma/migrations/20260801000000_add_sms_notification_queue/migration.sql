ALTER TABLE "SmsProviderSettings"
ADD COLUMN "ticketAnsweredPatternCode" TEXT DEFAULT 'ojtukzfpWZ';

ALTER TABLE "SmsProviderSettings"
ADD COLUMN "ticketCreatedPatternCode" TEXT DEFAULT '6bZHqMLbrY';

ALTER TABLE "SmsProviderSettings"
ADD COLUMN "adminTicketActivityPatternCode" TEXT DEFAULT 'bvDXpCSNbU';

ALTER TABLE "SmsProviderSettings"
ADD COLUMN "orderCreatedPatternCode" TEXT DEFAULT 'DBh0eWEV0p';

ALTER TABLE "SmsProviderSettings"
ADD COLUMN "orderCompletedPatternCode" TEXT DEFAULT 'd8RdZIfeIs';

ALTER TABLE "SmsProviderSettings"
ADD COLUMN "userNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SmsProviderSettings"
ADD COLUMN "adminNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SmsProviderSettings"
ADD COLUMN "adminPhone" TEXT;

CREATE TABLE "SmsQueueJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "patternCode" TEXT NOT NULL,
    "attributesJson" TEXT NOT NULL DEFAULT '{}',
    "numberFormat" TEXT NOT NULL DEFAULT 'english',
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "availableAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME,
    "sentAt" DATETIME,
    "failedAt" DATETIME,
    "providerMessageId" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "SmsQueueJob_dedupeKey_key"
ON "SmsQueueJob"("dedupeKey");

CREATE INDEX "SmsQueueJob_status_availableAt_sequence_createdAt_idx"
ON "SmsQueueJob"("status", "availableAt", "sequence", "createdAt");

CREATE INDEX "SmsQueueJob_referenceType_referenceId_idx"
ON "SmsQueueJob"("referenceType", "referenceId");
