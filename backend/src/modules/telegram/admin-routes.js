import { z } from "zod";
import { badGateway, conflict } from "../../shared/errors.js";
import { ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import { sendTelegramMessage, telegramRequest, safeTelegramErrorCode } from "./client.js";
import { configurationFingerprint, getTelegramSettings, publicTelegramSettings, settingsSchema, telegramCredentials, updateTelegramSettings } from "./settings.js";

export async function adminTelegramRoutes(app, options) {
  app.addHook("preHandler", app.requireAdmin);
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("Cache-Control", "no-store"); return payload;
  });
  app.get("/settings", async (_request, reply) => ok(reply, {
    settings: publicTelegramSettings(await getTelegramSettings(app.prisma)),
  }));
  app.patch("/settings", async (request, reply) => ok(reply, {
    settings: await updateTelegramSettings(app.prisma, parse(settingsSchema, request.body)),
  }));
  app.post("/test", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { mode } = parse(z.object({ mode: z.enum(["connection", "message"]) }).strict(), request.body);
    const credentials = telegramCredentials(await getTelegramSettings(app.prisma));
    try {
      if (mode === "connection") {
        const bot = await telegramRequest(credentials, "getMe", {}, options.clientOptions);
        if (bot?.is_bot !== true || !Number.isSafeInteger(bot.id)) throw new Error("Invalid bot response");
        return ok(reply, { connected: true });
      }
      const result = await sendTelegramMessage({ ...credentials, text: "✅ پیام آزمایشی ویکی‌اکانت\nارتباط با مقصد تلگرام برقرار است. این پیام خرید یا تیکت واقعی نیست." }, options.clientOptions);
      return ok(reply, { messageId: result.messageId });
    } catch (error) {
      throw badGateway(safeTelegramErrorCode(error), "Telegram test failed; check token, endpoint and bot permissions");
    }
  });
  app.get("/jobs", async (_request, reply) => {
    const [jobs, groups, lastSent, lastFailure] = await Promise.all([
      app.prisma.telegramQueueJob.findMany({ orderBy: { createdAt: "desc" }, take: 50, select: {
        id: true, eventType: true, status: true, attempts: true, referenceType: true, referenceId: true,
        lastErrorCode: true, createdAt: true, sentAt: true, availableAt: true,
      } }),
      app.prisma.telegramQueueJob.groupBy({ by: ["status"], _count: { _all: true } }),
      app.prisma.telegramQueueJob.findFirst({ where: { status: "SENT" }, orderBy: { sentAt: "desc" }, select: { sentAt: true } }),
      app.prisma.telegramQueueJob.findFirst({ where: { lastErrorCode: { not: null } }, orderBy: { updatedAt: "desc" }, select: { lastErrorCode: true, updatedAt: true } }),
    ]);
    return ok(reply, { jobs, counts: Object.fromEntries(groups.map((row) => [row.status, row._count._all])),
      lastSentAt: lastSent?.sentAt ?? null, lastError: lastFailure ?? null });
  });
  app.post("/jobs/:id/retry", async (request, reply) => {
    const { id } = parse(z.object({ id: z.string().min(1).max(100) }), request.params);
    parse(z.object({ useCurrentConfiguration: z.literal(true) }).strict(), request.body);
    const result = await app.prisma.$transaction(async (tx) => {
      const settings = await getTelegramSettings(tx);
      telegramCredentials(settings);
      return tx.telegramQueueJob.updateMany({ where: { id, status: "FAILED" }, data: {
        status: "PENDING", attempts: 0, failedAt: null, lastErrorCode: null,
        availableAt: new Date(), leaseToken: null, leaseExpiresAt: null,
        configFingerprint: configurationFingerprint(settings),
      } });
    });
    if (!result.count) throw conflict("TELEGRAM_JOB_NOT_FAILED", "Only failed messages can be retried");
    return ok(reply, { queued: true });
  });
}
