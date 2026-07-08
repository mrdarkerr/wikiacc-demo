import cors from "@fastify/cors";
import fp from "fastify-plugin";

import { env } from "../config/env.js";

export const corsPlugin = fp(async (app) => {
  const allowedOrigins = new Set([
    env.WEB_APP_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);

  await app.register(cors, {
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed"), false);
    },
  });
});
