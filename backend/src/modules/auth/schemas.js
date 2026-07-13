import { z } from "zod";

const digitMap = new Map([
  ["۰", "0"], ["۱", "1"], ["۲", "2"], ["۳", "3"], ["۴", "4"],
  ["۵", "5"], ["۶", "6"], ["۷", "7"], ["۸", "8"], ["۹", "9"],
  ["٠", "0"], ["١", "1"], ["٢", "2"], ["٣", "3"], ["٤", "4"],
  ["٥", "5"], ["٦", "6"], ["٧", "7"], ["٨", "8"], ["٩", "9"],
]);

function latinDigits(value) {
  return [...value].map((character) => digitMap.get(character) ?? character).join("");
}

function normalizeIranPhone(value) {
  let phone = latinDigits(value).replace(/[\s()-]/g, "");
  if (phone.startsWith("0098")) phone = `0${phone.slice(4)}`;
  if (phone.startsWith("+98")) phone = `0${phone.slice(3)}`;
  if (/^98\d{10}$/.test(phone)) phone = `0${phone.slice(2)}`;
  return phone;
}

export const iranPhoneSchema = z
  .string()
  .trim()
  .transform(normalizeIranPhone)
  .refine((value) => /^09\d{9}$/.test(value), {
    message: "Phone number must be like 09120000000",
  });

const optionalEmailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase())
  .optional();

export const requestOtpSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("login"), phone: iranPhoneSchema }),
  z.object({
    email: optionalEmailSchema,
    mode: z.literal("register"),
    name: z.string().trim().min(2).max(120),
    phone: iranPhoneSchema,
  }),
  z.object({
    mode: z.literal("checkout"),
    name: z.string().trim().min(2).max(120),
    phone: iranPhoneSchema,
  }),
]);

export const verifyOtpSchema = z.object({
  challengeId: z.string().uuid(),
  code: z
    .string()
    .trim()
    .transform(latinDigits)
    .refine((value) => /^\d{6}$/.test(value), {
      message: "Verification code must contain 6 digits",
    }),
});

export const loginSchema = z
  .object({
    email: z.string().trim().optional(),
    identifier: z.string().trim().optional(),
    password: z.string().min(1).max(128),
  })
  .transform((input) => ({
    identifier: (() => {
      const value = input.identifier ?? input.email ?? "";
      const phone = normalizeIranPhone(value);
      return /^09\d{9}$/.test(phone) ? phone : value.toLowerCase();
    })(),
    password: input.password,
  }))
  .refine((input) => input.identifier.length > 0, {
    message: "Phone number or email is required",
    path: ["identifier"],
  });

export const setPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128).optional(),
  password: z.string().min(8).max(128),
});

export const updateProfileSchema = z
  .object({
    email: z
      .union([z.string().trim().email().max(254), z.literal("")])
      .transform((value) => (value ? value.toLowerCase() : null))
      .optional(),
    name: z.string().trim().min(2).max(120).optional(),
  })
  .refine((input) => input.email !== undefined || input.name !== undefined, {
    message: "At least one profile field must be changed",
  });

export const authUserSelect = {
  id: true,
  email: true,
  phone: true,
  name: true,
  passwordHash: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};
