import { findProductForOrder } from "../catalog/repository.js";
import { allocateDeliveryItems } from "../delivery/repository.js";
import { badRequest, notFound, paymentRequired } from "../../shared/errors.js";
import { countUserOrders, getUserOrder, listUserOrders } from "./repository.js";

function withoutAdminFields(order) {
  if (!order) return order;

  const publicOrder = { ...order };
  delete publicOrder.adminNote;
  return publicOrder;
}

function normalizeFieldValues(fields, values = {}) {
  const normalized = [];
  const missingRequired = [];

  for (const field of fields) {
    const rawValue = values[field.key];
    const value = typeof rawValue === "string" ? rawValue.trim() : "";

    if (field.required && !value) {
      missingRequired.push(field.key);
    }

    if (value) {
      normalized.push({
        fieldId: field.id,
        keySnapshot: field.key,
        labelSnapshot: field.label,
        value,
      });
    }
  }

  return {
    complete: missingRequired.length === 0,
    missingRequired,
    values: normalized,
  };
}

export async function createOrder(prisma, userId, input) {
  const product = await findProductForOrder(prisma, input.productId);
  if (!product) {
    throw notFound("PRODUCT_NOT_FOUND", "Product was not found or is inactive");
  }

  if (product.type === "INSTANT_DELIVERY" && !product.deliveryPoolId) {
    throw badRequest("DELIVERY_POOL_MISSING", "Product has no delivery pool");
  }

  const quantity = input.quantity ?? 1;
  const totalAmount = product.price * quantity;
  const fieldState = normalizeFieldValues(product.fields, input.fieldValues);

  const orderId = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });

    if (wallet.balance < totalAmount) {
      throw paymentRequired(
        "INSUFFICIENT_WALLET_BALANCE",
        "Wallet balance is not enough for this order",
      );
    }

    const initialStatus =
      product.type === "INSTANT_DELIVERY"
        ? "DELIVERED"
        : fieldState.complete
          ? "AWAITING_ADMIN"
          : "PENDING_INFO";

    const order = await tx.order.create({
      data: {
        userId,
        status: initialStatus,
        paymentStatus: "PAID",
        totalAmount,
        note: input.note,
      },
    });

    const walletTransaction = await tx.walletTransaction.create({
      data: {
        userId,
        amount: -totalAmount,
        type: "ORDER_PAYMENT",
        status: "COMPLETED",
        referenceType: "ORDER",
        referenceId: order.id,
      },
    });

    await tx.wallet.update({
      where: { userId },
      data: { balance: { decrement: totalAmount } },
    });

    await tx.order.update({
      where: { id: order.id },
      data: { walletTransactionId: walletTransaction.id },
    });

    const orderItem = await tx.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        titleSnapshot: product.title,
        priceSnapshot: product.price,
        productTypeSnapshot: product.type,
        quantity,
      },
    });

    if (product.type === "CUSTOM_FORM" && fieldState.values.length) {
      await tx.orderFieldValue.createMany({
        data: fieldState.values.map((value) => ({
          ...value,
          orderItemId: orderItem.id,
        })),
      });
    }

    if (product.type === "INSTANT_DELIVERY") {
      await allocateDeliveryItems(tx, product.deliveryPoolId, orderItem.id, quantity);
    }

    return order.id;
  });

  return withoutAdminFields(await getUserOrder(prisma, userId, orderId));
}

export async function listMyOrders(prisma, userId, pagination) {
  const [orders, total] = await Promise.all([
    listUserOrders(prisma, userId, pagination),
    countUserOrders(prisma, userId),
  ]);

  return { orders: orders.map(withoutAdminFields), total };
}

export async function getMyOrder(prisma, userId, orderId) {
  const order = withoutAdminFields(await getUserOrder(prisma, userId, orderId));
  if (!order) {
    throw notFound("ORDER_NOT_FOUND", "Order was not found");
  }
  return order;
}

export async function submitOrderFieldValues(prisma, userId, orderId, input) {
  const order = await getUserOrder(prisma, userId, orderId);
  if (!order) {
    throw notFound("ORDER_NOT_FOUND", "Order was not found");
  }

  const orderItem = order.items[0];
  if (!orderItem || orderItem.product.type !== "CUSTOM_FORM") {
    throw badRequest("ORDER_DOES_NOT_ACCEPT_FIELDS", "This order does not accept field values");
  }

  const fieldState = normalizeFieldValues(orderItem.product.fields, input.fieldValues);

  return prisma.$transaction(async (tx) => {
    await tx.orderFieldValue.deleteMany({
      where: { orderItemId: orderItem.id },
    });

    if (fieldState.values.length) {
      await tx.orderFieldValue.createMany({
        data: fieldState.values.map((value) => ({
          ...value,
          orderItemId: orderItem.id,
        })),
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: fieldState.complete ? "AWAITING_ADMIN" : "PENDING_INFO",
      },
    });

    return withoutAdminFields(await getUserOrder(tx, userId, orderId));
  });
}
