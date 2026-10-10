import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";
import { env } from "../config/env.js";

export const swaggerPlugin = fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      components: { securitySchemes: { adminSession: { type: "apiKey", in: "cookie", name: env.SESSION_COOKIE_NAME, description: "Existing authenticated ADMIN session" } } },
      info: {
        title: "GimiAcc Backend API",
        version: "0.1.0",
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });
});
