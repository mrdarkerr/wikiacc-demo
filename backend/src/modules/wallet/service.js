import { paymentRequired } from "../../shared/errors.js";
import { getWalletByUserId, listWalletTransactions } from "./repository.js";

export async function getWalletSummary(prisma, userId) {
  const wallet = await getWalletByUserId(prisma, userId);
  const transactions = await listWalletTransactions(prisma, userId);
  return { wallet, transactions };
}

export async function adjustWalletByAdmin(prisma, adminId, userId, type, input) {
  const signedAmount = type === "ADMIN_DEBIT" ? -input.amount : input.amount;

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });

    if (wallet.balance + signedAmount < 0) {
      throw paymentRequired(
        "INSUFFICIENT_WALLET_BALANCE",
        "Wallet balance cannot become negative",
      );
    }

    const updatedWallet = await tx.wallet.update({
      where: { userId },
      data: { balance: { increment: signedAmount } },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        userId,
        createdByAdminId: adminId,
        amount: signedAmount,
        type,
        status: "COMPLETED",
        referenceType: "ADMIN_ADJUSTMENT",
        note: input.note,
      },
    });

    return { wallet: updatedWallet, transaction };
  });
}

export async function refundOrderByAdmin(prisma, adminId, orderId, note) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
    });

    if (!order || order.paymentStatus !== "PAID") {
      return null;
    }

    const updatedWallet = await tx.wallet.update({
      where: { userId: order.userId },
      data: { balance: { increment: order.totalAmount } },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        userId: order.userId,
        createdByAdminId: adminId,
        amount: order.totalAmount,
        type: "ORDER_REFUND",
        status: "COMPLETED",
        referenceType: "ORDER",
        referenceId: order.id,
        note,
      },
    });

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "REFUNDED",
        paymentStatus: "REFUNDED",
      },
    });

    return { wallet: updatedWallet, transaction, order: updatedOrder };
  });
}
