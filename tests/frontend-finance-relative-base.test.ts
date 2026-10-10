import { afterEach, expect, it, vi } from "vitest";
import { history } from "../backend/src/modules/finance/service.js";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
it("resolves production's relative /api/v1 against the browser origin for the generated Request client", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "/api/v1");
  vi.stubGlobal("window", { location: { origin: "https://gimiacc.com" } });
  vi.resetModules();
  const { financeApi } = await import("../lib/finance-api");
  const payload = { data: await history({ order: { findFirst: async () => null, findMany: async () => [] } }) };
  const fetcher = vi.fn().mockResolvedValue(Response.json(payload));
  vi.stubGlobal("fetch", fetcher);
  expect(await financeApi.history({ interval: "daily", page: 1 })).toEqual(payload.data);
  expect(fetcher.mock.calls[0][0].url).toBe("https://gimiacc.com/api/v1/admin/finance/history?interval=daily&page=1");
});
