import { badRequest, notFound } from "../../shared/errors.js";
import { created, ok } from "../../shared/http/reply.js";
import { parse } from "../../shared/validation/parse.js";
import {
  createCategorySchema,
  createProductSchema,
  updateCategorySchema,
  updateProductSchema,
} from "../catalog/schemas.js";
import { validateProductInput } from "../catalog/service.js";
import {
  addDeliveryItemsSchema,
  createDeliveryPoolSchema,
} from "../delivery/schemas.js";
import { addDeliveryItems, createDeliveryPool } from "../delivery/service.js";
import { createTicketMessageSchema, updateTicketStatusSchema } from "../tickets/schemas.js";
import { addTicketMessage } from "../tickets/service.js";
import { walletAdjustmentSchema } from "../wallet/schemas.js";
import {
  adjustWalletByAdmin,
  refundOrderByAdmin,
} from "../wallet/service.js";
import {
  idParamsSchema,
  refundOrderSchema,
  setActiveSchema,
  updateOrderStatusSchema,
  userIdParamsSchema,
} from "./schemas.js";

async function findProductOrThrow(prisma, id) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { _count: { select: { orderItems: true } } },
  });
  if (!product) {
    throw notFound("PRODUCT_NOT_FOUND", "Product was not found");
  }
  return product;
}

const adminOrderInclude = {
  user: { select: { id: true, email: true, name: true, phone: true } },
  items: {
    include: {
      product: true,
      deliveries: true,
      fieldValues: { orderBy: { createdAt: "asc" } },
    },
  },
};

