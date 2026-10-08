import { z } from "zod";
import { ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import { getPricingSettings, getEffectiveRate, updatePricingSettings, pricingSettingsSchema } from "../exchange-rates/service.js";
import { checkRateHealth } from "../exchange-rates/alerts.js";
import { prepareProductPricing, quoteProduct } from "./service.js";

const previewSchema = z.object({
  priceCurrency: z.enum(["TOMAN", "USD"]),
  basePrice: z.union([z.string().min(1).max(24), z.number().nonnegative()]),
  profit: z.union([z.string().max(32), z.number().nonnegative()]).optional(),
  quantity: z.number().int().min(1).max(10).default(1),
}).strict();
const docs = (summary, extra = {}) => ({ schema: { tags: ["Admin pricing"], summary, ...extra } });
async function status(prisma) {
  // Also check staleness independently of the polling job when an admin inspects
  // status. A completely offline backend still needs an external monitor.
  const exchangeRate = await prisma.$transaction((tx) => checkRateHealth(tx));
  const jobs = await prisma.scheduledJob.findMany({ where: { name: { in: ["wallex-usd-toman", "exchange-rate-health"] } },
    select: { name: true, nextRunAt: true, leaseExpiresAt: true, lastStartedAt: true, lastFinishedAt: true,
      lastSuccessAt: true, lastErrorCode: true, runCount: true, failureCount: true }, orderBy: { name: "asc" } });
  return { exchangeRate, jobs };
}
export async function adminPricingRoutes(app) {
  app.addHook("preHandler", app.requireAdmin);
  app.addHook("onSend", async (_request, reply, payload) => { reply.header("Cache-Control", "no-store"); return payload; });
  app.get("/pricing/settings", docs("Read fallback rate and freshness/alert thresholds"), async (_request, reply) => ok(reply, { settings: await getPricingSettings(app.prisma) }));
  app.patch("/pricing/settings", docs("Update fallback rate and freshness/alert thresholds", {
    body: { type: "object", additionalProperties: false, properties: {
      fallbackRateToman: { type: "integer", minimum: 10001, maximum: 2147483647 },
      staleAfterSeconds: { type: "integer", minimum: 120, maximum: 86400 },
      alertCooldownSeconds: { type: "integer", minimum: 120, maximum: 86400 },
    } },
  }), async (request, reply) => ok(reply, { settings: await updatePricingSettings(app.prisma, parse(pricingSettingsSchema, request.body)) }));
  app.get("/pricing/status", docs("Current effective rate, freshness and periodic job health"), async (_request, reply) => ok(reply, await status(app.prisma)));
  app.get("/dashboard", docs("Dashboard exchange-rate summary"), async (_request, reply) => ok(reply, await status(app.prisma)));
  app.post("/pricing/preview", docs("Preview final toman price and internal margin without saving a product", {
    body: { type: "object", additionalProperties: false, required: ["priceCurrency", "basePrice"], properties: {
      priceCurrency: { type: "string", enum: ["TOMAN", "USD"] },
      basePrice: { anyOf: [{ type: "string", minLength: 1, maxLength: 24 }, { type: "number", minimum: 0 }] },
      profit: { anyOf: [{ type: "string", maxLength: 32, description: "Plain integer toman, %10 or 10%, or $2" }, { type: "number", minimum: 0 }] },
      quantity: { type: "integer", minimum: 1, maximum: 10, default: 1 },
    } },
  }), async (request, reply) => {
    const input = parse(previewSchema, request.body);
    const pricing = await quoteProduct(app.prisma, prepareProductPricing(input), input.quantity);
    return ok(reply, { pricing });
  });
}
