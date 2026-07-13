import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
const testDatabaseName = `test-${process.pid}.db`;
process.env.DATABASE_URL = `file:./${testDatabaseName}`;
process.env.JWT_SECRET = "test-secret-with-enough-length";
process.env.SMS_CONFIG_ENCRYPTION_KEY = "test-sms-encryption-secret-with-enough-length";
process.env.WEB_APP_URL = "http://localhost:3000";
process.env.COOKIE_SECURE = "false";

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(__dirname, "..");
const applySchemaScript = resolve(backendDir, "scripts", "apply-schema.js");
const testDbPath = resolve(backendDir, "prisma", testDatabaseName);

if (existsSync(testDbPath)) {
  unlinkSync(testDbPath);
}

execFileSync(process.execPath, [applySchemaScript], {
  cwd: backendDir,
  env: process.env,
  stdio: "inherit",
});

const { buildApp } = await import("../src/app.js");
const { sendAuthCodeSms, sendPatternSms } = await import(
  "../src/modules/sms/service.js"
);

function getCookie(response) {
  const raw = response.headers["set-cookie"];
  return Array.isArray(raw) ? raw[0] : raw;
}

describe("wikiacc backend api", () => {
  let app;
  let adminCookie;
  let customOrderId;
  let ticketId;
  let userCookie;
  let userId;
  let instantProduct;
  let emptyInstantProduct;
  let customProduct;
  let initialSiteContent;
  let siteContentDraft;
  let siteContentDraftVersion;
  let latestOtpCode;
  const sentOtpMessages = [];

  beforeAll(async () => {
    app = await buildApp({
      logger: false,
      sendCode: async (_prisma, message) => {
        latestOtpCode = message.code;
        sentOtpMessages.push(message);
      },
    });

    const pool = await app.prisma.deliveryPool.create({
      data: {
        slug: "ready-pool",
        title: "Ready Pool",
        items: {
          create: [
            { content: "READY-CODE-1" },
            { content: "READY-CODE-2" },
          ],
        },
      },
    });

    instantProduct = await app.prisma.product.create({
      data: {
        slug: "ready-product",
        title: "Ready Product",
        type: "INSTANT_DELIVERY",
        price: 100,
        deliveryPoolId: pool.id,
      },
    });

    const emptyPool = await app.prisma.deliveryPool.create({
      data: {
        slug: "empty-pool",
        title: "Empty Pool",
      },
    });

    emptyInstantProduct = await app.prisma.product.create({
      data: {
        slug: "empty-product",
        title: "Empty Product",
        type: "INSTANT_DELIVERY",
        price: 100,
        deliveryPoolId: emptyPool.id,
      },
    });

    customProduct = await app.prisma.product.create({
      data: {
        slug: "custom-product",
        title: "Custom Product",
        type: "CUSTOM_FORM",
        price: 50,
        features: {
          create: [
            { title: "Fast activation", sortOrder: 0 },
            { title: "Supported", sortOrder: 1 },
          ],
        },
        fields: {
          create: [
            {
              key: "account_email",
              label: "Account Email",
              type: "EMAIL",
              required: true,
            },
          ],
        },
      },
    });

    await app.prisma.user.create({
      data: {
        email: "admin@test.local",
        name: "Admin",
        role: "ADMIN",
        passwordHash: await bcrypt.hash("password123", 12),
        wallet: { create: { balance: 0 } },
      },
    });
  });

  afterAll(async () => {
    await app.close();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it("returns product display features in catalog order", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/products",
    });

    expect(response.statusCode).toBe(200);
    const product = response.json().data.products.find(
      (item) => item.id === customProduct.id,
    );
    expect(product.features.map((feature) => feature.title)).toEqual([
      "Fast activation",
      "Supported",
    ]);
  });

  it("returns available delivery inventory for invoice availability", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/products",
    });

    expect(response.statusCode).toBe(200);
    const products = response.json().data.products;
    expect(
      products.find((product) => product.id === instantProduct.id).deliveryPool
        ._count.items,
    ).toBe(2);
    expect(
      products.find((product) => product.id === emptyInstantProduct.id).deliveryPool
        ._count.items,
    ).toBe(0);
  });

  it("allows CORS preflight for PATCH admin actions", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/admin/orders/test-order/status",
      headers: {
        "access-control-request-method": "PATCH",
        origin: "http://localhost:3000",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("registers with a one-time code and blocks duplicate sends while it is valid", async () => {
    const requestResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/request",
      payload: {
        mode: "register",
        email: "user@test.local",
        name: "Test User",
        phone: "۰۹۱۲۰۰۰۰۰۰۱",
      },
    });

    expect(requestResponse.statusCode).toBe(201);
    expect(sentOtpMessages.at(-1)).toMatchObject({
      recipient: "09120000001",
    });
    const challenge = requestResponse.json().data.challenge;
    expect(challenge.retryAfterSeconds).toBe(60);
    expect(challenge.maskedPhone).toBe("0912***0001");
    const storedChallenge = await app.prisma.authOtpChallenge.findUnique({
      where: { id: challenge.challengeId },
    });
    expect(storedChallenge.codeHash).toHaveLength(64);
    expect(storedChallenge.codeHash).not.toContain(latestOtpCode);

    const duplicateResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/request",
      payload: {
        mode: "register",
        email: "user@test.local",
        name: "Test User",
        phone: "09120000001",
      },
    });
    expect(duplicateResponse.statusCode).toBe(429);
    expect(duplicateResponse.json().error.code).toBe("OTP_ALREADY_SENT");
    expect(duplicateResponse.headers["retry-after"]).toBeTruthy();
    expect(sentOtpMessages).toHaveLength(1);

    const wrongCode = latestOtpCode === "000000" ? "999999" : "000000";

    const wrongCodeResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/verify",
      payload: { challengeId: challenge.challengeId, code: wrongCode },
    });
    expect(wrongCodeResponse.statusCode).toBe(401);
    expect(wrongCodeResponse.json().error).toMatchObject({
      code: "OTP_INVALID",
      details: { attemptsRemaining: 4 },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/verify",
      payload: { challengeId: challenge.challengeId, code: latestOtpCode },
    });
    expect(response.statusCode).toBe(200);
    userCookie = getCookie(response);
    const body = response.json();
    userId = body.data.user.id;
    expect(body.data.user).toMatchObject({
      email: "user@test.local",
      hasPassword: false,
      phone: "09120000001",
    });

    const wallet = await app.prisma.wallet.findUnique({ where: { userId } });
    expect(wallet.balance).toBe(0);
  });

  it("invalidates an OTP after five failed attempts", async () => {
    const requestResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/request",
      payload: {
        mode: "checkout",
        name: "Locked User",
        phone: "09120000002",
      },
    });
    const challengeId = requestResponse.json().data.challenge.challengeId;
    const correctCode = latestOtpCode;
    const wrongCode = correctCode === "111111" ? "222222" : "111111";

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/otp/verify",
        payload: { challengeId, code: wrongCode },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe(
        attempt === 5 ? "OTP_ATTEMPTS_EXCEEDED" : "OTP_INVALID",
      );
    }

    const correctResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/verify",
      payload: { challengeId, code: correctCode },
    });
    expect(correctResponse.statusCode).toBe(400);
    expect(correctResponse.json().error.code).toBe("OTP_EXPIRED");
  });

  it("rejects expired OTPs and rate-limits repeated hourly sends", async () => {
    const requestResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/request",
      payload: {
        mode: "checkout",
        name: "Expired User",
        phone: "09120000004",
      },
    });
    const challengeId = requestResponse.json().data.challenge.challengeId;
    const expiredCode = latestOtpCode;
    await app.prisma.authOtpChallenge.update({
      where: { id: challengeId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const expiredResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/verify",
      payload: { challengeId, code: expiredCode },
    });
    expect(expiredResponse.statusCode).toBe(400);
    expect(expiredResponse.json().error.code).toBe("OTP_EXPIRED");

    const now = new Date();
    await app.prisma.authOtpChallenge.createMany({
      data: Array.from({ length: 5 }, (_, index) => ({
        codeHash: `rate-limit-hash-${index}`,
        expiresAt: new Date(now.getTime() - 1000),
        id: `hourly-rate-${index}`,
        invalidatedAt: now,
        phone: "09120000005",
        purpose: "REGISTER",
        registrationName: "Rate Limited User",
        requestIpHash: "different-ip-hash",
        sentAt: now,
      })),
    });

    const sentCount = sentOtpMessages.length;
    const limitedResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/otp/request",
      payload: {
        mode: "checkout",
        name: "Rate Limited User",
        phone: "09120000005",
      },
    });
    expect(limitedResponse.statusCode).toBe(429);
    expect(limitedResponse.json().error.code).toBe("OTP_RATE_LIMITED");
    expect(sentOtpMessages).toHaveLength(sentCount);
  });

  it("lets a signed-in user set an optional password", async () => {
    const setPasswordResponse = await app.inject({
      method: "PATCH",
      url: "/api/v1/auth/password",
      headers: { cookie: userCookie },
      payload: { password: "new-password-123" },
    });
    expect(setPasswordResponse.statusCode).toBe(200);
    expect(setPasswordResponse.json().data.user.hasPassword).toBe(true);

    const passwordLoginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "09120000001",
        password: "new-password-123",
      },
    });
    expect(passwordLoginResponse.statusCode).toBe(200);
    userCookie = getCookie(passwordLoginResponse);
  });

  it("allows admin to credit wallet", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "admin@test.local",
        password: "password123",
      },
    });
    adminCookie = getCookie(login);

    const response = await app.inject({
      method: "POST",
      url: `/api/v1/admin/wallet/users/${userId}/credit`,
      headers: { cookie: adminCookie },
      payload: { amount: 1000, note: "test credit" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.wallet.balance).toBe(1000);
  });

  it("lets admins configure SMS credentials and sender lines without exposing secrets", async () => {
    const anonymousResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/sms/settings",
    });
    expect(anonymousResponse.statusCode).toBe(401);

    const settingsResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/sms/settings",
      headers: { cookie: adminCookie },
    });
    expect(settingsResponse.statusCode).toBe(200);
    const initialSettings = settingsResponse.json().data.settings;
    expect(initialSettings.hasApiKey).toBe(false);
    expect(initialSettings.authPatternCode).toBe("a5gPP4cwpS");
    expect(initialSettings.senders.map((sender) => sender.lineNumber)).toEqual([
      "50002178584000",
      "PRO",
    ]);

    const proSender = initialSettings.senders.find(
      (sender) => sender.lineNumber === "PRO",
    );
    const updateResponse = await app.inject({
      method: "PATCH",
      url: "/api/v1/admin/sms/settings",
      headers: { cookie: adminCookie },
      payload: {
        apiKey: "test-iranpayamak-api-key-1234",
        authPatternCode: "LOGIN_PATTERN",
        defaultSenderId: proSender.id,
      },
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().data.settings).toMatchObject({
      apiKeyHint: "1234",
      authPatternCode: "LOGIN_PATTERN",
      defaultSenderId: proSender.id,
      hasApiKey: true,
    });
    expect(updateResponse.json().data.settings.apiKey).toBeUndefined();

    const storedSettings = await app.prisma.smsProviderSettings.findUnique({
      where: { id: "iranpayamak" },
    });
    expect(storedSettings.apiKeyEncrypted).not.toContain(
      "test-iranpayamak-api-key-1234",
    );

    const deleteDefaultSenderResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/sms/senders/${proSender.id}`,
      headers: { cookie: adminCookie },
    });
    expect(deleteDefaultSenderResponse.statusCode).toBe(409);
    expect(deleteDefaultSenderResponse.json().error.code).toBe(
      "SMS_DEFAULT_SENDER_REQUIRED",
    );

    const createSenderResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/sms/senders",
      headers: { cookie: adminCookie },
      payload: { label: "Backup line", lineNumber: "50001234" },
    });
    expect(createSenderResponse.statusCode).toBe(201);

    const senderId = createSenderResponse.json().data.sender.id;
    const deleteSenderResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/sms/senders/${senderId}`,
      headers: { cookie: adminCookie },
    });
    expect(deleteSenderResponse.statusCode).toBe(200);
  });

  it("sends pattern SMS through the configured default sender", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: "success",
          data: 987654,
          messages: "queued",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 201,
        },
      ),
    );

    const result = await sendPatternSms(
      app.prisma,
      {
        attributes: { code: "2468", name: "Test User" },
        patternCode: "WELCOME_PATTERN",
        recipient: "09120000000",
      },
      { fetchImpl },
    );

    expect(result).toMatchObject({
      provider: "IRANPAYAMAK",
      providerMessageId: 987654,
      sender: { lineNumber: "PRO" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.iranpayamak.com/ws/v1/sms/pattern");
    expect(request.headers["Api-Key"]).toBe(
      "test-iranpayamak-api-key-1234",
    );
    expect(JSON.parse(request.body)).toEqual({
      attributes: { code: "2468", name: "Test User" },
      code: "WELCOME_PATTERN",
      line_number: "PRO",
      number_format: "english",
      recipient: "09120000000",
    });
  });

  it("uses the admin-configured authentication pattern for OTP messages", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ status: "success", data: 246810, messages: "queued" }),
        { headers: { "Content-Type": "application/json" }, status: 201 },
      ),
    );

    await sendAuthCodeSms(
      app.prisma,
      { code: "654321", recipient: "09120000003" },
      { fetchImpl },
    );

    const [, request] = fetchImpl.mock.calls[0];
    expect(JSON.parse(request.body)).toMatchObject({
      attributes: { code: "654321" },
      code: "LOGIN_PATTERN",
      recipient: "09120000003",
    });
  });

  it("serves published site content and protects the admin document", async () => {
    const publicResponse = await app.inject({
      method: "GET",
      url: "/api/v1/site-content",
    });

    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.json().data.version).toBe(1);
    initialSiteContent = publicResponse.json().data.content;
    expect(initialSiteContent.hero.title).toBeTruthy();

    const anonymousResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/site-content",
    });
    expect(anonymousResponse.statusCode).toBe(401);

    const userResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/site-content",
      headers: { cookie: userCookie },
    });
    expect(userResponse.statusCode).toBe(403);

    const adminResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/site-content",
      headers: { cookie: adminCookie },
    });
    expect(adminResponse.statusCode).toBe(200);
    const adminContent = adminResponse.json().data;
    expect(adminContent.content).toEqual(initialSiteContent);
    expect(adminContent.published).toEqual(initialSiteContent);
    expect(adminContent.hasUnpublishedChanges).toBe(false);
    siteContentDraft = adminContent.content;
    siteContentDraftVersion = adminContent.draftVersion;
  });

  it("keeps draft site content private", async () => {
    const draft = structuredClone(siteContentDraft);
    draft.hero.title = "Private draft homepage title";

    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/site-content/draft",
      headers: { cookie: adminCookie },
      payload: {
        content: draft,
        expectedVersion: siteContentDraftVersion,
      },
    });

    expect(response.statusCode).toBe(200);
    const result = response.json().data;
    expect(result.content.hero.title).toBe("Private draft homepage title");
    expect(result.published.hero.title).toBe(initialSiteContent.hero.title);
    expect(result.draftVersion).toBe(siteContentDraftVersion + 1);
    expect(result.hasUnpublishedChanges).toBe(true);
    siteContentDraft = result.content;
    siteContentDraftVersion = result.draftVersion;

    const publicResponse = await app.inject({
      method: "GET",
      url: "/api/v1/site-content",
    });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.json().data.content.hero.title).toBe(
      initialSiteContent.hero.title,
    );
  });

  it("rejects invalid or HTML site content", async () => {
    const invalid = structuredClone(siteContentDraft);
    invalid.hero.title = "<strong>Unsafe title</strong>";

    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/site-content/draft",
      headers: { cookie: adminCookie },
      payload: {
        content: invalid,
        expectedVersion: siteContentDraftVersion,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");

    const currentResponse = await app.inject({
      method: "GET",
      url: "/api/v1/admin/site-content",
      headers: { cookie: adminCookie },
    });
    expect(currentResponse.json().data.draftVersion).toBe(
      siteContentDraftVersion,
    );
  });

  it("rejects stale site content versions", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/site-content/draft",
      headers: { cookie: adminCookie },
      payload: {
        content: siteContentDraft,
        expectedVersion: siteContentDraftVersion - 1,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe(
      "SITE_CONTENT_VERSION_CONFLICT",
    );
    expect(response.json().error.details.currentVersion).toBe(
      siteContentDraftVersion,
    );
  });

  it("publishes the current draft atomically", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/admin/site-content/publish",
      headers: { cookie: adminCookie },
      payload: { expectedVersion: siteContentDraftVersion },
    });

    expect(response.statusCode).toBe(200);
    const result = response.json().data;
    expect(result.published).toEqual(siteContentDraft);
    expect(result.hasUnpublishedChanges).toBe(false);

    const publicResponse = await app.inject({
      method: "GET",
      url: "/api/v1/site-content",
    });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.json().data.content.hero.title).toBe(
      "Private draft homepage title",
    );
    expect(publicResponse.json().data.version).toBe(result.publishedVersion);

    const repeatedPublish = await app.inject({
      method: "POST",
      url: "/api/v1/admin/site-content/publish",
      headers: { cookie: adminCookie },
      payload: { expectedVersion: siteContentDraftVersion },
    });
    expect(repeatedPublish.statusCode).toBe(200);
    expect(repeatedPublish.json().data.publishedVersion).toBe(
      result.publishedVersion,
    );
  });

  it("resets an unpublished draft to the published content", async () => {
    const discardedDraft = structuredClone(siteContentDraft);
    discardedDraft.hero.title = "Discard this title";

    const saveResponse = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/site-content/draft",
      headers: { cookie: adminCookie },
      payload: {
        content: discardedDraft,
        expectedVersion: siteContentDraftVersion,
      },
    });
    expect(saveResponse.statusCode).toBe(200);
    const saved = saveResponse.json().data;
    expect(saved.hasUnpublishedChanges).toBe(true);

    const resetResponse = await app.inject({
      method: "POST",
      url: "/api/v1/admin/site-content/reset-draft",
      headers: { cookie: adminCookie },
      payload: { expectedVersion: saved.draftVersion },
    });
    expect(resetResponse.statusCode).toBe(200);
    const reset = resetResponse.json().data;
    expect(reset.content).toEqual(reset.published);
    expect(reset.content.hero.title).toBe("Private draft homepage title");
    expect(reset.draftVersion).toBe(saved.draftVersion + 1);
    expect(reset.hasUnpublishedChanges).toBe(false);
  });

  it("blocks an empty delivery pool without charging the wallet", async () => {
    const walletBefore = await app.prisma.wallet.findUnique({ where: { userId } });
    const orderCountBefore = await app.prisma.order.count({ where: { userId } });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: userCookie },
      payload: {
        productId: emptyInstantProduct.id,
        quantity: 1,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe("OUT_OF_STOCK");
    expect(await app.prisma.wallet.findUnique({ where: { userId } })).toMatchObject({
      balance: walletBefore.balance,
    });
    expect(await app.prisma.order.count({ where: { userId } })).toBe(
      orderCountBefore,
    );
  });

  it("creates an instant delivery order and consumes one ready item", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: userCookie },
      payload: {
        productId: instantProduct.id,
        quantity: 1,
      },
    });

    expect(response.statusCode).toBe(201);
    const order = response.json().data.order;
    expect(order.status).toBe("DELIVERED");
    expect(order.items[0].deliveries[0].contentSnapshot).toBe("READY-CODE-1");

    const availableCount = await app.prisma.deliveryItem.count({
      where: { status: "AVAILABLE" },
    });
    expect(availableCount).toBe(1);
  });

  it("creates a custom form order and stores customer fields", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: userCookie },
      payload: {
        productId: customProduct.id,
        fieldValues: { account_email: "customer@example.com" },
      },
    });

    expect(response.statusCode).toBe(201);
    const order = response.json().data.order;
    customOrderId = order.id;
    expect(order.status).toBe("AWAITING_ADMIN");
    expect(order.items[0].fieldValues[0].value).toBe("customer@example.com");
  });

  it("allows admin to update order status and keep admin note internal", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/orders/${customOrderId}/status`,
      headers: { cookie: adminCookie },
      payload: {
        adminNote: "Prepared manually",
        status: "READY",
      },
    });

    expect(response.statusCode).toBe(200);
    const order = response.json().data.order;
    expect(order.status).toBe("READY");
    expect(order.adminNote).toBe("Prepared manually");
    expect(order.items[0].fieldValues[0].value).toBe("customer@example.com");

    const userResponse = await app.inject({
      method: "GET",
      url: `/api/v1/orders/${customOrderId}`,
      headers: { cookie: userCookie },
    });
    expect(userResponse.statusCode).toBe(200);
    expect(userResponse.json().data.order.adminNote).toBeUndefined();
  });

  it("creates a ticket for the user", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/tickets",
      headers: { cookie: userCookie },
      payload: {
        subject: "Need help",
        body: "Please check my order.",
      },
    });

    expect(response.statusCode).toBe(201);
    const ticket = response.json().data.ticket;
    ticketId = ticket.id;
    expect(ticket.messages[0].body).toBe("Please check my order.");
  });

  it("allows admin to update ticket status and returns ticket details", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/tickets/${ticketId}/status`,
      headers: { cookie: adminCookie },
      payload: { status: "CLOSED" },
    });

    expect(response.statusCode).toBe(200);
    const ticket = response.json().data.ticket;
    expect(ticket.status).toBe("CLOSED");
    expect(ticket.user.email).toBe("user@test.local");
    expect(ticket.messages[0].body).toBe("Please check my order.");
  });

  it("deletes a product immediately when it has no orders", async () => {
    const product = await app.prisma.product.create({
      data: {
        slug: "unused-product",
        title: "Unused Product",
        type: "CUSTOM_FORM",
        price: 10,
      },
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${product.id}`,
      headers: { cookie: adminCookie },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.action).toBe("DELETED");
    expect(
      await app.prisma.product.findUnique({ where: { id: product.id } }),
    ).toBeNull();
  });

  it("archives a purchased product and allows restoring it", async () => {
    const archiveResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/products/${customProduct.id}`,
      headers: { cookie: adminCookie },
    });

    expect(archiveResponse.statusCode).toBe(200);
    expect(archiveResponse.json().data.action).toBe("ARCHIVED");
    expect(archiveResponse.json().data.product.isActive).toBe(false);
    expect(archiveResponse.json().data.product.archivedAt).toBeTruthy();

    const catalogResponse = await app.inject({
      method: "GET",
      url: "/api/v1/products",
    });
    expect(
      catalogResponse
        .json()
        .data.products.some((product) => product.id === customProduct.id),
    ).toBe(false);

    const restoreResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/admin/products/${customProduct.id}/active`,
      headers: { cookie: adminCookie },
      payload: { isActive: true },
    });

    expect(restoreResponse.statusCode).toBe(200);
    expect(restoreResponse.json().data.product.isActive).toBe(true);
    expect(restoreResponse.json().data.product.archivedAt).toBeNull();
  });

  it("only deletes a category when no product is connected", async () => {
    const category = await app.prisma.productCategory.create({
      data: { slug: "connected-category", title: "Connected Category" },
    });
    await app.prisma.product.update({
      where: { id: instantProduct.id },
      data: { categoryId: category.id },
    });

    const blockedResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/categories/${category.id}`,
      headers: { cookie: adminCookie },
    });

    expect(blockedResponse.statusCode).toBe(409);
    expect(blockedResponse.json().error.code).toBe("CATEGORY_HAS_PRODUCTS");

    await app.prisma.product.update({
      where: { id: instantProduct.id },
      data: { categoryId: null },
    });
    const deletedResponse = await app.inject({
      method: "DELETE",
      url: `/api/v1/admin/categories/${category.id}`,
      headers: { cookie: adminCookie },
    });

    expect(deletedResponse.statusCode).toBe(200);
    expect(deletedResponse.json().data.categoryId).toBe(category.id);
  });
});
