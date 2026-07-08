import { z } from "zod";

export const walletAdjustmentSchema = z.object({
  amount: z.number().int().positive(),
  note: z.string().trim().max(1000).optional(),
});
