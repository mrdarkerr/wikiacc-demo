function userTicketWhere(userId, { search, status } = {}) {
  const where = { userId };

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { subject: { contains: search } },
      { orderId: { contains: search } },
      { messages: { some: { body: { contains: search } } } },
    ];
  }

  return where;
}

export function listUserTickets(prisma, userId, options = {}) {
  const page = options.page ?? 1;
  const perPage = options.perPage ?? 20;

  return prisma.ticket.findMany({
    where: userTicketWhere(userId, options),
    include: {
      order: { select: { id: true, status: true, totalAmount: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
  });
}

export function countUserTickets(prisma, userId, options = {}) {
  return prisma.ticket.count({ where: userTicketWhere(userId, options) });
}

export function getUserTicket(prisma, userId, ticketId) {
  return prisma.ticket.findFirst({
    where: { id: ticketId, userId },
    include: {
      order: { select: { id: true, status: true, totalAmount: true } },
      messages: {
        include: { sender: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}
