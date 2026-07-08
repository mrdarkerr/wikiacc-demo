import { z } from "zod";

export const orderFieldValueSchema = z.record(
  z.string().min(1).max(64),
  z.string().trim().max(5000),
);

export const createOrderSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
  fieldValues: orderFieldValueSchema.optional(),
  note: z.string().trim().max(1000).optional(),
});

export const submitOrderFieldValuesSchema = z.object({
  fieldValues: orderFieldValueSchema,
});
