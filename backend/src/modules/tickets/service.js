import { badRequest, notFound } from "../../shared/errors.js";
import {
  enqueueTicketCreatedNotifications,
  enqueueTicketMessageNotification,
} from "../sms/notifications.js";
import { countUserTickets, getUserTicket, listUserTickets } from "./repository.js";

export async function createTicket(prisma, userId, input) {
  return prisma.$transaction(async (tx) => {
    if (input.orderId) {
      const order = await tx.order.findFirst({
        where: { id: input.orderId, userId },
      });
      if (!order) {
        throw badRequest("ORDER_NOT_FOUND", "Order does not belong to this user");
      }
    }

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phone: true },
    });

    const ticket = await tx.ticket.create({
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

    await enqueueTicketCreatedNotifications(tx, {
      messageId: ticket.messages[0].id,
      ticketId: ticket.id,
      userPhone: user.phone,
    });

    return ticket;
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
  return prisma.$transaction(async (tx) => {
    const ticket = isAdmin
      ? await tx.ticket.findUnique({
          where: { id: ticketId },
          include: { user: { select: { phone: true } } },
        })
      : await tx.ticket.findFirst({
          where: { id: ticketId, userId },
          include: { user: { select: { phone: true } } },
        });

    if (!ticket) {
      throw notFound("TICKET_NOT_FOUND", "Ticket was not found");
    }

    const message = await tx.ticketMessage.create({
      data: {
        ticketId,
        senderId: userId,
        body: input.body,
        isAdmin,
      },
    });

    await tx.ticket.update({
      where: { id: ticketId },
      data: { status: isAdmin ? "ANSWERED" : "OPEN" },
    });

    await enqueueTicketMessageNotification(tx, {
      isAdmin,
      messageId: message.id,
      ticketId,
      userPhone: ticket.user.phone,
    });

    return isAdmin
      ? tx.ticket.findUnique({
          where: { id: ticketId },
          include: {
            user: { select: { id: true, email: true, name: true } },
            order: { select: { id: true, status: true, totalAmount: true } },
            messages: {
              include: {
                sender: { select: { id: true, name: true, role: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        })
      : getUserTicket(tx, userId, ticketId);
  });
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
