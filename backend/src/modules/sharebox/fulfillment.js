import { randomUUID } from "node:crypto";

import {
  badRequest,
  conflict,
  notFound,
  serviceUnavailable,
} from "../../shared/errors.js";
import { enqueueOrderCompletedNotification } from "../sms/notifications.js";
import { SHAREBOX_SETTINGS_ID } from "./constants.js";
import { ShareboxApiError } from "./client.js";
import {
  requireEnabledShareboxCredential,
  shareboxApiOrigin,
} from "./settings.js";

const TERMINAL_ERROR_CODES = new Set([
  "API_KEY_INVALID",
  "API_KEY_REVOKED",
  "AUTH_REQUIRED",
  "CATEGORY_ALLOCATION_DISABLED",
  "EXTERNAL_ID_CONFLICT",
  "LICENSE_KEY_REPLACED",
  "PAYLOAD_TOO_LARGE",
  "RESOURCE_NOT_FOUND",
  "VALIDATION_ERROR",
]);
const MAX_AUTOMATIC_ATTEMPTS = 8;
const SAFE_STORED_ERROR_CODES = new Set([
  ...TERMINAL_ERROR_CODES,
  "CAPACITY_UNAVAILABLE",
  "INTERNAL_ERROR",
  "RATE_LIMITED",
  "SHAREBOX_CONFIGURATION_CHANGED",
  "SHAREBOX_DISABLED",
  "SHAREBOX_INVALID_RESPONSE",
  "SHAREBOX_NOT_CONFIGURED",
  "SHAREBOX_RECEIPT_MISMATCH",
  "SHAREBOX_REQUEST_FAILED",
  "SHAREBOX_TIMEOUT",
]);

function safeStoredErrorCode(error) {
  const code = error?.code;
  if (typeof code !== "string") return "SHAREBOX_REQUEST_FAILED";
  if (SAFE_STORED_ERROR_CODES.has(code)) return code;
  if (/^SHAREBOX_HTTP_(?:4\d\d|5\d\d)$/.test(code)) return code;
  return "SHAREBOX_REQUEST_FAILED";
}

export function customerOrderCode(orderId) {
  return `WKA-${orderId.slice(-6).toUpperCase()}`;
}

export function validateShareboxCheckout(product, user, settings, baseUrl) {
  if (product.type !== "SHAREBOX") return null;
  if (!product.shareboxCategoryId || !product.shareboxCategoryName) {
    throw badRequest(
      "SHAREBOX_CATEGORY_MISSING",
      "The product has no valid ShareBox category",
    );
  }
  const customerName = user?.name?.trim();
  const customerPhone = user?.phone?.trim();
  if (!customerName || !customerPhone) {
    throw badRequest(
      "SHAREBOX_CUSTOMER_DETAILS_REQUIRED",
      "A customer name and phone are required for ShareBox fulfillment",
    );
  }
  if (customerName.length > 100 || customerPhone.length > 50) {
    throw badRequest(
      "SHAREBOX_CUSTOMER_DETAILS_INVALID",
      "ShareBox customer name or phone is too long",
    );
  }
  if (!settings?.enabled || !settings.apiKeyEncrypted || !settings.apiKeyFingerprint) {
    throw serviceUnavailable(
      "SHAREBOX_NOT_CONFIGURED",
      "ShareBox fulfillment is not configured",
    );
  }
  return {
    apiKeyFingerprint: settings.apiKeyFingerprint,
    apiOrigin: shareboxApiOrigin(baseUrl),
    categoryId: product.shareboxCategoryId,
    categoryName: product.shareboxCategoryName,
    customerName,
    customerPhone,
  };
}

export async function createShareboxFulfillmentSnapshots(
  tx,
  { order, orderItem, quantity, snapshot },
) {
  if (!snapshot) return 0;
  await tx.shareboxFulfillment.createMany({
    data: Array.from({ length: quantity }, (_, index) => ({
      orderItemId: orderItem.id,
      unitIndex: index + 1,
      externalId: `${orderItem.id}:${index + 1}`,
      categoryId: snapshot.categoryId,
      categoryName: snapshot.categoryName,
      reference: customerOrderCode(order.id),
      customerName: snapshot.customerName,
      customerPhone: snapshot.customerPhone,
      apiKeyFingerprint: snapshot.apiKeyFingerprint,
      apiOrigin: snapshot.apiOrigin,
    })),
  });
  return quantity;
}

