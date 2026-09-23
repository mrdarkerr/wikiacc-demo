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
  SMS_CONFIG_ENCRYPTION_KEY: z.string().min(16).optional(),
  TELEGRAM_CONFIG_ENCRYPTION_KEY: z.string().min(16).optional(),
  TELEGRAM_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  TELEGRAM_WORKER_INTERVAL_SECONDS: z.coerce.number().int().min(1).max(3600).default(5),
  SHAREBOX_BASE_URL: z.string().url().default("https://sharebox.wikiacc.ir"),
  SHAREBOX_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
  SHAREBOX_WORKER_INTERVAL_SECONDS: z.coerce.number().int().min(1).max(3600).default(10),
  SESSION_COOKIE_NAME: z.string().min(1).default("wikiacc_session"),
  COOKIE_SECURE: booleanFromString.default(false),
  JIBIT_ENABLED: booleanFromString.default(false),
  JIBIT_API_KEY: z.string().min(1).optional(),
  JIBIT_SECRET_KEY: z.string().min(1).optional(),
  JIBIT_BASE_URL: z.string().url().default("https://napi.jibit.ir/ppg/v3"),
  JIBIT_CALLBACK_URL: z.string().url().optional(),
  JIBIT_RECONCILE_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(1_440)
    .default(20),
  JIBIT_RECONCILE_INTERVAL_SECONDS: z.coerce
    .number()
    .int()
    .min(15)
    .max(3_600)
    .default(60),
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  SMS_CONFIG_ENCRYPTION_KEY:
    parsedEnv.SMS_CONFIG_ENCRYPTION_KEY ?? parsedEnv.JWT_SECRET,
  TELEGRAM_CONFIG_ENCRYPTION_KEY:
    parsedEnv.TELEGRAM_CONFIG_ENCRYPTION_KEY ??
    parsedEnv.SMS_CONFIG_ENCRYPTION_KEY ??
    parsedEnv.JWT_SECRET,
};

const shareboxUrl = new URL(env.SHAREBOX_BASE_URL);
const shareboxIsLoopback = ["localhost", "127.0.0.1", "::1"].includes(
  shareboxUrl.hostname,
);
if (
  shareboxUrl.protocol !== "https:" &&
  !(env.NODE_ENV === "test" && shareboxUrl.protocol === "http:" && shareboxIsLoopback)
) {
  throw new Error(
    "SHAREBOX_BASE_URL must use HTTPS (HTTP loopback is allowed only in NODE_ENV=test)",
  );
}

if (
  env.JIBIT_ENABLED &&
  (!env.JIBIT_API_KEY || !env.JIBIT_SECRET_KEY || !env.JIBIT_CALLBACK_URL)
) {
  throw new Error(
    "JIBIT_API_KEY, JIBIT_SECRET_KEY and JIBIT_CALLBACK_URL are required when JIBIT_ENABLED=true",
  );
}
