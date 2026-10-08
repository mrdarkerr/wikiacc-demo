-- Synthetic empty schema from commit 6899c856787678656404733364d0537b740e70c3.
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT,
    "deliveryPoolId" TEXT,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "shareboxCategoryId" TEXT,
    "shareboxCategoryName" TEXT,
    "price" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" DATETIME,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_deliveryPoolId_fkey" FOREIGN KEY ("deliveryPoolId") REFERENCES "DeliveryPool" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductFeature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductFeature_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "optionsJson" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductField_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryPool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DeliveryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "poolId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "reservedForOrderItemId" TEXT,
    "reservedAt" DATETIME,
    "deliveredToOrderItemId" TEXT,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryItem_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "DeliveryPool" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "walletTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" TEXT NOT NULL DEFAULT 'WALLET',
    "totalAmount" INTEGER NOT NULL,
    "note" TEXT,
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "titleSnapshot" TEXT NOT NULL,
    "priceSnapshot" INTEGER NOT NULL,
    "productTypeSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
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
    CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderFieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderItemId" TEXT NOT NULL,
    "fieldId" TEXT,
    "keySnapshot" TEXT NOT NULL,
    "labelSnapshot" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderFieldValue_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "ProductField" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderItemId" TEXT NOT NULL,
    "deliveryItemId" TEXT,
    "shareboxFulfillmentId" TEXT,
    "contentSnapshot" TEXT NOT NULL,
    "deliveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderDelivery_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderDelivery_deliveryItemId_fkey" FOREIGN KEY ("deliveryItemId") REFERENCES "DeliveryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderDelivery_shareboxFulfillmentId_fkey" FOREIGN KEY ("shareboxFulfillmentId") REFERENCES "ShareboxFulfillment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShareboxSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyEncrypted" TEXT,
    "apiKeyHint" TEXT,
    "apiKeyFingerprint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
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
    CONSTRAINT "ShareboxFulfillment_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdByAdminId" TEXT,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WalletTransaction_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftJson" TEXT NOT NULL,
    "publishedJson" TEXT NOT NULL,
    "draftVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedVersion" INTEGER NOT NULL DEFAULT 1,
    "draftUpdatedById" TEXT,
    "publishedById" TEXT,
    "draftUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteContent_draftUpdatedById_fkey" FOREIGN KEY ("draftUpdatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SiteContent_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmsProviderSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT,
    "apiKeyHint" TEXT,
    "authPatternCode" TEXT DEFAULT 'a5gPP4cwpS',
    "ticketAnsweredPatternCode" TEXT DEFAULT 'ojtukzfpWZ',
    "ticketCreatedPatternCode" TEXT DEFAULT '6bZHqMLbrY',
    "adminTicketActivityPatternCode" TEXT DEFAULT 'bvDXpCSNbU',
    "orderCreatedPatternCode" TEXT DEFAULT 'DBh0eWEV0p',
    "orderCompletedPatternCode" TEXT DEFAULT 'd8RdZIfeIs',
    "userNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "adminNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "adminPhone" TEXT,
    "defaultSenderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SmsSenderLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settingsId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lineNumber" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmsSenderLine_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "SmsProviderSettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slug_key" ON "ProductCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_type_isActive_archivedAt_sortOrder_idx" ON "Product"("type", "isActive", "archivedAt", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductFeature_productId_sortOrder_idx" ON "ProductFeature"("productId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductField_productId_key_key" ON "ProductField"("productId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryPool_slug_key" ON "DeliveryPool"("slug");

-- CreateIndex
CREATE INDEX "DeliveryItem_poolId_status_createdAt_idx" ON "DeliveryItem"("poolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryItem_reservedForOrderItemId_idx" ON "DeliveryItem"("reservedForOrderItemId");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_clientReferenceNumber_key" ON "PaymentAttempt"("clientReferenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_providerPurchaseId_key" ON "PaymentAttempt"("providerPurchaseId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_createdAt_idx" ON "PaymentAttempt"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_reconcileAfter_idx" ON "PaymentAttempt"("status", "reconcileAfter");

-- CreateIndex
CREATE UNIQUE INDEX "OrderFieldValue_orderItemId_keySnapshot_key" ON "OrderFieldValue"("orderItemId", "keySnapshot");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDelivery_shareboxFulfillmentId_key" ON "OrderDelivery"("shareboxFulfillmentId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDelivery_deliveryItemId_key" ON "OrderDelivery"("deliveryItemId");

-- CreateIndex
CREATE INDEX "ShareboxFulfillment_status_nextAttemptAt_leaseExpiresAt_idx" ON "ShareboxFulfillment"("status", "nextAttemptAt", "leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShareboxFulfillment_orderItemId_unitIndex_key" ON "ShareboxFulfillment"("orderItemId", "unitIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ShareboxFulfillment_apiKeyFingerprint_externalId_key" ON "ShareboxFulfillment"("apiKeyFingerprint", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_key" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "WalletTransaction_referenceType_referenceId_idx" ON "WalletTransaction"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "Ticket_userId_createdAt_idx" ON "Ticket"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_status_createdAt_idx" ON "Ticket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SiteContent_draftUpdatedById_idx" ON "SiteContent"("draftUpdatedById");

-- CreateIndex
CREATE INDEX "SiteContent_publishedById_idx" ON "SiteContent"("publishedById");

-- CreateIndex
CREATE UNIQUE INDEX "SmsProviderSettings_provider_key" ON "SmsProviderSettings"("provider");

-- CreateIndex
CREATE INDEX "SmsSenderLine_settingsId_isActive_sortOrder_idx" ON "SmsSenderLine"("settingsId", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SmsSenderLine_settingsId_lineNumber_key" ON "SmsSenderLine"("settingsId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SmsQueueJob_dedupeKey_key" ON "SmsQueueJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "SmsQueueJob_status_availableAt_sequence_createdAt_idx" ON "SmsQueueJob"("status", "availableAt", "sequence", "createdAt");

-- CreateIndex
CREATE INDEX "SmsQueueJob_referenceType_referenceId_idx" ON "SmsQueueJob"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramQueueJob_dedupeKey_key" ON "TelegramQueueJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "TelegramQueueJob_status_availableAt_createdAt_idx" ON "TelegramQueueJob"("status", "availableAt", "createdAt");

-- CreateIndex
CREATE INDEX "TelegramQueueJob_referenceType_referenceId_idx" ON "TelegramQueueJob"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "AuthOtpChallenge_phone_createdAt_idx" ON "AuthOtpChallenge"("phone", "createdAt");

-- CreateIndex
CREATE INDEX "AuthOtpChallenge_requestIpHash_createdAt_idx" ON "AuthOtpChallenge"("requestIpHash", "createdAt");

-- CreateIndex
CREATE INDEX "AuthOtpChallenge_expiresAt_idx" ON "AuthOtpChallenge"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthOtpChallenge_createdAt_idx" ON "AuthOtpChallenge"("createdAt");