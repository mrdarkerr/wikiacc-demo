import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(5).max(32).optional(),
  name: z.string().trim().min(2).max(120),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const publicUserSelect = {
  id: true,
  email: true,
  phone: true,
  name: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};
