import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
const testDatabaseName = `test-${process.pid}.db`;
process.env.DATABASE_URL = `file:./${testDatabaseName}`;
process.env.JWT_SECRET = "test-secret-with-enough-length";
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
  let customProduct;

  beforeAll(async () => {
    app = await buildApp({ logger: false });

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

  it("registers a user and creates a wallet", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        email: "user@test.local",
        name: "Test User",
        password: "password123",
      },
    });

    expect(response.statusCode).toBe(201);
    userCookie = getCookie(response);
    const body = response.json();
    userId = body.data.user.id;

    const wallet = await app.prisma.wallet.findUnique({ where: { userId } });
    expect(wallet.balance).toBe(0);
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
