import { z } from "zod";
import { env } from "../../config/env.js";
import { badRequest, conflict } from "../../shared/errors.js";
import { encryptSecret, decryptSecret } from "../sms/crypto.js";
export const DEFAULT_ENDPOINT =
  "https://reseller.superip-app.com/api/reseller/wallet-webhook";
export const settingsInput = z
  .object({
    enabled: z.boolean(),
    endpoint: z.string().url().max(500),
    secret: z
      .string()
      .min(32)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .strict();
export function validateEndpoint(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/api/reseller/wallet-webhook"
  )
    throw badRequest(
      "SUPERIP_ENDPOINT_INVALID",
      "Use the HTTPS wallet webhook endpoint",
    );
  return url.href;
}
export const getSettings = (prisma) =>
  prisma.superipSettings.findUnique({ where: { id: "default" } });
export const publicSettings = (row) => ({
  enabled: row?.enabled ?? false,
  endpoint: row?.endpoint ?? DEFAULT_ENDPOINT,
  configured: !!row?.secretEncrypted,
});
export const credential = (row) =>
  decryptSecret(row.secretEncrypted, env.SMS_CONFIG_ENCRYPTION_KEY);
export async function saveSettings(prisma, body) {
  const input = settingsInput.parse(body);
  const endpoint = validateEndpoint(input.endpoint);
  return prisma.$transaction(async (tx) => {
    const old = await getSettings(tx);
    if (input.enabled && !input.secret && !old?.secretEncrypted)
      throw badRequest("SUPERIP_SECRET_REQUIRED", "Secret required");
    if (
      old &&
      endpoint !== old.endpoint &&
      (await tx.superipFulfillment.count({
        where: {
          status: { not: "DELIVERED" },
          orderItem: {
            order: {
              status: { notIn: ["CANCELLED", "REFUNDED"] },
              paymentStatus: { not: "REFUNDED" },
            },
          },
        },
      }))
    )
      throw conflict(
        "SUPERIP_PENDING_FULFILLMENTS",
        "Resolve pending orders before changing endpoint",
      );
    const data = {
      enabled: input.enabled,
      endpoint,
      ...(input.secret
        ? {
            secretEncrypted: encryptSecret(
              input.secret,
              env.SMS_CONFIG_ENCRYPTION_KEY,
            ),
          }
        : {}),
    };
    return publicSettings(
      await tx.superipSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...data },
        update: data,
      }),
    );
  });
}
