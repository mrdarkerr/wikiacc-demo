import { z } from "zod";

import { created, ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import {
  addTicketMessage,
  closeTicket,
  createTicket,
  getMyTicket,
  listMyTickets,
} from "./service.js";
import { createTicketMessageSchema, createTicketSchema } from "./schemas.js";

const ticketParamsSchema = z.object({ id: z.string().min(1) });

export async function ticketRoutes(app) {
  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const input = parse(createTicketSchema, request.body);
    const ticket = await createTicket(app.prisma, request.user.id, input);
    return created(reply, { ticket });
  });

  app.get("/my", { preHandler: app.authenticate }, async (request, reply) => {
    const tickets = await listMyTickets(app.prisma, request.user.id);
    return ok(reply, { tickets });
  });

  app.get("/:id", { preHandler: app.authenticate }, async (request, reply) => {
    const params = parse(ticketParamsSchema, request.params);
    const ticket = await getMyTicket(app.prisma, request.user.id, params.id);
    return ok(reply, { ticket });
  });

  app.post("/:id/messages", { preHandler: app.authenticate }, async (request, reply) => {
    const params = parse(ticketParamsSchema, request.params);
    const input = parse(createTicketMessageSchema, request.body);
    const ticket = await addTicketMessage(
      app.prisma,
      request.user.id,
      params.id,
      input,
      false,
    );
    return created(reply, { ticket });
  });

  app.patch("/:id/close", { preHandler: app.authenticate }, async (request, reply) => {
    const params = parse(ticketParamsSchema, request.params);
    const ticket = await closeTicket(app.prisma, request.user.id, params.id);
    return ok(reply, { ticket });
  });
}
