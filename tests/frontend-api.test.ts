import { afterEach, describe, expect, it, vi } from "../backend/node_modules/vitest";
import { ApiError, apiFetch, apiFetchWithMeta } from "../lib/api";

afterEach(() => vi.unstubAllGlobals());

describe("API transport response contract", () => {
  it("allows intentional HTTP 204 responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await apiFetch<void>("/auth/logout", { method: "POST" })).toBeUndefined();
  });
  it("preserves intentional caller cancellation and aborts the transport", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => new Promise(() => {}) });
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    const reason = new DOMException("Superseded preview", "AbortError");
    const request = apiFetch("/admin/pricing/preview", { signal: controller.signal });
    controller.abort(reason);
    await expect(request).rejects.toBe(reason);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("does not send a request when the caller is already aborted", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController(); controller.abort();
    await expect(apiFetch("/admin/pricing/status", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reports a non-JSON proxy failure as an ApiError while preserving HTTP status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>upstream unavailable</html>", { status: 502 })));
    await expect(apiFetch("/admin/pricing/status")).rejects.toMatchObject({
      name: "ApiError", status: 502, payload: { error: { code: "API_INVALID_RESPONSE" } },
    });
  });

  it("classifies network loss consistently without automatic mutation retries", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetcher);
    await expect(apiFetch("/admin/pricing/settings", { method: "PATCH", body: { fallbackRateToman: 270000 } }))
      .rejects.toMatchObject({ name: "ApiError", status: 0, payload: { error: { code: "API_NETWORK_ERROR" } } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("bounds a stalled response body, not only connection headers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => new Promise(() => {}) }));
    await expect(apiFetch("/admin/pricing/status", { timeoutMs: 20 }))
      .rejects.toMatchObject({ name: "ApiError", payload: { error: { code: "API_TIMEOUT" } } });
  });

  it("rejects an empty success body except for HTTP 204", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
    await expect(apiFetch("/admin/pricing/status"))
      .rejects.toMatchObject({ name: "ApiError", payload: { error: { code: "API_INVALID_RESPONSE" } } });
  });

  it("unwraps data, preserves pagination metadata, and sends zero values with credentials and no cache", async () => {
    const payload = { data: { settings: { fallbackRateToman: 270000 } }, meta: { page: 1, total: 1 } };
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json(payload)));
    vi.stubGlobal("fetch", fetcher);
    expect(await apiFetchWithMeta("/admin/pricing/settings")).toEqual(payload);
    expect(await apiFetch("/admin/pricing/preview", { method: "POST", body: { basePrice: "0", profit: "0" } })).toEqual(payload.data);
    expect(fetcher.mock.calls[1][1]).toMatchObject({ credentials: "include", cache: "no-store", body: JSON.stringify({ basePrice: "0", profit: "0" }) });
    expect(new Headers(fetcher.mock.calls[1][1].headers).get("Content-Type")).toBe("application/json");
  });

  it("preserves server validation details and authorization status", async () => {
    const payload = { error: { code: "VALIDATION_ERROR", message: "invalid input", details: { fieldErrors: { basePrice: ["Invalid"] } } } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload, { status: 400 })));
    await expect(apiFetch("/admin/pricing/preview")).rejects.toMatchObject({ status: 400, payload });
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json({ error: { code: "UNAUTHORIZED", message: "login" } }, { status: 401 }))));
    await expect(apiFetchWithMeta("/admin/pricing/settings")).rejects.toBeInstanceOf(ApiError);
    await expect(apiFetch("/admin/pricing/settings")).rejects.toMatchObject({ status: 401 });
  });
});
