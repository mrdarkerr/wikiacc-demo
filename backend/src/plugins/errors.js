import fp from "fastify-plugin";
import { ZodError } from "zod";

import { AppError } from "../shared/errors.js";

export const errorsPlugin = fp(async (app) => {
  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `Route ${request.method} ${request.url} was not found`,
      },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.flatten(),
        },
      });
      return;
    }

    if (error instanceof AppError) {
      reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
      return;
    }

    request.log.error(error);
    reply.code(500).send({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected server error",
      },
    });
  });
});
