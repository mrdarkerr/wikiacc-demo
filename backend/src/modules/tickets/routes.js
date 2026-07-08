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
const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(50).default(20),
});
const ticketListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.enum(["OPEN", "ANSWERED", "CLOSED"]).optional(),
});

function paginationMeta(page, perPage, total) {
  return {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function ticketRoutes(app) {
  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const input = parse(createTicketSchema, request.body);
    const ticket = await createTicket(app.prisma, request.user.id, input);
    return created(reply, { ticket });
  });

  app.get("/my", { preHandler: app.authenticate }, async (request, reply) => {
    const query = parse(ticketListQuerySchema, request.query);
    const { tickets, total } = await listMyTickets(app.prisma, request.user.id, query);
    return ok(reply, { tickets }, paginationMeta(query.page, query.perPage, total));
  });

  app.get("/:id", { preHandler: app.authenticate }, async (request, reply) => {
    const params = parse(ticketParamsSchema, request.params);
    const ticket = await getMyTicket(app.prisma, request.user.id, params.id);
    return ok(reply, { ticket });
  });

  app.get("/:id/messages", { preHandler: app.authenticate }, async (request, reply) => {
    const params = parse(ticketParamsSchema, request.params);
    const query = parse(paginationQuerySchema, request.query);
    await getMyTicket(app.prisma, request.user.id, params.id);

    const [messages, total] = await Promise.all([
      app.prisma.ticketMessage.findMany({
        where: { ticketId: params.id },
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      app.prisma.ticketMessage.count({ where: { ticketId: params.id } }),
    ]);

    return ok(
      reply,
      { messages: messages.reverse() },
      paginationMeta(query.page, query.perPage, total),
    );
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
