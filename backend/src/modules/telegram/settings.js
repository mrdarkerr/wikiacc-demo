import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env.js";
import { badRequest, serviceUnavailable } from "../../shared/errors.js";
import { encryptSecret, decryptSecret } from "../sms/crypto.js";
import { validateTelegramBaseUrl } from "./client.js";
import { TELEGRAM_SETTINGS_ID } from "./constants.js";

export const categoryFields = Object.freeze({
  ORDER: "orderEventsEnabled", TICKET: "ticketEventsEnabled",
  PAYMENT: "paymentEventsEnabled", FULFILLMENT: "fulfillmentEventsEnabled",
});
export const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().trim().min(1).max(500).refine((value) => {
    try { validateTelegramBaseUrl(value); return true; } catch { return false; }
  }, "Use a public HTTPS Bot API base URL without credentials, query or fragment").optional(),
  botToken: z.string().trim().regex(/^\d{5,20}:[A-Za-z0-9_-]{20,100}$/).optional(),
  destinationChatId: z.string().regex(/^-?[1-9]\d{0,15}$/).refine(
    (value) => Number.isSafeInteger(Number(value)), "Invalid numeric Telegram chat ID",
  ).nullable().optional(),
  orderEventsEnabled: z.boolean().optional(),
  ticketEventsEnabled: z.boolean().optional(),
  paymentEventsEnabled: z.boolean().optional(),
  fulfillmentEventsEnabled: z.boolean().optional(),
}).strict();

export function getTelegramSettings(prisma) {
  return prisma.telegramSettings.findUnique({ where: { id: TELEGRAM_SETTINGS_ID } });
}

export function publicTelegramSettings(settings) {
  return {
    enabled: settings?.enabled ?? false,
    baseUrl: settings?.baseUrl ?? "https://api.telegram.org",
    destinationChatId: settings?.destinationChatId ?? null,
    hasBotToken: Boolean(settings?.botTokenEncrypted),
    botTokenHint: settings?.botTokenHint ?? null,
    ...Object.fromEntries(Object.values(categoryFields).map((field) => [field, settings?.[field] ?? true])),
    updatedAt: settings?.updatedAt ?? null,
  };
}

export async function updateTelegramSettings(prisma, input) {
  return prisma.$transaction(async (tx) => {
    const current = await getTelegramSettings(tx);
    const { botToken, ...values } = input;
    const data = { ...values };
    if (data.baseUrl) data.baseUrl = validateTelegramBaseUrl(data.baseUrl);
    if (botToken) {
      data.botTokenEncrypted = encryptSecret(botToken, env.TELEGRAM_CONFIG_ENCRYPTION_KEY);
      data.botTokenHint = botToken.slice(-4);
      data.botTokenFingerprint = createHash("sha256").update(botToken).digest("hex");
    }
    const next = { ...current, ...data };
    if (current && configurationFingerprint(current) !== configurationFingerprint(next)) data.cooldownUntil = null;
    if (next.enabled && (!next.botTokenEncrypted || !next.destinationChatId)) {
      throw badRequest("TELEGRAM_CONFIG_REQUIRED", "Bot token and numeric destination ID are required");
    }
    return publicTelegramSettings(await tx.telegramSettings.upsert({
      where: { id: TELEGRAM_SETTINGS_ID },
      create: { id: TELEGRAM_SETTINGS_ID, ...data }, update: data,
    }));
  });
}

// Pin queued messages to a configuration, not to whichever recipient is set later.
export function configurationFingerprint(settings) {
  return createHash("sha256").update(JSON.stringify([
    settings.baseUrl, settings.destinationChatId, settings.botTokenFingerprint,
  ])).digest("hex");
}

export function telegramCredentials(settings) {
  if (!settings?.botTokenEncrypted || !settings.destinationChatId) {
    throw serviceUnavailable("TELEGRAM_CONFIG_REQUIRED", "Telegram is not configured");
  }
  try {
    return {
      baseUrl: settings.baseUrl, chatId: settings.destinationChatId,
      botToken: decryptSecret(settings.botTokenEncrypted, env.TELEGRAM_CONFIG_ENCRYPTION_KEY),
    };
  } catch {
    throw serviceUnavailable("TELEGRAM_TOKEN_UNREADABLE", "Save the bot token again after an encryption key change");
  }
}
