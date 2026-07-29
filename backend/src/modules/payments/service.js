import { randomUUID } from "node:crypto";

import {
  badRequest,
  conflict,
  notFound,
  serviceUnavailable,
} from "../../shared/errors.js";
import {
  fulfillReservedDeliveryItems,
  releaseDeliveryItems,
} from "../delivery/repository.js";
import {
  createPendingJibitOrder,
  failPendingJibitOrder,
} from "../orders/service.js";

const ACTIVE_ATTEMPT_STATUSES = ["CREATED", "PENDING"];
const FAILED_PROVIDER_STATUSES = new Set([
  "FAILED",
  "EXPIRED",
  "CANCELED",
  "CANCELLED",
]);
const SUCCESSFUL_PROVIDER_STATUS = "SUCCESSFUL";

function buildCallbackUrl(baseUrl, attemptId) {
  const url = new URL(baseUrl);
  url.searchParams.set("attempt", attemptId);
  return url.toString();
}

function providerValue(value) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;
}

function normalizedProviderStatus(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  return normalized || undefined;
}

function responseProviderStatus(response, fields = ["status", "state"]) {
  for (const field of fields) {
    const status = normalizedProviderStatus(response?.[field]);
    if (status) return status;
  }
  return undefined;
}

function isFailedProviderStatus(status) {
  return FAILED_PROVIDER_STATUSES.has(status);
}

function terminalProviderOutcome(status) {
  if (status === SUCCESSFUL_PROVIDER_STATUS) return "successful";
  if (isFailedProviderStatus(status)) return "failed";
  return undefined;
}

function providerAmount(purchase) {
  const amount = Number(purchase?.amount);
  return Number.isSafeInteger(amount) ? amount : undefined;
}

function paymentResult(status, orderId) {
  return { orderId, status };
}

export async function reconcileStaleJibitPayments(
  prisma,
  client,
  { limit = 10, logger, now = new Date(), reconcileMinutes = 20 } = {},
) {
  if (!client) return { checked: 0, errors: 0 };

  const attempts = await prisma.paymentAttempt.findMany({
    where: {
      provider: "JIBIT",
      status: { in: ACTIVE_ATTEMPT_STATUSES },
      reconcileAfter: { lt: now },
    },
    orderBy: { reconcileAfter: "asc" },
    take: limit,
  });
  let errors = 0;

  for (const attempt of attempts) {
    if (!attempt.providerPurchaseId) {
      await failPendingJibitOrder(
        prisma,
        attempt.id,
        "JIBIT_PURCHASE_ID_MISSING",
      );
      continue;
    }
    try {
      await verifyJibitPayment(prisma, client, attempt, { reconcileMinutes });
    } catch (error) {
      errors += 1;
      logger?.warn?.(
        { attemptId: attempt.id, errorCode: error?.code },
        "Jibit payment reconciliation failed",
      );
      await prisma.paymentAttempt.updateMany({
        where: { id: attempt.id, status: { in: ACTIVE_ATTEMPT_STATUSES } },
        data: {
          reconcileAfter: new Date(now.getTime() + reconcileMinutes * 60_000),
          lastErrorCode:
            typeof error?.code === "string" ? error.code : "JIBIT_RECONCILE_FAILED",
        },
      });
    }
  }

  return { checked: attempts.length, errors };
}

