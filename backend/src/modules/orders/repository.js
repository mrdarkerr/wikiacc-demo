export function listUserOrders(prisma, userId) {
  return prisma.order.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          product: true,
          deliveries: true,
          fieldValues: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export function getUserOrder(prisma, userId, orderId) {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: {
        include: {
          product: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
          deliveries: true,
          fieldValues: true,
        },
      },
      tickets: true,
    },
  });
}
