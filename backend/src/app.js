import Fastify from "fastify";
import formbody from "@fastify/formbody";
import rateLimit from "@fastify/rate-limit";

import { env } from "./config/env.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { catalogRoutes } from "./modules/catalog/routes.js";
import { orderRoutes } from "./modules/orders/routes.js";
import { createJibitClient } from "./modules/payments/jibit-client.js";
import {
  reconcileStaleJibitPayments,
} from "./modules/payments/service.js";
import { paymentRoutes } from "./modules/payments/routes.js";
import {
  adminSiteContentRoutes,
  siteContentRoutes,
} from "./modules/site-content/routes.js";
import { ticketRoutes } from "./modules/tickets/routes.js";
import { walletRoutes } from "./modules/wallet/routes.js";
import { adminSmsRoutes } from "./modules/sms/admin-routes.js";
import { authPlugin } from "./plugins/auth.js";
import { corsPlugin } from "./plugins/cors.js";
import { errorsPlugin } from "./plugins/errors.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { swaggerPlugin } from "./plugins/swagger.js";

function scheduleJibitReconciliation(app, client, options) {
  if (!client || !options.enabled) return;

  let currentRun = null;
  const run = () => {
    if (currentRun) return currentRun;
    currentRun = reconcileStaleJibitPayments(app.prisma, client, {
      logger: app.log,
      reconcileMinutes: options.reconcileMinutes,
    })
      .catch((error) => {
        app.log.error({ err: error }, "Jibit reconciliation cycle failed");
      })
      .finally(() => {
        currentRun = null;
      });
    return currentRun;
  };

  const timer = setInterval(() => {
    void run();
  }, options.intervalSeconds * 1_000);
  timer.unref?.();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    await currentRun;
  });
  void run();
}

export async function buildApp(options = {}) {
  const app = Fastify({
    logger: options.logger ?? env.NODE_ENV !== "test",
  });

  await app.register(errorsPlugin);
  await app.register(corsPlugin);
  await app.register(formbody);
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });
  await app.register(prismaPlugin, { prisma: options.prisma });
  await app.register(authPlugin);
  await app.register(swaggerPlugin);

  const jibitClient =
    options.jibitClient ??
    (env.JIBIT_ENABLED
      ? createJibitClient({
          apiKey: env.JIBIT_API_KEY,
          baseUrl: env.JIBIT_BASE_URL,
          secretKey: env.JIBIT_SECRET_KEY,
        })
      : null);

  app.get("/health", async () => ({
    ok: true,
    service: "wikiacc-backend",
  }));

  await app.register(authRoutes, {
    prefix: "/api/v1/auth",
    sendCode: options.sendCode,
    smsOptions: options.smsOptions,
  });
  await app.register(catalogRoutes, { prefix: "/api/v1" });
  await app.register(siteContentRoutes, { prefix: "/api/v1/site-content" });
  await app.register(orderRoutes, {
    prefix: "/api/v1/orders",
    jibitCallbackUrl: options.jibitCallbackUrl ?? env.JIBIT_CALLBACK_URL,
    jibitClient,
    jibitReconcileMinutes:
      options.jibitReconcileMinutes ?? env.JIBIT_RECONCILE_MINUTES,
  });
  await app.register(paymentRoutes, {
    prefix: "/api/v1/payments",
    jibitClient,
    jibitReconcileMinutes:
      options.jibitReconcileMinutes ?? env.JIBIT_RECONCILE_MINUTES,
    webAppUrl: options.webAppUrl ?? env.WEB_APP_URL,
  });
  await app.register(walletRoutes, { prefix: "/api/v1/wallet" });
  await app.register(ticketRoutes, { prefix: "/api/v1/tickets" });
  await app.register(adminRoutes, { prefix: "/api/v1/admin" });
  await app.register(adminSmsRoutes, { prefix: "/api/v1/admin/sms" });
  await app.register(adminSiteContentRoutes, {
    prefix: "/api/v1/admin/site-content",
  });

  scheduleJibitReconciliation(app, jibitClient, {
    enabled: options.enableJibitReconciliation ?? env.JIBIT_ENABLED,
    intervalSeconds:
      options.jibitReconcileIntervalSeconds ??
      env.JIBIT_RECONCILE_INTERVAL_SECONDS,
    reconcileMinutes:
      options.jibitReconcileMinutes ?? env.JIBIT_RECONCILE_MINUTES,
  });

  return app;
}
