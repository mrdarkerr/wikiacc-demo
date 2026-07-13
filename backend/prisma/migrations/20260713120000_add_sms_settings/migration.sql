-- Store IranPayamak credentials separately from sender-line configuration.
CREATE TABLE "SmsProviderSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT,
    "apiKeyHint" TEXT,
    "defaultSenderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SmsSenderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settingsId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lineNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsSenderLine_settingsId_fkey"
        FOREIGN KEY ("settingsId") REFERENCES "SmsProviderSettings" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SmsProviderSettings_provider_key"
    ON "SmsProviderSettings"("provider");

CREATE UNIQUE INDEX "SmsSenderLine_settingsId_lineNumber_key"
    ON "SmsSenderLine"("settingsId", "lineNumber");

CREATE INDEX "SmsSenderLine_settingsId_isActive_sortOrder_idx"
    ON "SmsSenderLine"("settingsId", "isActive", "sortOrder");
