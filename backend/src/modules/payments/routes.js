import { ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import {
  jibitCallbackBodySchema,
  jibitCallbackQuerySchema,
  paymentOrderParamsSchema,
} from "./schemas.js";
import {
  processJibitCallback,
  verifyJibitOrderForUser,
} from "./service.js";

const RETRYABLE_JIBIT_ERRORS = new Set([
  "JIBIT_INQUIRY_INVALID",
  "JIBIT_INVALID_RESPONSE",
  "JIBIT_REQUEST_FAILED",
  "JIBIT_TOKEN_INVALID",
  "JIBIT_UNAVAILABLE",
]);

function providerPurchaseId(body, query) {
  const value = body?.purchaseIdStr ?? body?.purchaseId ?? query?.purchaseId;
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;
}

function resultUrl(baseUrl, result) {
  const url = new URL("/payment/result", baseUrl);
  url.searchParams.set("order", result.orderId);
  url.searchParams.set("status", result.status);
  return url.toString();
}

function redirectToResult(reply, url) {
  return reply.header("Cache-Control", "no-store").code(303).redirect(url);
}

export async function paymentRoutes(app, options) {
  const callbackHandler = async (request, reply) => {
    const query = parse(jibitCallbackQuerySchema, request.query);
    const body = parse(jibitCallbackBodySchema, request.body ?? {});
    try {
      const result = await processJibitCallback(
        app.prisma,
        options.jibitClient,
        {
          attemptId: query.attempt,
          providerPurchaseId: providerPurchaseId(body, request.query),
        },
        { reconcileMinutes: options.jibitReconcileMinutes },
      );
      return redirectToResult(reply, resultUrl(options.webAppUrl, result));
    } catch (error) {
      if (!RETRYABLE_JIBIT_ERRORS.has(error?.code)) throw error;
      const attempt = await app.prisma.paymentAttempt.findUnique({
        where: { id: query.attempt },
        select: { orderId: true },
      });
      if (!attempt) throw error;
      app.log.warn(
        { err: error, paymentAttemptId: query.attempt },
        "Jibit callback verification will be retried",
      );
      return redirectToResult(
        reply,
        resultUrl(options.webAppUrl, {
          orderId: attempt.orderId,
          status: "pending",
        }),
      );
    }
  };

  app.post(
    "/jibit/callback",
    { config: { rateLimit: { max: 300, timeWindow: "1 minute" } } },
    callbackHandler,
  );
  app.get(
    "/jibit/callback",
    { config: { rateLimit: { max: 300, timeWindow: "1 minute" } } },
    callbackHandler,
  );

  app.post(
    "/jibit/orders/:orderId/verify",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = parse(paymentOrderParamsSchema, request.params);
      const result = await verifyJibitOrderForUser(
        app.prisma,
        options.jibitClient,
        request.user.id,
        params.orderId,
        { reconcileMinutes: options.jibitReconcileMinutes },
      );
      return ok(reply, { payment: result });
    },
  );
}