async function updateClaimedJob(prisma, job, data) {
  return prisma.shareboxFulfillment.updateMany({
    where: {
      id: job.id,
      status: "PROCESSING",
      leaseToken: job.leaseToken,
    },
    data: {
      ...data,
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
}

function retryDelayMs(attempts, retryAfter) {
  if (retryAfter !== undefined) {
    return Math.min(Math.max(retryAfter, 1) * 1000, 24 * 60 * 60 * 1000);
  }
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 60 * 60 * 1000);
}

async function failClaimedJob(prisma, job, error, now) {
  const code = safeStoredErrorCode(error);
  const reviewRequired =
    TERMINAL_ERROR_CODES.has(code) || job.attempts >= MAX_AUTOMATIC_ATTEMPTS;
  await updateClaimedJob(prisma, job, {
    status: reviewRequired ? "REVIEW_REQUIRED" : "RETRY",
    lastErrorCode: code,
    nextAttemptAt: reviewRequired
      ? now
      : new Date(
          now.getTime() + retryDelayMs(job.attempts, error?.retryAfterSeconds),
        ),
  });
  return reviewRequired ? "review" : "retry";
}

function receiptMatches(job, receipt) {
  return (
    receipt.license.category_id === job.categoryId &&
    receipt.license.reference === job.reference &&
    receipt.license.label === `${job.customerName} | ${job.customerPhone}`
  );
}

async function persistReceipt(prisma, job, receipt, now) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.shareboxFulfillment.findFirst({
      where: {
        id: job.id,
        status: "PROCESSING",
        leaseToken: job.leaseToken,
      },
      select: {
        id: true,
        orderItemId: true,
        orderItem: {
          select: {
            order: {
              select: {
                id: true,
                paymentStatus: true,
                status: true,
                user: { select: { phone: true } },
              },
            },
          },
        },
      },
    });
    if (!current) return false;
    const order = current.orderItem.order;
    if (
      order.paymentStatus !== "PAID" ||
      ["CANCELLED", "REFUNDED"].includes(order.status)
    ) {
      await tx.shareboxFulfillment.update({
        where: { id: current.id },
        data: {
          status: "REVIEW_REQUIRED",
          lastErrorCode: "ORDER_NO_LONGER_ELIGIBLE",
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      return false;
    }

    const expiry = new Date(receipt.license.expires_at);
    await tx.orderDelivery.upsert({
      where: { shareboxFulfillmentId: current.id },
      update: {},
      create: {
        orderItemId: current.orderItemId,
        shareboxFulfillmentId: current.id,
        contentSnapshot: `ShareBox license: ${receipt.license_key}\nExpires at: ${expiry.toISOString()}`,
      },
    });
    await tx.shareboxFulfillment.update({
      where: { id: current.id },
      data: {
        status: "DELIVERED",
        lastErrorCode: null,
        nextAttemptAt: now,
        leaseToken: null,
        leaseExpiresAt: null,
        receiptLicenseId: receipt.license.id,
        receiptIssuedAt: new Date(receipt.license.issued_at),
        receiptExpiresAt: expiry,
        deliveredAt: now,
      },
    });

    const remaining = await tx.shareboxFulfillment.count({
      where: {
        orderItem: { orderId: order.id },
        status: { not: "DELIVERED" },
      },
    });
    if (remaining === 0) {
      const completed = await tx.order.updateMany({
        where: {
          id: order.id,
          paymentStatus: "PAID",
          status: { notIn: ["DELIVERED", "CANCELLED", "REFUNDED"] },
        },
        data: { status: "DELIVERED" },
      });
      if (completed.count === 1) {
        await enqueueOrderCompletedNotification(tx, {
          orderId: order.id,
          userPhone: order.user.phone,
        });
      }
    }
    return true;
  });
}

export async function claimShareboxFulfillment(
  prisma,
  { leaseMs = 30_000, now = new Date() } = {},
) {
  for (let scan = 0; scan < 5; scan += 1) {
    const candidate = await prisma.shareboxFulfillment.findFirst({
      where: {
        orderItem: {
          order: {
            paymentStatus: "PAID",
            status: { notIn: ["CANCELLED", "REFUNDED"] },
          },
        },
        OR: [
          {
            status: { in: ["PENDING", "RETRY"] },
            nextAttemptAt: { lte: now },
          },
          {
            status: "PROCESSING",
            leaseExpiresAt: { lte: now },
          },
        ],
      },
      orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!candidate) return null;
    const leaseToken = randomUUID();
    const claimed = await prisma.shareboxFulfillment.updateMany({
      where: {
        id: candidate.id,
        orderItem: {
          order: {
            paymentStatus: "PAID",
            status: { notIn: ["CANCELLED", "REFUNDED"] },
          },
        },
        OR: [
          {
            status: { in: ["PENDING", "RETRY"] },
            nextAttemptAt: { lte: now },
          },
          {
            status: "PROCESSING",
            leaseExpiresAt: { lte: now },
          },
        ],
      },
      data: {
        status: "PROCESSING",
        leaseToken,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
      },
    });
    if (claimed.count === 1) {
      return prisma.shareboxFulfillment.findUnique({
        where: { id: candidate.id },
      });
    }
  }
  return null;
}

export async function processShareboxFulfillment(
  prisma,
  client,
  job,
  { logger, now = new Date() } = {},
) {
  let credential;
  try {
    const settings = await prisma.shareboxSettings.findUnique({
      where: { id: SHAREBOX_SETTINGS_ID },
    });
    credential = requireEnabledShareboxCredential(settings);
    if (
      credential.fingerprint !== job.apiKeyFingerprint ||
      client.origin !== job.apiOrigin
    ) {
      await updateClaimedJob(prisma, job, {
        status: "REVIEW_REQUIRED",
        lastErrorCode: "SHAREBOX_CONFIGURATION_CHANGED",
        nextAttemptAt: now,
      });
      return "review";
    }
  } catch (error) {
    return failClaimedJob(prisma, job, error, now);
  }

  const started = await prisma.shareboxFulfillment.updateMany({
    where: {
      id: job.id,
      status: "PROCESSING",
      leaseToken: job.leaseToken,
      orderItem: {
        order: {
          paymentStatus: "PAID",
          status: { notIn: ["CANCELLED", "REFUNDED"] },
        },
      },
    },
    data: { attempts: { increment: 1 } },
  });
  if (started.count !== 1) {
    await updateClaimedJob(prisma, job, {
      status: "REVIEW_REQUIRED",
      lastErrorCode: "ORDER_NO_LONGER_ELIGIBLE",
      nextAttemptAt: now,
    });
    return "stale";
  }
  job.attempts += 1;

  let receipt;
  try {
    receipt = await client.issueLicense(credential.apiKey, {
      external_id: job.externalId,
      category_id: job.categoryId,
      reference: job.reference,
      customer_name: job.customerName,
      customer_phone: job.customerPhone,
    });
    if (!receiptMatches(job, receipt)) {
      throw new ShareboxApiError("ShareBox receipt did not match the request", {
        code: "SHAREBOX_RECEIPT_MISMATCH",
      });
    }
  } catch (error) {
    logger?.warn?.(
      { fulfillmentId: job.id, errorCode: safeStoredErrorCode(error) },
      "ShareBox fulfillment attempt failed",
    );
    return failClaimedJob(prisma, job, error, now);
  }

  return (await persistReceipt(prisma, job, receipt, now))
    ? "delivered"
    : "stale";
}

export async function runShareboxFulfillmentBatch(
  prisma,
  client,
  { batchSize = 10, leaseMs = 30_000, logger, now } = {},
) {
  const result = { claimed: 0, delivered: 0, retried: 0, review: 0 };
  for (let index = 0; index < batchSize; index += 1) {
    const job = await claimShareboxFulfillment(prisma, { leaseMs, now });
    if (!job) break;
    result.claimed += 1;
    const outcome = await processShareboxFulfillment(prisma, client, job, {
      logger,
      now: now ?? new Date(),
    });
    if (outcome === "delivered") result.delivered += 1;
    if (outcome === "retry") result.retried += 1;
    if (outcome === "review") result.review += 1;
  }
  return result;
}

export function startShareboxFulfillmentWorker(
  prisma,
  client,
  {
    batchSize = 10,
    intervalMs = 10_000,
    leaseMs = 30_000,
    logger,
  } = {},
) {
  let currentRun = null;
  let stopping = false;
  const runNow = () => {
    if (stopping) return Promise.resolve(null);
    if (currentRun) return currentRun;
    currentRun = runShareboxFulfillmentBatch(prisma, client, {
      batchSize,
      leaseMs,
      logger,
    })
      .catch((error) => {
        logger?.error?.({ err: error }, "ShareBox fulfillment cycle failed");
      })
      .finally(() => {
        currentRun = null;
      });
    return currentRun;
  };
  const timer = setInterval(() => void runNow(), intervalMs);
  timer.unref?.();
  void runNow();
  return {
    runNow,
    async stop() {
      stopping = true;
      clearInterval(timer);
      await currentRun;
    },
  };
}

export async function retryShareboxOrder(prisma, orderId, origin) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      paymentStatus: true,
      status: true,
      items: {
        select: {
          shareboxFulfillments: {
            select: {
              id: true,
              status: true,
              apiKeyFingerprint: true,
              apiOrigin: true,
            },
          },
        },
      },
    },
  });
  if (!order) throw notFound("ORDER_NOT_FOUND", "Order was not found");
  if (order.paymentStatus !== "PAID" || ["CANCELLED", "REFUNDED"].includes(order.status)) {
    throw conflict(
      "SHAREBOX_ORDER_NOT_ELIGIBLE",
      "Only paid, active ShareBox orders can be retried",
    );
  }
  const jobs = order.items.flatMap((item) => item.shareboxFulfillments);
  const retryable = jobs.filter((job) =>
    ["RETRY", "REVIEW_REQUIRED"].includes(job.status),
  );
  if (!retryable.length) return 0;
  const settings = await prisma.shareboxSettings.findUnique({
    where: { id: SHAREBOX_SETTINGS_ID },
  });
  const credential = requireEnabledShareboxCredential(settings);
  const normalizedOrigin = shareboxApiOrigin(origin);
  if (
    retryable.some(
      (job) =>
        job.apiKeyFingerprint !== credential.fingerprint ||
        job.apiOrigin !== normalizedOrigin,
    )
  ) {
    throw conflict(
      "SHAREBOX_CONFIGURATION_CHANGED",
      "This order was created with a different ShareBox credential or origin and requires reconciliation",
    );
  }
  const result = await prisma.shareboxFulfillment.updateMany({
    where: {
      id: { in: retryable.map((job) => job.id) },
      status: { in: ["RETRY", "REVIEW_REQUIRED"] },
    },
    data: {
      status: "RETRY",
      nextAttemptAt: new Date(),
      leaseToken: null,
      leaseExpiresAt: null,
    },
  });
  return result.count;
}

