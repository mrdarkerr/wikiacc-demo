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

export async function orderRoutes(app) {
  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const input = parse(createOrderSchema, request.body);
    const order = await createOrder(app.prisma, request.user.id, input);
    return created(reply, { order });
  });

  app.get("/my", { preHandler: app.authenticate }, async (request, reply) => {
    const orders = await listMyOrders(app.prisma, request.user.id);
    return ok(reply, { orders });
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
