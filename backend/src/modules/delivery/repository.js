import { conflict } from "../../shared/errors.js";

export async function allocateDeliveryItems(tx, poolId, orderItemId, quantity) {
  const deliveries = [];

  for (let index = 0; index < quantity; index += 1) {
    let claimedItem = null;

    for (let attempt = 0; attempt < 3 && !claimedItem; attempt += 1) {
      const candidate = await tx.deliveryItem.findFirst({
        where: { poolId, status: "AVAILABLE" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      if (!candidate) {
        throw conflict("OUT_OF_STOCK", "No ready delivery item is available");
      }

      const result = await tx.deliveryItem.updateMany({
        where: { id: candidate.id, status: "AVAILABLE" },
        data: {
          status: "DELIVERED",
          deliveredToOrderItemId: orderItemId,
          deliveredAt: new Date(),
        },
      });

      if (result.count === 1) {
        claimedItem = candidate;
      }
    }

    if (!claimedItem) {
      throw conflict("DELIVERY_RACE_RETRY_FAILED", "Could not safely claim a delivery item");
    }

    const delivery = await tx.orderDelivery.create({
      data: {
        orderItemId,
        deliveryItemId: claimedItem.id,
        contentSnapshot: claimedItem.content,
      },
    });
    deliveries.push(delivery);
  }

  return deliveries;
}

export function getPoolAvailability(prisma, poolId) {
  return prisma.deliveryItem.count({
    where: { poolId, status: "AVAILABLE" },
  });
}
