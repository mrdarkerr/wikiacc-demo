import { ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import {
  getSettings,
  publicSettings,
  saveSettings,
  settingsInput,
} from "./settings.js";
export async function adminSuperipRoutes(app) {
  app.addHook("preHandler", app.requireAdmin);
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });
  app.get("/settings", async (_request, reply) =>
    ok(reply, { settings: publicSettings(await getSettings(app.prisma)) }),
  );
  app.patch("/settings", async (request, reply) =>
    ok(reply, {
      settings: await saveSettings(
        app.prisma,
        parse(settingsInput, request.body),
      ),
    }),
  );
}
