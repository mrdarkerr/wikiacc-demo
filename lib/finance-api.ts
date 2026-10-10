import { ApiError } from "./api-error";
import { createClient } from "./generated/finance/client";
import { getFinanceHistory, getFinanceForecast } from "./generated/finance/sdk.gen";
import { zDef0 } from "./generated/finance/zod.gen";
import type { GetFinanceHistoryData, GetFinanceHistoryResponses, GetFinanceForecastResponses } from "./generated/finance/types.gen";
export type FinanceHistory = GetFinanceHistoryResponses[200]["data"];
export type FinanceForecast = GetFinanceForecastResponses[200]["data"];
export type FinanceQuery = NonNullable<GetFinanceHistoryData["query"]>;
type Options = { signal?: AbortSignal; timeoutMs?: number };
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001/api/v1";
function clientBaseUrl() {
  // Generated fetch clients construct Request objects, which require an
  // absolute URL even when the existing app uses a same-origin /api/v1 base.
  const resolved = apiBase.startsWith("/") && typeof window !== "undefined"
    ? new URL(apiBase, window.location.origin).href
    : apiBase;
  return resolved.replace(/\/$/, "").replace(/\/api\/v1$/, "");
}
function failure(status: number, code: string, message: string) { return new ApiError(status, message, { error: { code, message } }); }
const invalid = (status = 502) => failure(status, "API_INVALID_RESPONSE", "پاسخ گزارش مالی با قرارداد سرور سازگار نیست؛ دوباره تلاش کنید.");
async function run<T>(operation: (client: ReturnType<typeof createClient>, signal: AbortSignal) => Promise<T>, { signal, timeoutMs = 30000 }: Options = {}): Promise<T> {
  if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
  const controller = new AbortController();
  const client = createClient({ baseUrl: clientBaseUrl(), credentials: "include", cache: "no-store", throwOnError: true, parseAs: "json" });
  client.interceptors.response.use((response) => {
    if (![200, 400, 401, 403, 429, 500].includes(response.status)) throw invalid(response.status >= 400 ? response.status : 502);
    return response;
  });
  client.interceptors.error.use((error, response) => {
    if (error instanceof ApiError) return error;
    if (!response) return failure(0, "API_NETWORK_ERROR", "ارتباط با سرور گزارش مالی برقرار نشد.");
    if (response.status === 200) return invalid();
    const parsed = zDef0.safeParse(error);
    if (!parsed.success) return invalid(response.status);
    return new ApiError(response.status, parsed.data.error.message, parsed.data);
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => { controller.abort(signal?.reason); reject(signal?.reason ?? new DOMException("Aborted", "AbortError")); };
    signal?.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => { controller.abort(); reject(failure(0, "API_TIMEOUT", "مهلت دریافت گزارش مالی تمام شد؛ دوباره تلاش کنید.")); }, timeoutMs);
  });
  try { return await Promise.race([operation(client, controller.signal), cancelled]); }
  finally { clearTimeout(timer); if (onAbort) signal?.removeEventListener("abort", onAbort); }
}
export const financeApi = {
  history: (query: FinanceQuery, options?: Options): Promise<FinanceHistory> => run(async (client, signal) => {
    const result = await getFinanceHistory({ client, signal, query, throwOnError: true });
    return result.data.data;
  }, options),
  forecast: (options?: Options): Promise<FinanceForecast> => run(async (client, signal) => {
    const result = await getFinanceForecast({ client, signal, throwOnError: true });
    return result.data.data;
  }, options),
};
