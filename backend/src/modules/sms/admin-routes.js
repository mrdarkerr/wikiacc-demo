import { created, ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import {
  createSmsSenderSchema,
  smsSenderIdParamsSchema,
  updateSmsSettingsSchema,
} from "./schemas.js";
import {
  createAdminSmsSender,
  deleteAdminSmsSender,
  getAdminSmsSettings,
  updateAdminSmsSettings,
} from "./service.js";

export async function adminSmsRoutes(app) {
  app.addHook("preHandler", app.requireAdmin);

  app.get("/settings", async (_request, reply) => {
    const settings = await getAdminSmsSettings(app.prisma);
    return ok(reply, { settings });
  });

  app.patch("/settings", async (request, reply) => {
    const input = parse(updateSmsSettingsSchema, request.body);
    const settings = await updateAdminSmsSettings(app.prisma, input);
    return ok(reply, { settings });
  });

  app.post("/senders", async (request, reply) => {
    const input = parse(createSmsSenderSchema, request.body);
    const sender = await createAdminSmsSender(app.prisma, input);
    return created(reply, { sender });
  });

  app.delete("/senders/:id", async (request, reply) => {
    const params = parse(smsSenderIdParamsSchema, request.params);
    await deleteAdminSmsSender(app.prisma, params.id);
    return ok(reply, { senderId: params.id });
  });
}
