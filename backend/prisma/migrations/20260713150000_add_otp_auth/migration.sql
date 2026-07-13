-- Make email and password optional for phone-first OTP accounts.
PRAGMA foreign_keys=OFF;
PRAGMA defer_foreign_keys=ON;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_User" (
    "createdAt", "email", "id", "name", "passwordHash", "phone", "role", "updatedAt"
)
SELECT
    "createdAt", "email", "id", "name", "passwordHash", "phone", "role", "updatedAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

PRAGMA defer_foreign_keys=OFF;
PRAGMA foreign_keys=ON;

-- The same configurable pattern is used for both login and registration OTPs.
ALTER TABLE "SmsProviderSettings"
ADD COLUMN "authPatternCode" TEXT DEFAULT 'a5gPP4cwpS';

CREATE TABLE "AuthOtpChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "registrationName" TEXT,
    "registrationEmail" TEXT,
    "requestIpHash" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "consumedAt" DATETIME,
    "invalidatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "AuthOtpChallenge_phone_createdAt_idx"
ON "AuthOtpChallenge"("phone", "createdAt");

CREATE INDEX "AuthOtpChallenge_requestIpHash_createdAt_idx"
ON "AuthOtpChallenge"("requestIpHash", "createdAt");

CREATE INDEX "AuthOtpChallenge_expiresAt_idx"
ON "AuthOtpChallenge"("expiresAt");

CREATE INDEX "AuthOtpChallenge_createdAt_idx"
ON "AuthOtpChallenge"("createdAt");
