import { fileURLToPath } from "node:url";

const config = {
  resolve: { alias: {
    "@": fileURLToPath(new URL(".", import.meta.url)),
    // Older frontend tests imported the backend copy. Resolve one Vitest
    // instance so the browser interaction tests share the active runner.
    "../backend/node_modules/vitest": fileURLToPath(new URL("./node_modules/vitest/dist/index.js", import.meta.url)),
  } },

  test: {
    include: ["tests/frontend-*.test.ts"],
    environment: "node",
    globals: true,
    restoreMocks: true,
  },
};
export default config;
