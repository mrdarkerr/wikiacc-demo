import { z } from "zod";

export const createTicketSchema = z.object({
  orderId: z.string().optional(),
  subject: z.string().trim().min(2).max(180),
  body: z.string().trim().min(1).max(5000),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).default("NORMAL"),
});

export const createTicketMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const updateTicketStatusSchema = z.object({
  status: z.enum(["OPEN", "ANSWERED", "CLOSED"]),
});
