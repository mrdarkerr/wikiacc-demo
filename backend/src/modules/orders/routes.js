import { z } from "zod";

import { created, ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import {
  createOrderSchema,
  submitOrderFieldValuesSchema,
} from "./schemas.js";
import {
  createOrder,
  getMyOrder,
  listMyOrders,
  submitOrderFieldValues,
} from "./service.js";

const orderParamsSchema = z.object({ id: z.string().min(1) });
const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(50).default(10),
});

function paginationMeta(page, perPage, total) {
  return {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function orderRoutes(app) {
  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const input = parse(createOrderSchema, request.body);
    const order = await createOrder(app.prisma, request.user.id, input);
    return created(reply, { order });
  });

  app.get("/my", { preHandler: app.authenticate }, async (request, reply) => {
    const query = parse(paginationQuerySchema, request.query);
    const { orders, total } = await listMyOrders(app.prisma, request.user.id, query);
    return ok(reply, { orders }, paginationMeta(query.page, query.perPage, total));
  });

  app.get("/:id", { preHandler: app.authenticate }, async (request, reply) => {
    const params = parse(orderParamsSchema, request.params);
    const order = await getMyOrder(app.prisma, request.user.id, params.id);
    return ok(reply, { order });
  });

  app.post("/:id/field-values", { preHandler: app.authenticate }, async (request, reply) => {
    const params = parse(orderParamsSchema, request.params);
    const input = parse(submitOrderFieldValuesSchema, request.body);
    const order = await submitOrderFieldValues(
      app.prisma,
      request.user.id,
      params.id,
      input,
    );
    return ok(reply, { order });
  });
}
