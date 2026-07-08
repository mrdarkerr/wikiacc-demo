import { notFound } from "../../shared/errors.js";

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
