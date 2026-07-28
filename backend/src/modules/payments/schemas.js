import { z } from "zod";

export const jibitCallbackQuerySchema = z.object({
  attempt: z.string().uuid(),
});

export const jibitCallbackBodySchema = z
  .object({
    purchaseId: z.union([z.string(), z.number()]).optional(),
    purchaseIdStr: z.union([z.string(), z.number()]).optional(),
    status: z.string().optional(),
  })
  .passthrough();

export const paymentOrderParamsSchema = z.object({
  orderId: z.string().min(1),
});
