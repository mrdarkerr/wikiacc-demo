import { validateEndpoint } from "./settings.js";
export function createSuperipClient({
  fetchImpl = globalThis.fetch,
  timeoutMs = 10000,
} = {}) {
  return {
    async credit(endpoint, secret, body) {
      validateEndpoint(endpoint);
      const response = await fetchImpl(endpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw Object.assign(new Error("Wallet webhook rejected request"), {
          code: `HTTP_${response.status}`,
        });
      }
      const text = await response.text();
      if (text.length > 16384) throw new Error("Invalid wallet receipt");
      return JSON.parse(text);
    },
  };
}
