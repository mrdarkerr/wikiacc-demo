import { ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import { getWalletSummary } from "./service.js";
import { z } from "zod";

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(50).default(10),
});

function paginationMeta(page, perPage, total) {
  return {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function walletRoutes(app) {
  app.get("/me", { preHandler: app.authenticate }, async (request, reply) => {
    const query = parse(paginationQuerySchema, request.query);
    const summary = await getWalletSummary(app.prisma, request.user.id, query);
    return ok(
      reply,
      { wallet: summary.wallet, transactions: summary.transactions },
      paginationMeta(query.page, query.perPage, summary.total),
    );
  });

  app.get("/transactions", { preHandler: app.authenticate }, async (request, reply) => {
    const query = parse(paginationQuerySchema, request.query);
    const summary = await getWalletSummary(app.prisma, request.user.id, query);
    return ok(
      reply,
      { transactions: summary.transactions },
      paginationMeta(query.page, query.perPage, summary.total),
    );
  });
}
