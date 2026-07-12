import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";

import { env } from "./config/env.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { catalogRoutes } from "./modules/catalog/routes.js";
import { orderRoutes } from "./modules/orders/routes.js";
import {
  adminSiteContentRoutes,
  siteContentRoutes,
} from "./modules/site-content/routes.js";
import { ticketRoutes } from "./modules/tickets/routes.js";
import { walletRoutes } from "./modules/wallet/routes.js";
import { authPlugin } from "./plugins/auth.js";
import { corsPlugin } from "./plugins/cors.js";
import { errorsPlugin } from "./plugins/errors.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { swaggerPlugin } from "./plugins/swagger.js";

export async function buildApp(options = {}) {
  const app = Fastify({
    logger: options.logger ?? env.NODE_ENV !== "test",
  });

  await app.register(errorsPlugin);
  await app.register(corsPlugin);
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });
  await app.register(prismaPlugin, { prisma: options.prisma });
  await app.register(authPlugin);
  await app.register(swaggerPlugin);

  app.get("/health", async () => ({
    ok: true,
    service: "wikiacc-backend",
  }));

  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(catalogRoutes, { prefix: "/api/v1" });
  await app.register(siteContentRoutes, { prefix: "/api/v1/site-content" });
  await app.register(orderRoutes, { prefix: "/api/v1/orders" });
  await app.register(walletRoutes, { prefix: "/api/v1/wallet" });
  await app.register(ticketRoutes, { prefix: "/api/v1/tickets" });
  await app.register(adminRoutes, { prefix: "/api/v1/admin" });
  await app.register(adminSiteContentRoutes, {
    prefix: "/api/v1/admin/site-content",
  });

  return app;
}