export async function initiateJibitPayment(
  prisma,
  userId,
  input,
  { callbackBaseUrl, client, logger, reconcileMinutes = 20 },
) {
  if (!client || !callbackBaseUrl) {
    throw serviceUnavailable(
      "JIBIT_NOT_CONFIGURED",
      "Jibit direct payment is not configured",
    );
  }

  await reconcileStaleJibitPayments(prisma, client, {
    logger,
    reconcileMinutes,
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw notFound("USER_NOT_FOUND", "User was not found");
  }

  const attemptId = randomUUID();
  const clientReferenceNumber = `WKA-${attemptId}`;
  const reconcileAfter = new Date(Date.now() + reconcileMinutes * 60_000);
  const pending = await createPendingJibitOrder(prisma, userId, input, {
    attemptId,
    clientReferenceNumber,
    reconcileAfter,
  });

  try {
    const purchase = await client.createPurchase({
      amount: pending.attempt.providerAmountRial,
      callbackUrl: buildCallbackUrl(callbackBaseUrl, attemptId),
      clientReferenceNumber,
      currency: "IRR",
      description: `WikiAcc order ${pending.order.id}`,
      userIdentifier: user.phone ?? user.id,
    });

    await prisma.paymentAttempt.update({
      where: { id: attemptId },
      data: {
        providerPurchaseId: purchase.purchaseId,
        redirectUrl: purchase.redirectUrl,
        status: "PENDING",
      },
    });

    return {
      order: pending.order,
      payment: {
        attemptId,
        reconcileAfter: reconcileAfter.toISOString(),
        provider: "JIBIT",
        redirectUrl: purchase.redirectUrl,
      },
    };
  } catch (error) {
    await failPendingJibitOrder(
      prisma,
      attemptId,
      typeof error?.code === "string" ? error.code : "JIBIT_INIT_FAILED",
    );
    throw error;
  }
}

async function markReviewRequired(prisma, attempt, providerStatus, code) {
  await prisma.paymentAttempt.updateMany({
    where: { id: attempt.id, status: { in: ACTIVE_ATTEMPT_STATUSES } },
    data: {
      status: "REVIEW_REQUIRED",
      providerStatus,
      lastErrorCode: code,
    },
  });
  return paymentResult("review", attempt.orderId);
}

async function markFailed(prisma, attempt, providerStatus) {
  await prisma.$transaction(async (tx) => {
    const current = await tx.paymentAttempt.findUnique({
      where: { id: attempt.id },
      include: { order: { include: { items: true } } },
    });
    if (!current || current.status === "SUCCESSFUL") {
      return;
    }
    for (const item of current.order.items) {
      await releaseDeliveryItems(tx, item.id);
    }
    await tx.order.updateMany({
      where: { id: current.orderId, paymentStatus: "UNPAID" },
      data: { status: "CANCELLED" },
    });
    await tx.paymentAttempt.update({
      where: { id: current.id },
      data: {
        status: "FAILED",
        providerStatus,
        failedAt: new Date(),
        lastErrorCode: "JIBIT_PAYMENT_FAILED",
      },
    });
  });
  return paymentResult("failed", attempt.orderId);
}

async function markSuccessful(prisma, attempt, purchase) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.paymentAttempt.findUnique({
      where: { id: attempt.id },
      include: {
        order: {
          include: {
            items: {
              include: {
                fieldValues: true,
                product: { include: { fields: true } },
              },
            },
          },
        },
      },
    });
    if (!current) {
      throw notFound("PAYMENT_ATTEMPT_NOT_FOUND", "Payment attempt was not found");
    }
    if (current.status === "SUCCESSFUL") {
      return paymentResult("successful", current.orderId);
    }
    if (current.order.paymentStatus !== "UNPAID") {
      throw conflict("ORDER_PAYMENT_CONFLICT", "Order payment state is inconsistent");
    }

    let orderStatus = "AWAITING_ADMIN";
    for (const item of current.order.items) {
      if (item.productTypeSnapshot === "INSTANT_DELIVERY") {
        await fulfillReservedDeliveryItems(tx, item.id, item.quantity);
        orderStatus = "DELIVERED";
      } else {
        const suppliedKeys = new Set(item.fieldValues.map((field) => field.keySnapshot));
        const hasMissingField = item.product.fields.some(
          (field) => field.required && !suppliedKeys.has(field.key),
        );
        orderStatus = hasMissingField ? "PENDING_INFO" : "AWAITING_ADMIN";
      }
    }

    await tx.order.update({
      where: { id: current.orderId },
      data: { paymentStatus: "PAID", status: orderStatus },
    });
    await tx.paymentAttempt.update({
      where: { id: current.id },
      data: {
        status: "SUCCESSFUL",
        providerStatus: "SUCCESSFUL",
        pspReferenceNumber: providerValue(
          purchase.pspReferenceNumber ?? purchase.pspReferenceNo,
        ),
        pspMaskedCardNumber: providerValue(purchase.pspMaskedCardNumber),
        verifiedAt: new Date(),
        failedAt: null,
        lastErrorCode: null,
      },
    });
    return paymentResult("successful", current.orderId);
  });
}

