import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

export const swaggerPlugin = fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      components: { securitySchemes: { adminSession: { type: "apiKey", in: "cookie", name: "wikiacc_session", description: "Existing authenticated ADMIN session" } } },
      info: {
        title: "WikiAcc Backend API",
        version: "0.1.0",
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });
});