export async function assertShareboxStatusChangeAllowed(
  tx,
  orderId,
  currentStatus,
  nextStatus,
) {
  if (currentStatus === nextStatus) return;
  const [attempted, incomplete] = await Promise.all([
    tx.shareboxFulfillment.count({
      where: { orderItem: { orderId }, attempts: { gt: 0 } },
    }),
    tx.shareboxFulfillment.count({
      where: { orderItem: { orderId }, status: { not: "DELIVERED" } },
    }),
  ]);
  if (attempted > 0) {
    throw conflict(
      "SHAREBOX_FULFILLMENT_STATUS_LOCKED",
      "The order has attempted ShareBox issuance and must be reconciled before changing its status",
    );
  }
  if (nextStatus === "DELIVERED" && incomplete > 0) {
    throw conflict(
      "SHAREBOX_FULFILLMENT_INCOMPLETE",
      "The order cannot be marked delivered before all ShareBox units are delivered",
    );
  }
}

export async function assertShareboxRefundAllowed(tx, orderId) {
  const attempted = await tx.shareboxFulfillment.count({
    where: { orderItem: { orderId }, attempts: { gt: 0 } },
  });
  if (attempted > 0) {
    throw conflict(
      "SHAREBOX_FULFILLMENT_REFUND_LOCKED",
      "The order has attempted ShareBox issuance and must be reconciled before refunding",
    );
  }
}
