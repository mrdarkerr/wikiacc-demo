import { fileURLToPath } from "node:url";

const config = {
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },

  test: {
    include: ["tests/frontend-*.test.ts"],
    environment: "node",
    globals: true,
    restoreMocks: true,
  },
};
export default config;
