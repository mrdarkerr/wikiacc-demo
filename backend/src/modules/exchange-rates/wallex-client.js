import { MAX_TOMAN } from "../pricing/calculator.js";

export class WallexError extends Error {
  constructor(code) { super(code); this.name = "WallexError"; this.code = code; }
}
const CODES = new Set(["WALLEX_TIMEOUT", "WALLEX_HTTP_ERROR", "WALLEX_INVALID_RESPONSE", "WALLEX_REQUEST_FAILED", "WALLEX_ABORTED"]);
export const safeWallexErrorCode = (error) => CODES.has(error?.code) ? error.code : "WALLEX_REQUEST_FAILED";
function parseRate(value) {
  const match = /^(\d{1,10})(?:\.(\d{1,18}))?$/.exec(String(value));
  if (!match) throw new WallexError("WALLEX_INVALID_RESPONSE");
  const fraction = match[2] ?? "";
  const scale = 10n ** BigInt(fraction.length);
  const numerator = BigInt(match[1]) * scale + BigInt(fraction || "0");
  const rate = Number((numerator + scale / 2n) / scale);
  if (!Number.isInteger(rate) || rate <= 10000 || rate > MAX_TOMAN) throw new WallexError("WALLEX_INVALID_RESPONSE");
  return rate;
}
export function createWallexClient({ fetchImpl = globalThis.fetch, timeoutMs = 8000, attempts = 2 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000 || !Number.isInteger(attempts) || attempts < 1 || attempts > 3) throw new Error("Invalid Wallex client limits");
  async function request(signal) {
    const controller = new AbortController();
    let timer, abortListener;
    const stopped = new Promise((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new WallexError("WALLEX_TIMEOUT")); }, timeoutMs);
      abortListener = () => { controller.abort(); reject(new WallexError("WALLEX_ABORTED")); };
      signal?.addEventListener("abort", abortListener, { once: true });
      if (signal?.aborted) abortListener();
    });
    try {
      return await Promise.race([stopped, (async () => {
        const response = await fetchImpl("https://api.wallex.ir/v1/markets", {
          headers: { Accept: "application/json" }, signal: controller.signal, redirect: "error", cache: "no-store",
        });
        if (!response.ok) throw new WallexError("WALLEX_HTTP_ERROR");
        let data;
        try { data = await response.json(); } catch { throw new WallexError("WALLEX_INVALID_RESPONSE"); }
        if (data?.success !== true) throw new WallexError("WALLEX_INVALID_RESPONSE");
        return { rateToman: parseRate(data?.result?.symbols?.USDTTMN?.stats?.lastPrice), source: "WALLEX", symbol: "USDTTMN" };
      })()]);
    } catch (error) { throw new WallexError(safeWallexErrorCode(error)); }
    finally { clearTimeout(timer); signal?.removeEventListener("abort", abortListener); }
  }
  return {
    async fetchRate({ signal } = {}) {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        try { return await request(signal); }
        catch (error) {
          if (attempt === attempts || signal?.aborted || error.code === "WALLEX_INVALID_RESPONSE") throw error;
        }
      }
    },
  };
}