export async function verifyJibitPayment(
  prisma,
  client,
  attempt,
  { reconcileMinutes = 20 } = {},
) {
  if (!client) {
    throw serviceUnavailable(
      "JIBIT_NOT_CONFIGURED",
      "Jibit direct payment is not configured",
    );
  }
  if (attempt.status === "SUCCESSFUL") {
    return paymentResult("successful", attempt.orderId);
  }
  if (["FAILED", "EXPIRED"].includes(attempt.status)) {
    return paymentResult("failed", attempt.orderId);
  }
  if (!attempt.providerPurchaseId) {
    return markReviewRequired(
      prisma,
      attempt,
      attempt.providerStatus,
      "JIBIT_PURCHASE_ID_MISSING",
    );
  }

  let verification;
  let verificationError;
  try {
    verification = await client.verifyPurchase(attempt.providerPurchaseId);
  } catch (error) {
    verificationError = error;
  }
  const purchase = await client.getPurchase(attempt.providerPurchaseId);
  const verificationStatus = responseProviderStatus(verification);
  const inquiryStatus = responseProviderStatus(purchase, ["state", "status"]);
  if (
    verificationError &&
    inquiryStatus !== SUCCESSFUL_PROVIDER_STATUS &&
    !isFailedProviderStatus(inquiryStatus)
  ) {
    throw verificationError;
  }

  const verificationOutcome = terminalProviderOutcome(verificationStatus);
  const inquiryOutcome = terminalProviderOutcome(inquiryStatus);
  if (
    verificationOutcome &&
    inquiryOutcome &&
    verificationOutcome !== inquiryOutcome
  ) {
    return markReviewRequired(
      prisma,
      attempt,
      `${verificationStatus}/${inquiryStatus}`,
      "JIBIT_PAYMENT_STATE_CONFLICT",
    );
  }

  let providerStatus = verificationStatus ?? inquiryStatus ?? "UNKNOWN";
  if (inquiryOutcome === "failed") {
    providerStatus = inquiryStatus;
  } else if (verificationOutcome) {
    providerStatus = verificationStatus;
  } else if (inquiryOutcome === "successful") {
    providerStatus = inquiryStatus;
  }

  if (isFailedProviderStatus(providerStatus)) {
    return markFailed(prisma, attempt, providerStatus);
  }
  if (providerStatus !== SUCCESSFUL_PROVIDER_STATUS) {
    await prisma.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { in: ACTIVE_ATTEMPT_STATUSES } },
      data: {
        providerStatus,
        reconcileAfter: new Date(Date.now() + reconcileMinutes * 60_000),
      },
    });
    return paymentResult("pending", attempt.orderId);
  }

  const purchaseId = providerValue(purchase.purchaseIdStr ?? purchase.purchaseId);
  const referenceNumber = providerValue(purchase.clientReferenceNumber);
  const amount = providerAmount(purchase);
  if (
    purchaseId !== attempt.providerPurchaseId ||
    referenceNumber !== attempt.clientReferenceNumber ||
    amount !== attempt.providerAmountRial
  ) {
    return markReviewRequired(
      prisma,
      attempt,
      providerStatus,
      "JIBIT_PAYMENT_MISMATCH",
    );
  }

  return markSuccessful(prisma, attempt, purchase);
}

export async function processJibitCallback(
  prisma,
  client,
  { attemptId, providerPurchaseId },
  { reconcileMinutes = 20 } = {},
) {
  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: attemptId },
  });
  if (!attempt) {
    throw badRequest("PAYMENT_CALLBACK_INVALID", "Payment callback is invalid");
  }
  if (
    providerPurchaseId &&
    attempt.providerPurchaseId &&
    providerPurchaseId !== attempt.providerPurchaseId
  ) {
    throw badRequest("PAYMENT_CALLBACK_INVALID", "Payment callback is invalid");
  }
  return verifyJibitPayment(prisma, client, attempt, { reconcileMinutes });
}

export async function verifyJibitOrderForUser(
  prisma,
  client,
  userId,
  orderId,
  { reconcileMinutes = 20 } = {},
) {
  const attempt = await prisma.paymentAttempt.findFirst({
    where: { orderId, order: { userId }, provider: "JIBIT" },
    orderBy: { createdAt: "desc" },
  });
  if (!attempt) {
    throw notFound("PAYMENT_ATTEMPT_NOT_FOUND", "Payment attempt was not found");
  }
  return verifyJibitPayment(prisma, client, attempt, { reconcileMinutes });
}
