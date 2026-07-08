import { z } from "zod";

export const createDeliveryPoolSchema = z.object({
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1000).optional(),
});

export const addDeliveryItemsSchema = z
  .object({
    content: z.string().trim().min(1).max(10000).optional(),
    items: z.array(z.string().trim().min(1).max(10000)).optional(),
  })
  .refine((value) => value.content || value.items?.length, {
    message: "Either content or items is required",
  });
