import { describe, it, expect, vi } from "vitest";
const payload = (price = "266641.0000000000000000") => ({ success: true, result: { symbols: { USDTTMN: { stats: { lastPrice: price } } } } });
describe("Wallex client", () => {
  it("reads the exact Super IP market and supports Wallex's long decimal strings", async () => {
    const { createWallexClient } = await import("../src/modules/exchange-rates/wallex-client.js");
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(payload())));
    expect(await createWallexClient({ fetchImpl }).fetchRate()).toEqual({ rateToman: 266641, source: "WALLEX", symbol: "USDTTMN" });
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.wallex.ir/v1/markets");
  });
  it("rejects missing, zero, negative and malformed quotes without retrying invalid data", async () => {
    const { createWallexClient } = await import("../src/modules/exchange-rates/wallex-client.js");
    for (const price of [undefined, "0", "10000", "-1", "1e5", "NaN", "2147483648", "2.0000000000000000001"]) {
      const fetchImpl = vi.fn(async () => new Response(JSON.stringify(payload(price === undefined ? "" : price))));
      await expect(createWallexClient({ fetchImpl }).fetchRate()).rejects.toMatchObject({ code: "WALLEX_INVALID_RESPONSE" });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });
  it("bounds retries on network and HTTP failures", async () => {
    const { createWallexClient } = await import("../src/modules/exchange-rates/wallex-client.js");
    const fetchImpl = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(new Response(JSON.stringify(payload("270000.5"))));
    expect((await createWallexClient({ fetchImpl }).fetchRate()).rateToman).toBe(270001);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const failed = vi.fn(async () => new Response("offline", { status: 503 }));
    await expect(createWallexClient({ fetchImpl: failed }).fetchRate()).rejects.toMatchObject({ code: "WALLEX_HTTP_ERROR" });
    expect(failed).toHaveBeenCalledTimes(2);
  });
  it("times out even when the transport ignores abort", async () => {
    const { createWallexClient } = await import("../src/modules/exchange-rates/wallex-client.js");
    await expect(createWallexClient({ fetchImpl: () => new Promise(() => {}), timeoutMs: 10, attempts: 1 }).fetchRate()).rejects.toMatchObject({ code: "WALLEX_TIMEOUT" });
    const controller = new AbortController(); controller.abort();
    await expect(createWallexClient({ fetchImpl: () => new Promise(() => {}) }).fetchRate({ signal: controller.signal })).rejects.toMatchObject({ code: "WALLEX_ABORTED" });
  });
  it("also bounds a stalled body after successful HTTP headers", async () => {
    const { createWallexClient } = await import("../src/modules/exchange-rates/wallex-client.js");
    const fetchImpl = async () => ({ ok: true, json: () => new Promise(() => {}) });
    await expect(createWallexClient({ fetchImpl, timeoutMs: 10, attempts: 1 }).fetchRate()).rejects.toMatchObject({ code: "WALLEX_TIMEOUT" });
  });
});
