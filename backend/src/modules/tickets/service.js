import { badRequest, notFound } from "../../shared/errors.js";
import { countUserTickets, getUserTicket, listUserTickets } from "./repository.js";

export async function createTicket(prisma, userId, input) {
  if (input.orderId) {
    const order = await prisma.order.findFirst({
      where: { id: input.orderId, userId },
    });
    if (!order) {
      throw badRequest("ORDER_NOT_FOUND", "Order does not belong to this user");
    }
  }

  return prisma.ticket.create({
    data: {
      userId,
      orderId: input.orderId,
      subject: input.subject,
      priority: input.priority,
      messages: {
        create: {
          senderId: userId,
          body: input.body,
          isAdmin: false,
        },
      },
    },
    include: {
      messages: true,
      order: { select: { id: true, status: true, totalAmount: true } },
    },
  });
}

export async function listMyTickets(prisma, userId, options) {
  const [tickets, total] = await Promise.all([
    listUserTickets(prisma, userId, options),
    countUserTickets(prisma, userId, options),
  ]);

  return { tickets, total };
}

export async function getMyTicket(prisma, userId, ticketId) {
  const ticket = await getUserTicket(prisma, userId, ticketId);
  if (!ticket) {
    throw notFound("TICKET_NOT_FOUND", "Ticket was not found");
  }
  return ticket;
}

export async function addTicketMessage(prisma, userId, ticketId, input, isAdmin = false) {
  const ticket = isAdmin
    ? await prisma.ticket.findUnique({ where: { id: ticketId } })
    : await prisma.ticket.findFirst({ where: { id: ticketId, userId } });

  if (!ticket) {
    throw notFound("TICKET_NOT_FOUND", "Ticket was not found");
  }

  await prisma.ticketMessage.create({
    data: {
      ticketId,
      senderId: userId,
      body: input.body,
      isAdmin,
    },
  });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: isAdmin ? "ANSWERED" : "OPEN" },
    include: {
      messages: {
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return isAdmin
    ? prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          user: { select: { id: true, email: true, name: true } },
          order: { select: { id: true, status: true, totalAmount: true } },
          messages: {
            include: { sender: { select: { id: true, name: true, role: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      })
    : getUserTicket(prisma, userId, ticketId);
}

export async function closeTicket(prisma, userId, ticketId) {
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, userId } });
  if (!ticket) {
    throw notFound("TICKET_NOT_FOUND", "Ticket was not found");
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: "CLOSED" },
  });

  return getUserTicket(prisma, userId, ticketId);
}
