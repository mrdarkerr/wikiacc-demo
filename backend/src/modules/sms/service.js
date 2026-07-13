import { env } from "../../config/env.js";
import { serviceUnavailable } from "../../shared/errors.js";
import { decryptSecret, encryptSecret, secretHint } from "./crypto.js";
import { IranPayamakClient } from "./iranpayamak-client.js";
import {
  createStoredSmsSender,
  deleteStoredSmsSender,
  ensureSmsSettings,
  updateStoredSmsSettings,
} from "./repository.js";
import { sendPatternSmsSchema } from "./schemas.js";

function publicSender(sender) {
  return {
    createdAt: sender.createdAt,
    id: sender.id,
    isActive: sender.isActive,
    label: sender.label,
    lineNumber: sender.lineNumber,
    sortOrder: sender.sortOrder,
    updatedAt: sender.updatedAt,
  };
}

function publicSettings(settings) {
  return {
    apiKeyHint: settings.apiKeyHint,
    authPatternCode: settings.authPatternCode,
    defaultSenderId: settings.defaultSenderId,
    hasApiKey: Boolean(settings.apiKeyEncrypted),
    provider: settings.provider,
    senders: settings.senders.map(publicSender),
    updatedAt: settings.updatedAt,
  };
}

export async function getAdminSmsSettings(prisma) {
  return publicSettings(await ensureSmsSettings(prisma));
}

export async function updateAdminSmsSettings(prisma, input) {
  const data = {};

  if (input.apiKey !== undefined) {
    data.apiKeyEncrypted = encryptSecret(
      input.apiKey,
      env.SMS_CONFIG_ENCRYPTION_KEY,
    );
    data.apiKeyHint = secretHint(input.apiKey);
  } else if (input.removeApiKey) {
    data.apiKeyEncrypted = null;
    data.apiKeyHint = null;
  }

  if (input.defaultSenderId !== undefined) {
    data.defaultSenderId = input.defaultSenderId;
  }

  if (input.authPatternCode !== undefined) {
    data.authPatternCode = input.authPatternCode;
  }

  return publicSettings(await updateStoredSmsSettings(prisma, data));
}

export async function sendAuthCodeSms(prisma, { code, recipient }, options = {}) {
  const settings = await ensureSmsSettings(prisma);
  if (!settings.authPatternCode) {
    throw serviceUnavailable(
      "SMS_AUTH_PATTERN_NOT_CONFIGURED",
      "Authentication SMS pattern code is not configured",
    );
  }

  return sendPatternSms(
    prisma,
    {
      attributes: { code },
      patternCode: settings.authPatternCode,
      recipient,
    },
    options,
  );
}

export async function createAdminSmsSender(prisma, input) {
  return publicSender(await createStoredSmsSender(prisma, input));
}

export async function deleteAdminSmsSender(prisma, senderId) {
  return deleteStoredSmsSender(prisma, senderId);
}

export async function sendPatternSms(prisma, input, options = {}) {
  const message = sendPatternSmsSchema.parse(input);
  const settings = await ensureSmsSettings(prisma);

  if (!settings.apiKeyEncrypted) {
    throw serviceUnavailable(
      "SMS_API_KEY_NOT_CONFIGURED",
      "SMS provider API key is not configured",
    );
  }

  const senderId = message.senderId ?? settings.defaultSenderId;
  const sender = settings.senders.find(
    (item) => item.id === senderId && item.isActive,
  );
  if (!sender) {
    throw serviceUnavailable(
      "SMS_SENDER_NOT_CONFIGURED",
      "An active SMS sender line is not configured",
    );
  }

  let apiKey;
  try {
    apiKey = decryptSecret(
      settings.apiKeyEncrypted,
      env.SMS_CONFIG_ENCRYPTION_KEY,
    );
  } catch {
    throw serviceUnavailable(
      "SMS_CREDENTIALS_UNREADABLE",
      "SMS provider credentials could not be read",
    );
  }

  const client = new IranPayamakClient({
    apiKey,
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
  });
  const result = await client.sendPattern({
    attributes: message.attributes,
    lineNumber: sender.lineNumber,
    numberFormat: message.numberFormat,
    patternCode: message.patternCode,
    recipient: message.recipient,
    schedule: message.schedule,
  });

  return {
    messages: result.messages,
    provider: settings.provider,
    providerMessageId: result.data,
    sender: {
      id: sender.id,
      lineNumber: sender.lineNumber,
    },
  };
}
