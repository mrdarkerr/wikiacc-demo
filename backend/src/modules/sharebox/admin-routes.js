import { badGateway, notFound, serviceUnavailable } from "../../shared/errors.js";
import { ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import { ShareboxApiError } from "./client.js";
import {
  getAdminShareboxSettings,
  getShareboxSettings,
  requireShareboxCredential,
  updateAdminShareboxSettings,
} from "./settings.js";
import {
  shareboxCategoriesQuerySchema,
  shareboxSettingsUpdateSchema,
} from "./schemas.js";

function proxyError(error) {
  if (!(error instanceof ShareboxApiError)) return error;
  if (error.statusCode === 401) {
    return serviceUnavailable(
      "SHAREBOX_CREDENTIAL_REJECTED",
      "The configured ShareBox credential was rejected",
    );
  }
  return badGateway(
    "SHAREBOX_UPSTREAM_ERROR",
    "ShareBox is temporarily unavailable",
    error.retryAfterSeconds
      ? { retryAfterSeconds: error.retryAfterSeconds }
      : undefined,
  );
}

export async function resolveShareboxCategory(prisma, client, categoryId) {
  const credential = requireShareboxCredential(await getShareboxSettings(prisma));
  let page = 1;
  do {
    let response;
    try {
      response = await client.listCategories(credential.apiKey, {
        page,
        perPage: 100,
      });
    } catch (error) {
      throw proxyError(error);
    }
    const category = response.data.find((item) => item.id === categoryId);
    if (category) return category;
    if (page >= response.meta.total_pages) break;
    page += 1;
  } while (page <= 1000);

  throw notFound(
    "SHAREBOX_CATEGORY_NOT_FOUND",
    "The selected ShareBox category is not available",
  );
}

export async function adminShareboxRoutes(app, options) {
  app.addHook("preHandler", app.requireAdmin);
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store");
    return payload;
  });

  app.get("/settings", async (_request, reply) => {
    const settings = await getAdminShareboxSettings(
      app.prisma,
      options.client.origin,
    );
    return ok(reply, { settings });
  });

  app.patch("/settings", async (request, reply) => {
    const input = parse(shareboxSettingsUpdateSchema, request.body);
    const settings = await updateAdminShareboxSettings(
      app.prisma,
      input,
      options.client.origin,
    );
    return ok(reply, { settings });
  });

  app.get("/categories", async (request, reply) => {
    const query = parse(shareboxCategoriesQuerySchema, request.query);
    const credential = requireShareboxCredential(
      await getShareboxSettings(app.prisma),
    );
    let result;
    try {
      result = await options.client.listCategories(credential.apiKey, query);
    } catch (error) {
      throw proxyError(error);
    }
    return ok(
      reply,
      { categories: result.data },
      {
        page: result.meta.page,
        perPage: result.meta.page_size,
        total: result.meta.total,
        totalPages: result.meta.total_pages,
      },
    );
  });
}
