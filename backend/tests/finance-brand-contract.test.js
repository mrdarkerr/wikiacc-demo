import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
process.env.NODE_ENV = "test";
let app, env;
beforeAll(async () => {
  ({ env } = await import("../src/config/env.js"));
  const { buildApp } = await import("../src/app.js");
  app = await buildApp({ logger: false, enableJibitReconciliation: false });
  await app.ready();
});
afterAll(async () => { await app?.close(); });
describe("Gimi financial contract identity", () => {
  it("documents Gimi's actual authentication cookie without renaming production sessions", () => {
    expect(env.SESSION_COOKIE_NAME).toBe("gimiacc_session");
    expect(app.swagger().components.securitySchemes.adminSession.name).toBe(env.SESSION_COOKIE_NAME);
  });
  it("exports the Gimi finance title and same session scheme for SDK generation", () => {
    const exported = JSON.parse(readFileSync(new URL("../../docs/openapi-finance.json", import.meta.url), "utf8"));
    expect(exported.info.title).toBe("GimiAcc Admin Finance API");
    expect(exported.components.securitySchemes.adminSession).toEqual(app.swagger().components.securitySchemes.adminSession);
  });
});
