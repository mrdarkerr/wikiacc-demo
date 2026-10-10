import { defineConfig } from "@hey-api/openapi-ts";
export default defineConfig({
  input: "./docs/openapi-finance.json",
  output: "lib/generated/finance",
  plugins: ["@hey-api/typescript", "@hey-api/client-fetch", { name: "zod", definitions: true, requests: true, responses: true,
    $resolvers: { object: (ctx) => ctx.nodes.base(ctx).attr("strict").call() },
  }, { name: "@hey-api/sdk", validator: true }],
});
