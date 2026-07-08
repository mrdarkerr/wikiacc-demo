import { z } from "zod";

export const idParamsSchema = z.object({
  id: z.string().min(1),
});

export const userIdParamsSchema = z.object({
  userId: z.string().min(1),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "DRAFT",
    "PENDING_INFO",
    "AWAITING_ADMIN",
    "READY",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ]),
  adminNote: z.string().trim().max(1000).nullable().optional(),
  note: z.string().trim().max(1000).optional(),
});

export const refundOrderSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const setActiveSchema = z.object({
  isActive: z.boolean(),
});
