import { SHAREBOX_FULFILLMENT_SELECT } from "../sharebox/constants.js";

export function listUserOrders(prisma, userId, { page = 1, perPage = 20 } = {}) {
  return prisma.order.findMany({
    where: { userId },
    include: {
      items: {
        include: {
          product: true,
          deliveries: true,
          shareboxFulfillments: {
            select: SHAREBOX_FULFILLMENT_SELECT,
            orderBy: { unitIndex: "asc" },
          },
          fieldValues: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
  });
}

export function countUserOrders(prisma, userId) {
  return prisma.order.count({ where: { userId } });
}

export function getUserOrder(prisma, userId, orderId) {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: {
        include: {
          product: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
          deliveries: true,
          shareboxFulfillments: {
            select: SHAREBOX_FULFILLMENT_SELECT,
            orderBy: { unitIndex: "asc" },
          },
          fieldValues: true,
        },
      },
      tickets: true,
    },
  });
}
