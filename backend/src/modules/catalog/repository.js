export function listActiveCategories(prisma) {
  return prisma.productCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
}

export function listActiveProducts(prisma, filters = {}) {
  return prisma.product.findMany({
    where: {
      isActive: true,
      ...(filters.categorySlug
        ? { category: { slug: filters.categorySlug, isActive: true } }
        : {}),
    },
    include: {
      category: true,
      deliveryPool: {
        select: {
          id: true,
          slug: true,
          title: true,
          _count: {
            select: {
              items: { where: { status: "AVAILABLE" } },
            },
          },
        },
      },
      features: { orderBy: { sortOrder: "asc" } },
      fields: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
}

export function findActiveProductBySlug(prisma, slug) {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: true,
      deliveryPool: {
        include: {
          _count: {
            select: {
              items: { where: { status: "AVAILABLE" } },
            },
          },
        },
      },
      features: { orderBy: { sortOrder: "asc" } },
      fields: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export function findProductForOrder(prisma, productId) {
  return prisma.product.findFirst({
    where: { id: productId, isActive: true },
    include: {
      fields: { orderBy: { sortOrder: "asc" } },
      deliveryPool: true,
    },
  });
}
