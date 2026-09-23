import { isIP } from "node:net";

export class TelegramApiError extends Error {
  constructor(code, { retryAfterSeconds, statusCode } = {}) {
    super("Telegram request failed");
    this.name = "TelegramApiError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
    this.statusCode = statusCode;
  }
}

export function validateTelegramBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new TelegramApiError("TELEGRAM_BASE_URL_INVALID"); }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const [a, b] = host.split(".").map(Number);
  const privateV4 = isIP(host) === 4 && (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  );
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
    !host || !host.includes(".") || host.endsWith(".localhost") || host.endsWith(".local") ||
    host.endsWith(".internal") || isIP(host) === 6 || privateV4 ||
    /\/bot\d+:/i.test(decodeURIComponent(url.pathname))) {
    throw new TelegramApiError("TELEGRAM_BASE_URL_UNSAFE");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

async function responseJson(response) {
  // Bound the body even when an untrusted proxy omits Content-Length.
  const reader = response.body?.getReader();
  if (!reader) throw new TelegramApiError("TELEGRAM_INVALID_RESPONSE");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) {
        await reader.cancel();
        throw new TelegramApiError("TELEGRAM_INVALID_RESPONSE");
      }
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof TelegramApiError || error?.name === "AbortError") throw error;
    throw new TelegramApiError("TELEGRAM_INVALID_RESPONSE");
  } finally { reader.releaseLock(); }
}

export async function telegramRequest(
  { baseUrl, botToken }, method, body,
  { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {},
) {
  const normalized = validateTelegramBaseUrl(baseUrl);
  if (!/^\d{5,20}:[A-Za-z0-9_-]{20,100}$/.test(botToken) || !["sendMessage", "getMe"].includes(method)) {
    throw new TelegramApiError("TELEGRAM_CONFIG_REQUIRED");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    const response = await fetchImpl(`${normalized}/bot${botToken}/${method}`, {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await responseJson(response);
    if (!response.ok || payload?.ok !== true) {
      const status = Number.isInteger(payload?.error_code) ? payload.error_code : response.status;
      const retryAfter = Number(payload?.parameters?.retry_after);
      throw new TelegramApiError(status === 429 ? "TELEGRAM_RATE_LIMITED" : `TELEGRAM_HTTP_${status}`, {
        statusCode: status,
        retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : undefined,
      });
    }
    return payload.result;
  } catch (error) {
    if (error instanceof TelegramApiError) throw error;
    throw new TelegramApiError(controller.signal.aborted ? "TELEGRAM_TIMEOUT" : "TELEGRAM_REQUEST_FAILED");
  } finally { clearTimeout(timer); }
}

export async function sendTelegramMessage({ text, chatId, buttonUrl, ...credentials }, options) {
  const result = await telegramRequest(credentials, "sendMessage", {
    chat_id: chatId, text, link_preview_options: { is_disabled: true },
    ...(buttonUrl ? { reply_markup: { inline_keyboard: [[{ text: "مشاهده در پنل", url: buttonUrl }]] } } : {}),
  }, options);
  if (!Number.isSafeInteger(result?.message_id)) throw new TelegramApiError("TELEGRAM_INVALID_RESPONSE");
  return { messageId: String(result.message_id) };
}

export function safeTelegramErrorCode(error) {
  const code = error?.code;
  return typeof code === "string" && /^TELEGRAM_(?:HTTP_[1-5]\d\d|BASE_URL_INVALID|BASE_URL_UNSAFE|INVALID_RESPONSE|RATE_LIMITED|TIMEOUT|REQUEST_FAILED|CONFIG_REQUIRED|TOKEN_UNREADABLE|CONFIGURATION_CHANGED)$/.test(code)
    ? code : "TELEGRAM_REQUEST_FAILED";
}
