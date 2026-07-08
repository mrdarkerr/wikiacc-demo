import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import fp from "fastify-plugin";

import { env } from "../config/env.js";
import { forbidden, unauthorized } from "../shared/errors.js";

const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

export const authPlugin = fp(async (app) => {
  await app.register(cookie);
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: {
      cookieName: env.SESSION_COOKIE_NAME,
      signed: false,
    },
  });

  app.decorate("setSessionCookie", (reply, token) => {
    reply.setCookie(env.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      maxAge: sessionMaxAgeSeconds,
      path: "/",
      sameSite: "lax",
      secure: env.COOKIE_SECURE,
    });
  });

  app.decorate("clearSessionCookie", (reply) => {
    reply.clearCookie(env.SESSION_COOKIE_NAME, { path: "/" });
  });

  app.decorate("authenticate", async (request) => {
    try {
      const payload = await request.jwtVerify();
      request.user = payload;
    } catch {
      throw unauthorized();
    }
  });

  app.decorate("requireAdmin", async (request) => {
    await app.authenticate(request);
    if (request.user.role !== "ADMIN") {
      throw forbidden("Admin access is required");
    }
  });
});
