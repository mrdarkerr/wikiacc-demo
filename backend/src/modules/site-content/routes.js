import { ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import {
  getAdminSiteContent,
  getPublishedSiteContent,
  publishSiteContent,
  resetSiteContentDraft,
  saveSiteContentDraft,
} from "./service.js";
import {
  saveSiteContentDraftSchema,
  siteContentVersionSchema,
} from "./schemas.js";

export async function siteContentRoutes(app) {
  app.get("/", async (request, reply) => {
    const content = await getPublishedSiteContent(app.prisma);
    return ok(reply, content);
  });
}

export async function adminSiteContentRoutes(app) {
  app.addHook("preHandler", app.requireAdmin);

  app.get("/", async (request, reply) => {
    const content = await getAdminSiteContent(app.prisma);
    return ok(reply, content);
  });

  app.put("/draft", async (request, reply) => {
    const input = parse(saveSiteContentDraftSchema, request.body);
    const content = await saveSiteContentDraft(
      app.prisma,
      request.user.id,
      input,
    );
    return ok(reply, content);
  });

  app.post("/publish", async (request, reply) => {
    const input = parse(siteContentVersionSchema, request.body);
    const content = await publishSiteContent(
      app.prisma,
      request.user.id,
      input,
    );
    return ok(reply, content);
  });

  app.post("/reset-draft", async (request, reply) => {
    const input = parse(siteContentVersionSchema, request.body);
    const content = await resetSiteContentDraft(
      app.prisma,
      request.user.id,
      input,
    );
    return ok(reply, content);
  });
}
