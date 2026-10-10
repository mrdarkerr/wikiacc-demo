const integer = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
const money = { ...integer, description: "Integer TOMAN; never IRR or current USD conversion." };
const nullableMoney = { ...money, nullable: true, description: "Null means unknown/unavailable, not zero. Profit excludes fees and operating expenses." };
const date = { type: "string", format: "date" };
const timestamp = { type: "string", format: "date-time" };
const literal = (value) => ({ type: "string", enum: [value] });
export const object = (properties) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const totals = { turnover: money, profit: nullableMoney, orderCount: integer, knownProfitItemCount: integer, unknownProfitItemCount: integer };
const context = { currency: literal("TOMAN"), timeZone: literal("Asia/Tehran"), dateBasis: literal("ORDER_CREATED_AT"), profitBasis: literal("FROZEN_PRODUCT_MARGIN_BEFORE_FEES"), generatedAt: timestamp };
export const historyResponse = object({ data: object({ ...context, interval: { type: "string", enum: ["daily", "weekly"] },
  range: object({ startDate: date, endDate: date }),
  pagination: object({ page: { type: "integer", minimum: 1 }, pageSize: { type: "integer", enum: [7, 8] }, totalPages: { type: "integer", minimum: 1 }, hasOlder: { type: "boolean" }, hasNewer: { type: "boolean" } }),
  totals: object(totals), points: { type: "array", minItems: 7, maxItems: 8, items: object({ startDate: date, endDate: date, isPartial: { type: "boolean" }, ...totals }) },
}) });
export const forecastResponse = object({ data: object({ ...context, method: literal("TRAILING_DAILY_AVERAGE"), status: { type: "string", enum: ["READY", "INSUFFICIENT_DATA"] },
  sample: object({ startDate: date, endDate: date, observedDays: { type: "integer", minimum: 0, maximum: 28 }, ...totals }),
  horizons: { type: "array", minItems: 2, maxItems: 2, items: object({ days: { type: "integer", enum: [7, 30] }, startDate: date, endDate: date, turnover: nullableMoney, profit: nullableMoney }) },
}) });
export const errorResponse = object({ error: object({ code: { type: "string" }, message: { type: "string" } }) });
export const responses = (success) => ({ 200: success, 400: { $ref: "FinanceError#" }, 401: { $ref: "FinanceError#" }, 403: { $ref: "FinanceError#" }, 429: { $ref: "FinanceError#" }, 500: { $ref: "FinanceError#" } });
export const historyQuery = { type: "object", additionalProperties: false, properties: {
  interval: { type: "string", enum: ["daily", "weekly"], default: "daily" },
  page: { type: "integer", minimum: 1, maximum: 100000, default: 1 },
} };
