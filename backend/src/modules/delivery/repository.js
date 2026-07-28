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

export async function reserveDeliveryItems(tx, poolId, orderItemId, quantity) {
  const reservedItems = [];

  for (let index = 0; index < quantity; index += 1) {
    let reservedItem = null;

    for (let attempt = 0; attempt < 3 && !reservedItem; attempt += 1) {
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
          status: "RESERVED",
          reservedAt: new Date(),
          reservedForOrderItemId: orderItemId,
        },
      });

      if (result.count === 1) {
        reservedItem = candidate;
      }
    }

    if (!reservedItem) {
      throw conflict(
        "DELIVERY_RACE_RETRY_FAILED",
        "Could not safely reserve a delivery item",
      );
    }
    reservedItems.push(reservedItem);
  }

  return reservedItems;
}

export async function fulfillReservedDeliveryItems(tx, orderItemId, quantity) {
  const reservedItems = await tx.deliveryItem.findMany({
    where: { reservedForOrderItemId: orderItemId, status: "RESERVED" },
    orderBy: [{ reservedAt: "asc" }, { id: "asc" }],
    take: quantity,
  });

  if (reservedItems.length !== quantity) {
    throw conflict(
      "DELIVERY_RESERVATION_MISSING",
      "Reserved delivery inventory is incomplete",
    );
  }

  const deliveries = [];
  for (const item of reservedItems) {
    const claimed = await tx.deliveryItem.updateMany({
      where: {
        id: item.id,
        reservedForOrderItemId: orderItemId,
        status: "RESERVED",
      },
      data: {
        status: "DELIVERED",
        reservedAt: null,
        reservedForOrderItemId: null,
        deliveredAt: new Date(),
        deliveredToOrderItemId: orderItemId,
      },
    });
    if (claimed.count !== 1) {
      throw conflict(
        "DELIVERY_RACE_RETRY_FAILED",
        "Could not safely fulfill reserved inventory",
      );
    }

    deliveries.push(
      await tx.orderDelivery.create({
        data: {
          orderItemId,
          deliveryItemId: item.id,
          contentSnapshot: item.content,
        },
      }),
    );
  }

  return deliveries;
}

export function releaseDeliveryItems(tx, orderItemId) {
  return tx.deliveryItem.updateMany({
    where: { reservedForOrderItemId: orderItemId, status: "RESERVED" },
    data: {
      status: "AVAILABLE",
      reservedAt: null,
      reservedForOrderItemId: null,
    },
  });
}

export function getPoolAvailability(prisma, poolId) {
  return prisma.deliveryItem.count({
    where: { poolId, status: "AVAILABLE" },
  });
}
