import Ajv from "ajv";
import addFormats from "ajv-formats";
import { history, forecast } from "./service.js";
import { historyQuery, historyResponse, forecastResponse, errorResponse, responses } from "./contract.js";
import { AppError } from "../../shared/errors.js";
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateHistory = ajv.compile(historyResponse);
const validateForecast = ajv.compile(forecastResponse);
const validateError = ajv.compile(errorResponse);
export async function adminFinanceRoutes(app) {
  app.addSchema({ $id: "FinanceError", ...errorResponse });
  const requestAjv = new Ajv({ strict: false, coerceTypes: true, useDefaults: true, removeAdditional: false });
  app.setValidatorCompiler(({ schema }) => requestAjv.compile(schema));
  app.addHook("preHandler", app.requireAdmin);
  app.addHook("onSend", async (_request, reply, payload) => { reply.header("Cache-Control", "no-store"); return payload; });
  app.setErrorHandler((error, request, reply) => {
    let status = 500, code = "INTERNAL_SERVER_ERROR", message = "Unexpected server error";
    if (error.validation) { status = 400; code = "VALIDATION_ERROR"; message = "Invalid financial report query"; }
    else if (error instanceof AppError) { status = error.statusCode; code = error.code; message = error.message; }
    else if (error.statusCode === 429) { status = 429; code = "RATE_LIMITED"; message = "Too many requests"; }
    else request.log.error(error);
    reply.code(status).send({ error: { code, message } });
  });
  // Fastify response serializers can silently coerce/strip fields. Validate the
  // raw payload first so a backend contract bug cannot become plausible money.
  app.addHook("preSerialization", async (request, reply, payload) => {
    const validate = reply.statusCode === 200 ? (request.routeOptions.schema.operationId === "getFinanceHistory" ? validateHistory : validateForecast) : validateError;
    if (!validate(payload)) throw new Error("Financial response violates its OpenAPI contract");
    return payload;
  });
  const base = { tags: ["Admin finance"], security: [{ adminSession: [] }] };
  app.get("/history", { schema: { ...base, operationId: "getFinanceHistory", summary: "Paginated TOMAN turnover and frozen product margin",
    description: "Paid orders excluding cancelled/refunded; grouped by order creation in Tehran. Weeks Saturday–Friday, 8 weeks/page; days 7/page. page=1 is newest. Beyond oldest page is clamped. Historical unknown margins are null; partial known sums retain unknown item counts. No 200-order limit.",
    querystring: historyQuery, response: responses(historyResponse) } }, async (request, reply) => reply.send({ data: await history(app.prisma, request.query) }));
  app.get("/forecast", { schema: { ...base, operationId: "getFinanceForecast", summary: "7/30-day turnover and product-margin estimates",
    description: "Trailing daily average of up to 28 complete Tehran days (zero-sale days included), excluding today. At least 7 observed days and 3 paid orders required. Future ranges start tomorrow. Profit estimate null if any historical item margin is unknown. Not a guaranteed forecast or net profit; no prediction of future exchange rates.",
    querystring: { type: "object", additionalProperties: false, properties: {} }, response: responses(forecastResponse) } }, async (_request, reply) => reply.send({ data: await forecast(app.prisma) }));
}
