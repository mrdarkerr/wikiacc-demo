export function listUserTickets(prisma, userId) {
  return prisma.ticket.findMany({
    where: { userId },
    include: {
      order: { select: { id: true, status: true, totalAmount: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
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