const adminTicketInclude = {
  user: { select: { id: true, email: true, name: true } },
  order: { select: { id: true, status: true, totalAmount: true } },
  messages: {
    include: { sender: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  },
};

export async function adminRoutes(app) {
  app.addHook("preHandler", app.requireAdmin);

  app.get("/users", async (request, reply) => {
    const users = await app.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        role: true,
        createdAt: true,
        wallet: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(reply, { users });
  });

  app.get("/orders", async (request, reply) => {
    const orders = await app.prisma.order.findMany({
      include: adminOrderInclude,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok(reply, { orders });
  });

  app.get("/orders/:id", async (request, reply) => {
    const params = parse(idParamsSchema, request.params);
    const order = await app.prisma.order.findUnique({
      where: { id: params.id },
      include: adminOrderInclude,
    });
    if (!order) {
      throw notFound("ORDER_NOT_FOUND", "Order was not found");
    }
    return ok(reply, { order });
  });

  app.patch("/orders/:id/status", async (request, reply) => {
    const params = parse(idParamsSchema, request.params);
    const input = parse(updateOrderStatusSchema, request.body);
    const order = await app.prisma.order.update({
      where: { id: params.id },
      data: {
        status: input.status,
        ...(input.adminNote === undefined ? {} : { adminNote: input.adminNote }),
        ...(input.note === undefined ? {} : { note: input.note }),
      },
      include: adminOrderInclude,
    });
    return ok(reply, { order });
  });

  app.post("/orders/:id/refund", async (request, reply) => {
    const params = parse(idParamsSchema, request.params);
    const input = parse(refundOrderSchema, request.body);
    const result = await refundOrderByAdmin(
      app.prisma,
      request.user.id,
      params.id,
      input.note,
    );
    if (!result) {
      throw badRequest("ORDER_NOT_REFUNDABLE", "Order is not refundable");
    }
    return ok(reply, result);
  });

  app.post("/categories", async (request, reply) => {
    const input = parse(createCategorySchema, request.body);
    const category = await app.prisma.productCategory.create({ data: input });
    return created(reply, { category });
  });

  app.patch("/categories/:id", async (request, reply) => {
    const params = parse(idParamsSchema, request.params);
    const input = parse(updateCategorySchema, request.body);
    const category = await app.prisma.productCategory.update({
      where: { id: params.id },
      data: input,
    });
    return ok(reply, { category });
  });

  app.get("/categories", async (request, reply) => {
    const categories = await app.prisma.productCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
    return ok(reply, { categories });
  });

  app.get("/products", async (request, reply) => {
    const products = await app.prisma.product.findMany({
      include: {
        category: true,
        deliveryPool: true,
        fields: { orderBy: { sortOrder: "asc" } },
        _count: { select: { orderItems: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return ok(reply, { products });
  });

  app.post("/products", async (request, reply) => {
    const input = parse(createProductSchema, request.body);
    validateProductInput(input);

    const product = await app.prisma.product.create({
      data: {
        slug: input.slug,
        title: input.title,
        description: input.description,
        type: input.type,
        price: input.price,
        categoryId: input.categoryId,
        deliveryPoolId: input.deliveryPoolId,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
        fields:
          input.type === "CUSTOM_FORM" && input.fields.length
            ? { create: input.fields }
            : undefined,
      },
      include: { fields: true, category: true, deliveryPool: true },
    });

    return created(reply, { product });
  });

  app.patch("/products/:id", async (request, reply) => {
    const params = parse(idParamsSchema, request.params);
    const input = parse(updateProductSchema, request.body);
    const current = await findProductOrThrow(app.prisma, params.id);

    if (input.type && input.type !== current.type && current._count.orderItems > 0) {
      throw badRequest(
        "PRODUCT_TYPE_LOCKED",
        "Product type cannot change after orders exist",
      );
    }

    const merged = {
      type: input.type ?? current.type,
      deliveryPoolId:
        input.deliveryPoolId === undefined
          ? current.deliveryPoolId
          : input.deliveryPoolId,
      fields: input.fields ?? [],
    };
    validateProductInput(merged);

    const product = await app.prisma.$transaction(async (tx) => {
      if (input.fields) {
        await tx.productField.deleteMany({ where: { productId: params.id } });
      }

      return tx.product.update({
        where: { id: params.id },
        data: {
          slug: input.slug,
          title: input.title,
          description: input.description,
          type: input.type,
          price: input.price,
          categoryId: input.categoryId,
          deliveryPoolId: input.deliveryPoolId,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
          fields:
            input.fields && input.fields.length
              ? { create: input.fields }
              : undefined,
        },
        include: { fields: true, category: true, deliveryPool: true },
      });
    });

    return ok(reply, { product });
  });

  app.patch("/products/:id/active", async (request, reply) => {
    const params = parse(idParamsSchema, request.params);
    const input = parse(setActiveSchema, request.body);
    const product = await app.prisma.product.update({
      where: { id: params.id },
      data: { isActive: input.isActive },
    });
    return ok(reply, { product });
  });

  app.get("/delivery-pools", async (request, reply) => {
    const pools = await app.prisma.deliveryPool.findMany({
      include: {
        _count: {
          select: {
            items: true,
            products: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(reply, { pools });
  });

  app.post("/delivery-pools", async (request, reply) => {
    const input = parse(createDeliveryPoolSchema, request.body);
    const pool = await createDeliveryPool(app.prisma, input);
    return created(reply, { pool });
  });

  app.get("/delivery-pools/:id/items", async (request, reply) => {
    const params = parse(idParamsSchema, request.params);
    const items = await app.prisma.deliveryItem.findMany({
      where: { poolId: params.id },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 500,
    });
    return ok(reply, { items });
  });

  app.post("/delivery-pools/:id/items", async (request, reply) => {
    const params = parse(idParamsSchema, request.params);
    const input = parse(addDeliveryItemsSchema, request.body);
    const pool = await addDeliveryItems(app.prisma, params.id, input);
    return created(reply, { pool });
  });

  app.post("/wallet/users/:userId/credit", async (request, reply) => {
    const params = parse(userIdParamsSchema, request.params);
    const input = parse(walletAdjustmentSchema, request.body);
    const result = await adjustWalletByAdmin(
      app.prisma,
      request.user.id,
      params.userId,
      "ADMIN_CREDIT",
      input,
    );
    return created(reply, result);
  });

  app.post("/wallet/users/:userId/debit", async (request, reply) => {
    const params = parse(userIdParamsSchema, request.params);
    const input = parse(walletAdjustmentSchema, request.body);
    const result = await adjustWalletByAdmin(
      app.prisma,
      request.user.id,
      params.userId,
      "ADMIN_DEBIT",
      input,
    );
    return created(reply, result);
  });

  app.get("/wallet/summary", async (request, reply) => {
    const [users, recentTransactionCount, transactionCount] = await Promise.all([
      app.prisma.user.findMany({
        select: {
          id: true,
          wallet: { select: { balance: true } },
        },
      }),
      app.prisma.walletTransaction.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      app.prisma.walletTransaction.count(),
    ]);

    const balances = users.map((user) => user.wallet?.balance ?? 0);
    const totalBalance = balances.reduce((sum, balance) => sum + balance, 0);
    const totalUsers = users.length;

    return ok(reply, {
      summary: {
        averageBalance: totalUsers ? Math.round(totalBalance / totalUsers) : 0,
        maxBalance: balances.length ? Math.max(...balances) : 0,
        recentTransactionCount,
        totalBalance,
        totalUsers,
        transactionCount,
        usersWithBalance: balances.filter((balance) => balance > 0).length,
      },
    });
  });

  app.get("/wallet/transactions", async (request, reply) => {
    const transactions = await app.prisma.walletTransaction.findMany({
      include: {
        createdByAdmin: {
          select: { id: true, email: true, name: true, role: true },
        },
        user: {
          select: { id: true, email: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return ok(reply, { transactions });
  });

  app.get("/tickets", async (request, reply) => {
    const tickets = await app.prisma.ticket.findMany({
      include: adminTicketInclude,
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return ok(reply, { tickets });
  });

  app.get("/tickets/:id", async (request, reply) => {
    const params = parse(idParamsSchema, request.params);
    const ticket = await app.prisma.ticket.findUnique({
      where: { id: params.id },
      include: adminTicketInclude,
    });
    if (!ticket) {
      throw notFound("TICKET_NOT_FOUND", "Ticket was not found");
    }
    return ok(reply, { ticket });
  });

  app.post("/tickets/:id/messages", async (request, reply) => {
    const params = parse(idParamsSchema, request.params);
    const input = parse(createTicketMessageSchema, request.body);
    const ticket = await addTicketMessage(
      app.prisma,
      request.user.id,
      params.id,
      input,
      true,
    );
    return created(reply, { ticket });
  });

  app.patch("/tickets/:id/status", async (request, reply) => {
    const params = parse(idParamsSchema, request.params);
    const input = parse(updateTicketStatusSchema, request.body);
    const ticket = await app.prisma.ticket.update({
      where: { id: params.id },
      data: { status: input.status },
      include: adminTicketInclude,
    });
    return ok(reply, { ticket });
  });
}
