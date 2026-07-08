import "dotenv/config";

import { z } from "zod";

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => value === true || value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(4001),
  WEB_APP_URL: z.string().url().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(16).default("change-this-dev-secret"),
  SESSION_COOKIE_NAME: z.string().min(1).default("wikiacc_session"),
  COOKIE_SECURE: booleanFromString.default(false),
});

export const env = envSchema.parse(process.env);
