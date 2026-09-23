import { z } from "zod";

const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  validity_days: z.number().int().positive(),
});
const categoryResponseSchema = z.object({
  data: z.array(categorySchema),
  meta: z.object({
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    total_pages: z.number().int().nonnegative(),
  }),
});
const receiptSchema = z.object({
  license_key: z.string().min(1).max(500),
  license: z.object({
    id: z.string().uuid(),
    category_id: z.string().uuid(),
    reference: z.string().min(1).max(200),
    label: z.string().min(1).max(200),
    issued_at: z.string().datetime(),
    expires_at: z.string().datetime(),
  }),
});

const UPSTREAM_ERROR_CODES = new Set([
  "API_KEY_INVALID",
  "API_KEY_REVOKED",
  "AUTH_REQUIRED",
  "CAPACITY_UNAVAILABLE",
  "CATEGORY_ALLOCATION_DISABLED",
  "EXTERNAL_ID_CONFLICT",
  "INTERNAL_ERROR",
  "LICENSE_KEY_REPLACED",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "RESOURCE_NOT_FOUND",
  "VALIDATION_ERROR",
]);

export class ShareboxApiError extends Error {
  constructor(message, { code, retryAfterSeconds, statusCode } = {}) {
    super(message);
    this.name = "ShareboxApiError";
    this.code = code ?? "SHAREBOX_REQUEST_FAILED";
    this.retryAfterSeconds = retryAfterSeconds;
    this.statusCode = statusCode;
  }
}

function retryAfterSeconds(value) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (Number.isNaN(date)) return undefined;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

async function parseResponseBody(response) {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > 64 * 1024) {
    throw new ShareboxApiError("ShareBox response was too large", {
      code: "SHAREBOX_INVALID_RESPONSE",
      statusCode: response.status,
    });
  }
  const text = await response.text();
  if (text.length > 64 * 1024) {
    throw new ShareboxApiError("ShareBox response was too large", {
      code: "SHAREBOX_INVALID_RESPONSE",
      statusCode: response.status,
    });
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new ShareboxApiError("ShareBox returned invalid JSON", {
      code: "SHAREBOX_INVALID_RESPONSE",
      statusCode: response.status,
    });
  }
}

export function validateShareboxBaseUrl(baseUrl, nodeEnv) {
  const url = new URL(baseUrl);
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (
    url.protocol !== "https:" &&
    !(nodeEnv === "test" && url.protocol === "http:" && loopback)
  ) {
    throw new Error(
      "ShareBox base URL must use HTTPS (HTTP loopback is allowed only in test)",
    );
  }
  return url.origin;
}

export function createShareboxClient({
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = 8_000,
  nodeEnv = process.env.NODE_ENV,
}) {
  const origin = validateShareboxBaseUrl(baseUrl, nodeEnv);

  async function request(path, { apiKey, body, method = "GET" }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      const response = await fetchImpl(new URL(path, `${origin}/`), {
        method,
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload = await parseResponseBody(response);
      if (!response.ok) {
        const upstreamCode = payload?.error?.code;
        throw new ShareboxApiError("ShareBox rejected the request", {
          code:
            typeof upstreamCode === "string" && UPSTREAM_ERROR_CODES.has(upstreamCode)
              ? upstreamCode
              : `SHAREBOX_HTTP_${response.status}`,
          retryAfterSeconds: retryAfterSeconds(response.headers.get("retry-after")),
          statusCode: response.status,
        });
      }
      return payload;
    } catch (error) {
      if (error instanceof ShareboxApiError) throw error;
      throw new ShareboxApiError(
        error?.name === "AbortError"
          ? "ShareBox request timed out"
          : "ShareBox request failed",
        {
          code:
            error?.name === "AbortError"
              ? "SHAREBOX_TIMEOUT"
              : "SHAREBOX_REQUEST_FAILED",
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    origin,
    async listCategories(apiKey, { page = 1, perPage = 100 } = {}) {
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(perPage),
      });
      const payload = await request(`/api/v1/sales/categories?${query}`, { apiKey });
      const parsed = categoryResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ShareboxApiError("ShareBox returned an invalid category response", {
          code: "SHAREBOX_INVALID_RESPONSE",
        });
      }
      return parsed.data;
    },
    async issueLicense(apiKey, body) {
      const payload = await request("/api/v1/sales/licenses", {
        apiKey,
        body,
        method: "POST",
      });
      const parsed = receiptSchema.safeParse(payload);
      if (!parsed.success) {
        throw new ShareboxApiError("ShareBox returned an invalid license receipt", {
          code: "SHAREBOX_INVALID_RESPONSE",
        });
      }
      return parsed.data;
    },
  };
}
