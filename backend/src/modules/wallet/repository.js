export function getWalletByUserId(prisma, userId) {
  return prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0 },
  });
}

export function listWalletTransactions(prisma, userId, { page = 1, perPage = 20 } = {}) {
  return prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
  });
}

export function countWalletTransactions(prisma, userId) {
  return prisma.walletTransaction.count({ where: { userId } });
}
