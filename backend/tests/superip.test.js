import { execFileSync } from "node:child_process";
import { unlinkSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = `file:./superip-test-${process.pid}.db`;
process.env.JWT_SECRET = "superip-test-jwt-secret-long-enough";
process.env.SMS_CONFIG_ENCRYPTION_KEY =
  "superip-test-encryption-key-long-enough";
execFileSync(process.execPath, ["scripts/apply-schema.js"], {
  env: process.env,
  stdio: "inherit",
});
const { buildApp } = await import("../src/app.js");
const { env } = await import("../src/config/env.js");
let app, adminCookie, userCookie, user;
const endpoint = "https://reseller.superip-app.com/api/reseller/wallet-webhook";
const secret = "test-superip-webhook-secret-with-32-chars";
beforeAll(async () => {
  app = await buildApp({ logger: false, enableJibitReconciliation: false });
  const admin = await app.prisma.user.create({
    data: { name: "Admin", role: "ADMIN" },
  });
  user = await app.prisma.user.create({
    data: { name: "Customer", wallet: { create: { balance: 500000 } } },
  });
  adminCookie = `${env.SESSION_COOKIE_NAME}=${app.jwt.sign({ id: admin.id, role: "ADMIN" })}`;
  userCookie = `${env.SESSION_COOKIE_NAME}=${app.jwt.sign({ id: user.id, role: "USER" })}`;
});
afterAll(async () => {
  await app?.close();
  unlinkSync(`prisma/superip-test-${process.pid}.db`);
});
const request = (method, url, payload, cookie = adminCookie) =>
  app.inject({ method, url, payload, headers: { cookie } });
it("variable wallet purchase snapshots recipient and exact amount, validates before debit", async () => {
  await request("PATCH", "/api/v1/admin/superip/settings", {
    enabled: true,
    endpoint,
    secret,
  });
  const product = await app.prisma.product.create({
    data: {
      slug: "superip-credit",
      title: "شارژ نمایندگی",
      type: "SUPERIP_WALLET",
      price: 0,
    },
  });
  const payload = {
    productId: product.id,
    superip: { username: "Agent.One", amount: 12000 },
    expectedUnitPrice: 12000,
  };
  for (const change of [
    { quantity: 2 },
    { superip: { username: "bad user", amount: 12000 } },
    { superip: { username: "agent.one", amount: 0 } },
    { superip: { username: "agent.one", amount: 1.5 } },
    { expectedUnitPrice: 11000 },
  ]) {
    const res = await request(
      "POST",
      "/api/v1/orders",
      { ...payload, ...change },
      userCookie,
    );
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  }
  expect(
    (await app.prisma.wallet.findUnique({ where: { userId: user.id } }))
      .balance,
  ).toBe(500000);
  const response = await request("POST", "/api/v1/orders", payload, userCookie);
  expect(response.statusCode, response.body).toBe(201);
  const order = response.json().data.order;
  expect(order.totalAmount).toBe(12000);
  expect(order.status).toBe("READY");
  expect(order.items[0].superipFulfillment.username).toBe("agent.one");
  expect(response.body).not.toContain("secretEncrypted");
  const job = await app.prisma.superipFulfillment.findUnique({
    where: { orderItemId: order.items[0].id },
  });
  expect(job.amount).toBe(12000);
  expect(job.reference).toBe(`gimiacc:${order.items[0].id}`);
  expect(
    (await app.prisma.wallet.findUnique({ where: { userId: user.id } }))
      .balance,
  ).toBe(488000);
});
it("paid-only fulfillment recovers lost response with identical reference and blocks refund after attempt", async () => {
  const { runSuperipBatch } =
    await import("../src/modules/superip/fulfillment.js");
  const job = await app.prisma.superipFulfillment.findFirst();
  const bodies = [];
  let lost = true;
  const client = {
    credit: async (_url, _secret, body) => {
      bodies.push(body);
      if (lost) {
        lost = false;
        throw new Error("lost response");
      }
      return { ...body, status: "credited", receiptId: "receipt-1" };
    },
  };
  const now = new Date();
  await runSuperipBatch(app.prisma, client, { now });
  expect(
    (await app.prisma.superipFulfillment.findUnique({ where: { id: job.id } }))
      .status,
  ).toBe("RETRY");
  const item = await app.prisma.orderItem.findUnique({
    where: { id: job.orderItemId },
  });
  const blocked = await request(
    "POST",
    `/api/v1/admin/orders/${item.orderId}/refund`,
    {},
  );
  expect(blocked.statusCode).toBe(409);
  await Promise.all([
    runSuperipBatch(app.prisma, client, {
      now: new Date(now.getTime() + 60000),
    }),
    runSuperipBatch(app.prisma, client, {
      now: new Date(now.getTime() + 60000),
    }),
  ]);
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(
    (await app.prisma.order.findUnique({ where: { id: item.orderId } })).status,
  ).toBe("DELIVERED");
  expect(
    await app.prisma.orderDelivery.count({ where: { orderItemId: item.id } }),
  ).toBe(1);
  await runSuperipBatch(app.prisma, client);
  expect(bodies).toHaveLength(2);
  const { createPendingJibitOrder } =
    await import("../src/modules/orders/service.js");
  const pending = await createPendingJibitOrder(
    app.prisma,
    user.id,
    {
      productId: item.productId,
      superip: { username: "agent.two", amount: 20000 },
    },
    {
      attemptId: "unpaid-attempt",
      clientReferenceNumber: "unpaid-reference",
      reconcileAfter: now,
    },
  );
  expect(pending.attempt.providerAmountRial).toBe(200000);
  await runSuperipBatch(app.prisma, client);
  expect(bodies).toHaveLength(2);
  expect(
    (
      await request("PATCH", "/api/v1/admin/superip/settings", {
        enabled: true,
        endpoint: "https://other.example/api/reseller/wallet-webhook",
      })
    ).statusCode,
  ).toBe(409);
});
it("admin creates variable credit product with descriptions and features, not static pricing", async () => {
  const response = await request("POST", "/api/v1/admin/products", {
    slug: "superip-public",
    title: "شارژ کیف پول",
    description: "توضیحات محصول",
    type: "SUPERIP_WALLET",
    basePrice: "0",
    features: [{ title: "شارژ خودکار" }],
    fields: [],
  });
  expect(response.statusCode, response.body).toBe(201);
  expect(response.json().data.product.type).toBe("SUPERIP_WALLET");
  const invalid = await request("POST", "/api/v1/admin/products", {
    slug: "superip-bad",
    title: "Invalid",
    type: "SUPERIP_WALLET",
    basePrice: "500",
    profit: "10%",
  });
  expect(invalid.statusCode).toBe(400);
});
it("HTTP client sends exact immutable body, refuses redirects and redacts upstream failures", async () => {
  const { createSuperipClient } =
    await import("../src/modules/superip/client.js");
  let sent;
  const body = {
    reference: "wikiacc:one",
    username: "agent.one",
    amount: 1000,
  };
  const client = createSuperipClient({
    fetchImpl: async (url, options) => {
      sent = { url, ...options };
      return new Response(
        JSON.stringify({ ...body, status: "credited", receiptId: "receipt" }),
        { status: 201 },
      );
    },
  });
  expect((await client.credit(endpoint, secret, body)).status).toBe("credited");
  expect(sent.redirect).toBe("error");
  expect(JSON.parse(sent.body)).toEqual(body);
  expect(sent.headers.Authorization).toBe(`Bearer ${secret}`);
  const failed = createSuperipClient({
    fetchImpl: async () => new Response(secret, { status: 401 }),
  });
  await expect(failed.credit(endpoint, secret, body)).rejects.toMatchObject({
    code: "HTTP_401",
  });
});
it("product minimum is configurable, public and enforced before wallet or direct payment", async () => {
  const made = await request("POST", "/api/v1/admin/products", {slug:"minimum-credit",title:"Minimum credit",type:"SUPERIP_WALLET",basePrice:"0",superipMinAmount:2000000});
  expect(made.statusCode,made.body).toBe(201);
  const product=made.json().data.product;
  expect(product.superipMinAmount).toBe(2000000);
  const publicRead=await request("GET",`/api/v1/products/${product.slug}`);
  expect(publicRead.json().data.product.superipMinAmount).toBe(2000000);
  for(const value of [0,999,1.5,200000001,null]) expect((await request("PATCH",`/api/v1/admin/products/${product.id}`,{superipMinAmount:value})).statusCode).toBe(400);
  const payload={productId:product.id,superip:{username:"agent.min",amount:1999999},expectedUnitPrice:1999999};
  const before=await app.prisma.wallet.findUnique({where:{userId:user.id}});
  const rejected=await request("POST","/api/v1/orders",payload,userCookie);
  expect(rejected.statusCode).toBe(400);
  expect(rejected.json().error.code).toBe("SUPERIP_BELOW_MINIMUM");
  expect((await app.prisma.wallet.findUnique({where:{userId:user.id}})).balance).toBe(before.balance);
  const {createPendingJibitOrder}=await import("../src/modules/orders/service.js");
  const attempt={attemptId:"minimum-attempt",clientReferenceNumber:"minimum-reference",reconcileAfter:new Date()};
  await expect(createPendingJibitOrder(app.prisma,user.id,payload,attempt)).rejects.toMatchObject({code:"SUPERIP_BELOW_MINIMUM"});
  const pending=await createPendingJibitOrder(app.prisma,user.id,{...payload,superip:{username:"agent.min",amount:2000000},expectedUnitPrice:2000000},attempt);
  expect(pending.attempt.providerAmountRial).toBe(20000000);
  expect((await request("PATCH",`/api/v1/admin/products/${product.id}`,{superipMinAmount:3000000})).json().data.product.superipMinAmount).toBe(3000000);
  expect((await request("PATCH",`/api/v1/admin/products/${product.id}`,{title:"Renamed minimum"})).json().data.product.superipMinAmount).toBe(3000000);
  const frozen=await app.prisma.superipFulfillment.findFirst({where:{orderItem:{productId:product.id}}});
  expect(frozen.amount).toBe(2000000);
  await request("PATCH",`/api/v1/admin/products/${product.id}`,{superipMinAmount:2000000});
  await app.prisma.wallet.update({where:{userId:user.id},data:{balance:3000000}});
  const bought=await request("POST","/api/v1/orders",{...payload,superip:{username:"agent.min",amount:2000000},expectedUnitPrice:2000000},userCookie);
  expect(bought.statusCode,bought.body).toBe(201);
  expect(bought.json().data.order.totalAmount).toBe(2000000);
});
it("admin-only webhook settings encrypt secret and never expose it", async () => {
  const url = "/api/v1/admin/superip/settings";
  expect((await request("GET", url, undefined, userCookie)).statusCode).toBe(
    403,
  );
  const response = await request("PATCH", url, {
    enabled: true,
    endpoint,
    secret,
  });
  expect(response.statusCode).toBe(200);
  expect(response.body).not.toContain(secret);
  expect(response.json().data.settings.configured).toBe(true);
  const saved = await app.prisma.superipSettings.findUnique({
    where: { id: "default" },
  });
  expect(saved.secretEncrypted).not.toContain(secret);
});
