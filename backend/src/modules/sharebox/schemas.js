import { z } from "zod";

export const shareboxSettingsUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    apiKey: z.string().min(1).max(500).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one setting must be provided",
  });

export const shareboxCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(100),
});
