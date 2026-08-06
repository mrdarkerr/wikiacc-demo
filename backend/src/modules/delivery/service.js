import { conflict, notFound } from "../../shared/errors.js";

export async function createDeliveryPool(prisma, input) {
  return prisma.deliveryPool.create({ data: input });
}

export async function addDeliveryItems(prisma, poolId, input) {
  const pool = await prisma.deliveryPool.findUnique({ where: { id: poolId } });
  if (!pool) {
    throw notFound("DELIVERY_POOL_NOT_FOUND", "Delivery pool was not found");
  }

  const contents = input.items?.length ? input.items : [input.content];
  await prisma.deliveryItem.createMany({
    data: contents.map((content) => ({ poolId, content })),
  });

  return prisma.deliveryPool.findUnique({
    where: { id: poolId },
    include: {
      _count: {
        select: {
          items: { where: { status: "AVAILABLE" } },
        },
      },
    },
  });
}

export async function removeAvailableDeliveryItem(prisma, poolId, itemId) {
  const result = await prisma.deliveryItem.deleteMany({
    where: {
      id: itemId,
      poolId,
      status: "AVAILABLE",
    },
  });

  if (result.count === 1) {
    return { itemId };
  }

  const item = await prisma.deliveryItem.findUnique({
    where: { id: itemId },
    select: { poolId: true, status: true },
  });

  if (!item || item.poolId !== poolId) {
    throw notFound("DELIVERY_ITEM_NOT_FOUND", "Delivery item was not found");
  }

  throw conflict(
    "DELIVERY_ITEM_NOT_AVAILABLE",
    "Only available delivery items can be deleted",
    { status: item.status },
  );
}
