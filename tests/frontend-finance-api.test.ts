import { afterEach, describe, expect, it, vi } from "../backend/node_modules/vitest";
import { financeApi } from "../lib/finance-api";
import { history } from "../backend/src/modules/finance/service.js";
const prisma = { order: { findFirst: async () => null, findMany: async () => [] } };
afterEach(() => vi.unstubAllGlobals());
describe("generated finance SDK adapter", () => {
  it("uses the generated route and query with cookie credentials and no cache", async () => {
    const payload = { data: await history(prisma, { interval: "weekly" }) };
    const fetcher = vi.fn().mockResolvedValue(Response.json(payload)); vi.stubGlobal("fetch", fetcher);
    expect(await financeApi.history({ interval: "weekly", page: 1 })).toEqual(payload.data);
    const request: Request = fetcher.mock.calls[0][0];
    expect(request.url).toContain("/api/v1/admin/finance/history?interval=weekly&page=1");
    expect(request.credentials).toBe("include"); expect(request.cache).toBe("no-store");
  });
  it("rejects invalid success bodies and undeclared success/error statuses", async () => {
    for (const response of [Response.json({ data: { turnover: "300" } }), new Response(null, { status: 204 }), Response.json({ error: { code: "TEAPOT", message: "unexpected" } }, { status: 418 })]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expect(financeApi.history({ interval: "daily", page: 1 })).rejects.toMatchObject({ payload: { error: { code: "API_INVALID_RESPONSE" } } });
    }
  });
  it("preserves declared auth errors but rejects extra error properties", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { code: "UNAUTHORIZED", message: "login" } }, { status: 401 })));
    await expect(financeApi.forecast()).rejects.toMatchObject({ status: 401, payload: { error: { code: "UNAUTHORIZED" } } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { code: "UNAUTHORIZED", message: "login", surprise: true } }, { status: 401 })));
    await expect(financeApi.forecast()).rejects.toMatchObject({ payload: { error: { code: "API_INVALID_RESPONSE" } } });
  });
  it("bounds stalled response bodies and preserves caller cancellation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 200, ok: true, headers: new Headers({ "content-type": "application/json" }), text: () => new Promise(() => {}) }));
    await expect(financeApi.forecast({ timeoutMs: 15 })).rejects.toMatchObject({ payload: { error: { code: "API_TIMEOUT" } } });
    const controller = new AbortController(); controller.abort();
    await expect(financeApi.forecast({ signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  });
});
