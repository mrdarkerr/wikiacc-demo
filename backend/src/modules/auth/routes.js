import { created, noContent, ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import { loginSchema, registerSchema } from "./schemas.js";
import { loginUser, registerUser } from "./service.js";

function signSession(app, user) {
  return app.jwt.sign({
    sub: user.id,
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
}

export async function authRoutes(app) {
  app.post("/register", async (request, reply) => {
    const input = parse(registerSchema, request.body);
    const user = await registerUser(app.prisma, input);
    const token = signSession(app, user);
    app.setSessionCookie(reply, token);
    return created(reply, { user });
  });

  app.post("/login", async (request, reply) => {
    const input = parse(loginSchema, request.body);
    const user = await loginUser(app.prisma, input);
    const token = signSession(app, user);
    app.setSessionCookie(reply, token);
    return ok(reply, { user });
  });

  app.post("/logout", async (request, reply) => {
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
        role: true,
        wallet: { select: { balance: true } },
      },
    });
    return ok(reply, { user });
  });
}
