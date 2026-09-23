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
import { adminTelegramRoutes } from "./modules/telegram/admin-routes.js";
import { startTelegramQueueWorker } from "./modules/telegram/queue.js";
import { adminSmsRoutes } from "./modules/sms/admin-routes.js";
import { startSmsQueueWorker } from "./modules/sms/queue.js";
import { adminShareboxRoutes } from "./modules/sharebox/admin-routes.js";
import { createShareboxClient } from "./modules/sharebox/client.js";
import { startShareboxFulfillmentWorker } from "./modules/sharebox/fulfillment.js";
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

  const shareboxBaseUrl = options.shareboxBaseUrl ?? env.SHAREBOX_BASE_URL;
  const shareboxClient =
    options.shareboxClient ??
    createShareboxClient({
      baseUrl: shareboxBaseUrl,
      fetchImpl: options.shareboxFetch,
      nodeEnv: env.NODE_ENV,
      timeoutMs:
        options.shareboxRequestTimeoutMs ?? env.SHAREBOX_REQUEST_TIMEOUT_MS,
    });

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
    shareboxBaseUrl: shareboxClient.origin,
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
  await app.register(adminRoutes, {
    prefix: "/api/v1/admin",
    shareboxClient,
  });
  await app.register(adminShareboxRoutes, {
    prefix: "/api/v1/admin/sharebox",
    client: shareboxClient,
  });
  await app.register(adminSmsRoutes, { prefix: "/api/v1/admin/sms" });
  const telegramClientOptions = { fetchImpl: options.telegramFetch, timeoutMs: env.TELEGRAM_REQUEST_TIMEOUT_MS };
  await app.register(adminTelegramRoutes, { prefix: "/api/v1/admin/telegram", clientOptions: telegramClientOptions });
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

  const telegramWorkerOptions = options.telegramWorkerOptions ?? {};
  if (telegramWorkerOptions.enabled ?? env.NODE_ENV !== "test") {
    const worker = startTelegramQueueWorker(app.prisma, {
      ...telegramClientOptions, intervalMs: env.TELEGRAM_WORKER_INTERVAL_SECONDS * 1000,
      webAppUrl: options.webAppUrl ?? env.WEB_APP_URL, ...telegramWorkerOptions, logger: app.log,
    });
    app.addHook("onClose", () => worker.stop());
  }

  const smsQueueOptions = options.smsQueueOptions ?? {};
  const smsQueueEnabled =
    smsQueueOptions.enabled ?? env.NODE_ENV !== "test";
  if (smsQueueEnabled) {
    const smsQueueWorker = startSmsQueueWorker(app.prisma, {
      ...smsQueueOptions,
      logger: smsQueueOptions.logger ?? app.log,
    });
    app.addHook("onClose", async () => {
      await smsQueueWorker.stop();
    });
  }

  const shareboxWorkerOptions = options.shareboxWorkerOptions ?? {};
  const shareboxWorkerEnabled =
    shareboxWorkerOptions.enabled ?? env.NODE_ENV !== "test";
  if (shareboxWorkerEnabled) {
    const shareboxWorker = startShareboxFulfillmentWorker(
      app.prisma,
      shareboxClient,
      {
        ...shareboxWorkerOptions,
        intervalMs:
          shareboxWorkerOptions.intervalMs ??
          env.SHAREBOX_WORKER_INTERVAL_SECONDS * 1_000,
        logger: shareboxWorkerOptions.logger ?? app.log,
      },
    );
    app.decorate("shareboxWorker", shareboxWorker);
    app.addHook("onClose", async () => {
      await shareboxWorker.stop();
    });
  }

  return app;
}
