import { created, noContent, ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import {
  loginSchema,
  requestOtpSchema,
  setPasswordSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from "./schemas.js";
import {
  loginUser,
  publicUser,
  requestOtp,
  setUserPassword,
  updateUserProfile,
  verifyOtp,
} from "./service.js";

function signSession(app, user) {
  return app.jwt.sign({
    sub: user.id,
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
}

function establishSession(app, reply, user) {
  const token = signSession(app, user);
  app.setSessionCookie(reply, token);
}

export async function authRoutes(app, options) {
  app.post(
    "/otp/request",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = parse(requestOtpSchema, request.body);
      const challenge = await requestOtp(app.prisma, input, {
        ip: request.ip,
        sendCode: options.sendCode,
        smsOptions: options.smsOptions,
      });
      return created(reply, { challenge });
    },
  );

  app.post(
    "/otp/verify",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = parse(verifyOtpSchema, request.body);
      const user = await verifyOtp(app.prisma, input);
      establishSession(app, reply, user);
      return ok(reply, { user });
    },
  );

  app.post(
    "/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const input = parse(loginSchema, request.body);
      const user = await loginUser(app.prisma, input);
      establishSession(app, reply, user);
      return ok(reply, { user });
    },
  );

  app.post("/logout", async (_request, reply) => {
    app.clearSessionCookie(reply);
    return noContent(reply);
  });

  app.get("/me", { preHandler: app.authenticate }, async (request, reply) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        passwordHash: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        wallet: { select: { balance: true } },
      },
    });
    return ok(reply, { user: publicUser(user) });
  });

  app.patch("/profile", { preHandler: app.authenticate }, async (request, reply) => {
    const input = parse(updateProfileSchema, request.body);
    const user = await updateUserProfile(app.prisma, request.user.id, input);
    return ok(reply, { user });
  });

  app.patch("/password", { preHandler: app.authenticate }, async (request, reply) => {
    const input = parse(setPasswordSchema, request.body);
    const user = await setUserPassword(app.prisma, request.user.id, input);
    return ok(reply, { user });
  });
}
