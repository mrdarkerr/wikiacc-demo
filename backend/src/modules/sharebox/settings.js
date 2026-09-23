import { createHash } from "node:crypto";

import { env } from "../../config/env.js";
import {
  badRequest,
  conflict,
  serviceUnavailable,
} from "../../shared/errors.js";
import { decryptSecret, encryptSecret, secretHint } from "../sms/crypto.js";
import { SHAREBOX_SETTINGS_ID } from "./constants.js";

export function shareboxApiOrigin(value) {
  const url = new URL(value);
  return url.origin;
}

export function fingerprintApiKey(apiKey) {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

export function publicShareboxSettings(settings, baseUrl) {
  return {
    enabled: settings?.enabled ?? false,
    hasApiKey: Boolean(settings?.apiKeyEncrypted),
    apiKeyHint: settings?.apiKeyHint ?? null,
    baseUrl: shareboxApiOrigin(baseUrl),
    updatedAt: settings?.updatedAt?.toISOString?.() ?? null,
  };
}

export async function getShareboxSettings(prisma) {
  return prisma.shareboxSettings.findUnique({
    where: { id: SHAREBOX_SETTINGS_ID },
  });
}

export async function getAdminShareboxSettings(prisma, baseUrl) {
  return publicShareboxSettings(await getShareboxSettings(prisma), baseUrl);
}

export async function updateAdminShareboxSettings(prisma, input, baseUrl) {
  const settings = await prisma.$transaction(async (tx) => {
    const current = await getShareboxSettings(tx);
    const hasKey = Boolean(input.apiKey || current?.apiKeyEncrypted);
    const enabled = input.enabled ?? current?.enabled ?? false;
    if (enabled && !hasKey) {
      throw badRequest(
        "SHAREBOX_API_KEY_REQUIRED",
        "A ShareBox API key is required before enabling the integration",
      );
    }

    const nextFingerprint = input.apiKey
      ? fingerprintApiKey(input.apiKey)
      : current?.apiKeyFingerprint;
    if (
      current?.apiKeyEncrypted &&
      nextFingerprint !== current.apiKeyFingerprint
    ) {
      const pending = await tx.shareboxFulfillment.count({
        where: {
          status: { not: "DELIVERED" },
          orderItem: {
            order: {
              paymentStatus: { not: "REFUNDED" },
              status: { notIn: ["CANCELLED", "REFUNDED"] },
            },
          },
        },
      });
      if (pending > 0) {
        throw conflict(
          "SHAREBOX_PENDING_FULFILLMENTS",
          "The ShareBox credential cannot be changed while fulfillments are pending",
        );
      }
    }

    const keyData = input.apiKey
      ? {
          apiKeyEncrypted: encryptSecret(
            input.apiKey,
            env.SMS_CONFIG_ENCRYPTION_KEY,
          ),
          apiKeyFingerprint: nextFingerprint,
          apiKeyHint: secretHint(input.apiKey),
        }
      : {};
    return tx.shareboxSettings.upsert({
      where: { id: SHAREBOX_SETTINGS_ID },
      update: { enabled, ...keyData },
      create: {
        id: SHAREBOX_SETTINGS_ID,
        enabled,
        ...keyData,
      },
    });
  });
  return publicShareboxSettings(settings, baseUrl);
}

export function requireShareboxCredential(settings) {
  if (!settings?.apiKeyEncrypted || !settings.apiKeyFingerprint) {
    throw serviceUnavailable(
      "SHAREBOX_NOT_CONFIGURED",
      "ShareBox API credentials are not configured",
    );
  }
  return {
    apiKey: decryptSecret(settings.apiKeyEncrypted, env.SMS_CONFIG_ENCRYPTION_KEY),
    fingerprint: settings.apiKeyFingerprint,
  };
}

export function requireEnabledShareboxCredential(settings) {
  if (!settings?.enabled) {
    throw serviceUnavailable(
      "SHAREBOX_DISABLED",
      "ShareBox fulfillment is disabled",
    );
  }
  return requireShareboxCredential(settings);
}
