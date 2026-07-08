import { ok } from "../../shared/http/reply.js";
import { getWalletSummary } from "./service.js";

export async function walletRoutes(app) {
  app.get("/me", { preHandler: app.authenticate }, async (request, reply) => {
    const summary = await getWalletSummary(app.prisma, request.user.id);
    return ok(reply, summary);
  });

  app.get("/transactions", { preHandler: app.authenticate }, async (request, reply) => {
    const summary = await getWalletSummary(app.prisma, request.user.id);
    return ok(reply, { transactions: summary.transactions });
  });
}
