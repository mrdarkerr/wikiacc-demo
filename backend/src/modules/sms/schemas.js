import { z } from "zod";

export const smsSenderIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const smsLineNumberSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "Sender line must contain only latin letters, numbers, dashes, or underscores",
  )
  .transform((value) => (/\D/.test(value) ? value.toUpperCase() : value));

export const createSmsSenderSchema = z.object({
  label: z.string().trim().min(2).max(80),
  lineNumber: smsLineNumberSchema,
});

export const updateSmsSettingsSchema = z
  .object({
    apiKey: z.string().trim().min(8).max(512).optional(),
    defaultSenderId: z.string().min(1).optional(),
    removeApiKey: z.boolean().optional(),
  })
  .refine((input) => !(input.apiKey && input.removeApiKey), {
    message: "API key cannot be updated and removed at the same time",
  })
  .refine(
    (input) =>
      input.apiKey !== undefined ||
      input.defaultSenderId !== undefined ||
      input.removeApiKey === true,
    { message: "At least one setting must be changed" },
  );

export const sendPatternSmsSchema = z.object({
  attributes: z
    .record(z.string().trim().min(1).max(64), z.string().max(1000))
    .default({}),
  numberFormat: z.enum(["english", "persian"]).default("english"),
  patternCode: z.string().trim().min(1).max(128),
  recipient: z.string().trim().regex(/^09\d{9}$/, "Recipient must be like 09120000000"),
  schedule: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    .optional(),
  senderId: z.string().min(1).optional(),
});
