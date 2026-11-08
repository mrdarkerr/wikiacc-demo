import { randomUUID } from "node:crypto";
import { conflict, notFound } from "../../shared/errors.js";
import { getSettings, credential } from "./settings.js";
import { enqueueOrderCompletedNotification } from "../sms/notifications.js";
import { notifyOrder } from "../telegram/events.js";
import { TELEGRAM_EVENTS } from "../telegram/constants.js";
const eligible = {
  paymentStatus: "PAID",
  status: { notIn: ["CANCELLED", "REFUNDED"] },
};
const fence = (job) => ({
  id: job.id,
  status: "PROCESSING",
  leaseToken: job.leaseToken,
});
export async function assertSuperipChangeAllowed(tx, orderId, nextStatus) {
  const job = await tx.superipFulfillment.findFirst({
    where: { orderItem: { orderId } },
  });
  if (!job) return;
  if (nextStatus === "DELIVERED" && job.status === "DELIVERED") return;
  if (
    job.attempts > 0 ||
    !["CANCELLED", "REFUNDED", "READY"].includes(nextStatus)
  )
    throw conflict(
      "SUPERIP_ORDER_LOCKED",
      "Wallet fulfillment must be reconciled before changing or refunding the order",
    );
}
export async function retrySuperipOrder(prisma, orderId) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.superipFulfillment.findFirst({
      where: { orderItem: { orderId } },
    });
    if (!job)
      throw notFound(
        "SUPERIP_FULFILLMENT_NOT_FOUND",
        "Wallet fulfillment not found",
      );
    const result = await tx.superipFulfillment.updateMany({
      where: {
        id: job.id,
        status: { in: ["RETRY", "REVIEW_REQUIRED"] },
        orderItem: { order: eligible },
      },
      data: {
        status: "RETRY",
        nextAttemptAt: new Date(),
        lastErrorCode: null,
        attempts: job.attempts,
      },
    });
    return result.count;
  });
}
export async function runSuperipBatch(
  prisma,
  client,
  { now = new Date(), limit = 10 } = {},
) {
  const settings = await getSettings(prisma);
  if (!settings?.enabled || !settings.secretEncrypted) return;
  for (let i = 0; i < limit; i++) {
    const due = {
      orderItem: { order: eligible },
      OR: [
        { status: { in: ["PENDING", "RETRY"] }, nextAttemptAt: { lte: now } },
        { status: "PROCESSING", leaseExpiresAt: { lte: now } },
      ],
    };
    const candidate = await prisma.superipFulfillment.findFirst({
      where: due,
      orderBy: { createdAt: "asc" },
    });
    if (!candidate) return;
    const token = randomUUID();
    const claimed = await prisma.superipFulfillment.updateMany({
      where: { id: candidate.id, ...due },
      data: {
        status: "PROCESSING",
        leaseToken: token,
        leaseExpiresAt: new Date(now.getTime() + 60000),
        attempts: { increment: 1 },
      },
    });
    if (!claimed.count) continue;
    const job = {
      ...candidate,
      leaseToken: token,
      attempts: candidate.attempts + 1,
    };
    try {
      const current = await getSettings(prisma);
      if (
        !current?.enabled ||
        !current.secretEncrypted ||
        current.endpoint !== job.endpoint
      )
        throw Object.assign(new Error(), { code: "CONFIGURATION_CHANGED" });
      const live = await prisma.superipFulfillment.count({
        where: { ...fence(job), orderItem: { order: eligible } },
      });
      if (!live) continue;
      const body = {
        reference: job.reference,
        username: job.username,
        amount: job.amount,
      };
      const receipt = await client.credit(
        job.endpoint,
        credential(current),
        body,
      );
      if (
        receipt?.status !== "credited" ||
        receipt.reference !== body.reference ||
        receipt.username !== body.username ||
        receipt.amount !== body.amount ||
        typeof receipt.receiptId !== "string" ||
        !receipt.receiptId ||
        receipt.receiptId.length > 120
      )
        throw Object.assign(new Error(), { code: "RECEIPT_MISMATCH" });
      await prisma.$transaction(async (tx) => {
        const currentJob = await tx.superipFulfillment.findFirst({
          where: { ...fence(job), orderItem: { order: eligible } },
          include: {
            orderItem: {
              include: {
                order: { include: { user: { select: { phone: true } } } },
              },
            },
          },
        });
        if (!currentJob) return;
        await tx.superipFulfillment.update({
          where: { id: job.id },
          data: {
            status: "DELIVERED",
            receiptId: receipt.receiptId,
            deliveredAt: now,
            leaseToken: null,
            leaseExpiresAt: null,
            lastErrorCode: null,
          },
        });
        await tx.orderDelivery.create({
          data: {
            orderItemId: job.orderItemId,
            contentSnapshot: `شارژ کیف پول نمایندگی سوپر ایپی\nنام کاربری: ${job.username}\nمبلغ: ${job.amount} تومان\nرسید: ${receipt.receiptId}`,
          },
        });
        const order = currentJob.orderItem.order;
        const done = await tx.order.updateMany({
          where: {
            id: order.id,
            ...eligible,
            status: { notIn: ["DELIVERED", "CANCELLED", "REFUNDED"] },
          },
          data: { status: "DELIVERED" },
        });
        if (done.count) {
          await notifyOrder(tx, order.id, TELEGRAM_EVENTS.ORDER_DELIVERED);
          await enqueueOrderCompletedNotification(tx, {
            orderId: order.id,
            userPhone: order.user.phone,
          });
        }
      });
    } catch (error) {
      const code = ["CONFIGURATION_CHANGED", "RECEIPT_MISMATCH"].includes(
        error?.code,
      )
        ? error.code
        : /^HTTP_[45]\d\d$/.test(error?.code)
          ? error.code
          : "REQUEST_FAILED";
      const review =
        job.attempts >= 8 ||
        [
          "CONFIGURATION_CHANGED",
          "RECEIPT_MISMATCH",
          "HTTP_400",
          "HTTP_401",
          "HTTP_403",
          "HTTP_404",
          "HTTP_409",
        ].includes(code);
      await prisma.superipFulfillment.updateMany({
        where: fence(job),
        data: {
          status: review ? "REVIEW_REQUIRED" : "RETRY",
          lastErrorCode: code,
          leaseToken: null,
          leaseExpiresAt: null,
          nextAttemptAt: new Date(
            now.getTime() +
              Math.min(30000 * 2 ** Math.min(job.attempts - 1, 10), 3600000),
          ),
        },
      });
    }
  }
}
export function startSuperipWorker(
  prisma,
  client,
  { logger, intervalMs = 10000 } = {},
) {
  let running = null;
  const run = () => {
    if (!running)
      running = runSuperipBatch(prisma, client)
        .catch(() => logger?.error("SuperIP wallet worker cycle failed"))
        .finally(() => {
          running = null;
        });
    return running;
  };
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  void run();
  return {
    stop: async () => {
      clearInterval(timer);
      await running;
    },
  };
}
