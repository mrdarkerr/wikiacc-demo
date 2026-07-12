import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL ?? "admin@wikiacc.local";
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "admin123456";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      name: "WikiAcc Admin",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "ADMIN",
      wallet: { create: { balance: 0 } },
    },
  });

  await prisma.wallet.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, balance: 0 },
  });

  const aiCategory = await prisma.productCategory.upsert({
    where: { slug: "ai-subscriptions" },
    update: {},
    create: {
      slug: "ai-subscriptions",
      title: "AI Subscriptions",
      description: "Accounts and subscriptions for AI services",
      sortOrder: 1,
    },
  });

  const musicCategory = await prisma.productCategory.upsert({
    where: { slug: "music" },
    update: {},
    create: {
      slug: "music",
      title: "Music",
      description: "Music subscription products",
      sortOrder: 2,
    },
  });

  const geminiProduct = await prisma.product.upsert({
    where: { slug: "gemini" },
    update: {
      description: "دستیار گوگل برای متن، تصویر و ایده‌پردازی",
    },
    create: {
      slug: "gemini",
      title: "Gemini",
      description: "دستیار گوگل برای متن، تصویر و ایده‌پردازی",
      type: "CUSTOM_FORM",
      price: 390000,
      categoryId: aiCategory.id,
      sortOrder: 0,
    },
  });

  await prisma.productFeature.deleteMany({ where: { productId: geminiProduct.id } });
  await prisma.productFeature.createMany({
    data: [
      { productId: geminiProduct.id, title: "فعال‌سازی سریع", sortOrder: 0 },
      { productId: geminiProduct.id, title: "مناسب تولید محتوا", sortOrder: 1 },
      { productId: geminiProduct.id, title: "پشتیبانی تمدید", sortOrder: 2 },
    ],
  });

  const licensePool = await prisma.deliveryPool.upsert({
    where: { slug: "chatgpt-ready-licenses" },
    update: {},
    create: {
      slug: "chatgpt-ready-licenses",
      title: "ChatGPT Ready Licenses",
      description: "Ready-to-deliver license texts for ChatGPT",
    },
  });

  const readyProduct = await prisma.product.upsert({
    where: { slug: "chatgpt-ready" },
    update: {
      deliveryPoolId: licensePool.id,
      isActive: true,
    },
    create: {
      slug: "chatgpt-ready",
      title: "ChatGPT Ready Account",
      description: "Instant delivery account/license text",
      type: "INSTANT_DELIVERY",
      price: 690000,
      categoryId: aiCategory.id,
      deliveryPoolId: licensePool.id,
      sortOrder: 1,
    },
  });

  await prisma.productFeature.deleteMany({ where: { productId: readyProduct.id } });
  await prisma.productFeature.createMany({
    data: [
      { productId: readyProduct.id, title: "فعال‌سازی سریع", sortOrder: 0 },
      { productId: readyProduct.id, title: "اکانت آماده تحویل", sortOrder: 1 },
      { productId: readyProduct.id, title: "پشتیبانی پس از خرید", sortOrder: 2 },
    ],
  });

  const existingReadyItems = await prisma.deliveryItem.count({
    where: { poolId: licensePool.id },
  });

  if (existingReadyItems === 0) {
    await prisma.deliveryItem.createMany({
      data: [
        {
          poolId: licensePool.id,
          content: "Sample ChatGPT license #1 - replace before production",
        },
        {
          poolId: licensePool.id,
          content: "Sample ChatGPT license #2 - replace before production",
        },
      ],
    });
  }

  const customProduct = await prisma.product.upsert({
    where: { slug: "spotify-custom" },
    update: { isActive: true },
    create: {
      slug: "spotify-custom",
      title: "Spotify Custom Activation",
      description: "Requires customer account details after purchase",
      type: "CUSTOM_FORM",
      price: 149000,
      categoryId: musicCategory.id,
      sortOrder: 2,
    },
  });

  await prisma.productFeature.deleteMany({ where: { productId: customProduct.id } });
  await prisma.productFeature.createMany({
    data: [
      { productId: customProduct.id, title: "فعال‌سازی روی حساب شما", sortOrder: 0 },
      { productId: customProduct.id, title: "بدون تبلیغ", sortOrder: 1 },
      { productId: customProduct.id, title: "پشتیبانی تمدید", sortOrder: 2 },
    ],
  });

  await prisma.productField.upsert({
    where: {
      productId_key: {
        productId: customProduct.id,
        key: "account_email",
      },
    },
    update: {},
    create: {
      productId: customProduct.id,
      key: "account_email",
      label: "Account email",
      type: "EMAIL",
      required: true,
      sortOrder: 1,
    },
  });

  await prisma.productField.upsert({
    where: {
      productId_key: {
        productId: customProduct.id,
        key: "notes",
      },
    },
    update: {},
    create: {
      productId: customProduct.id,
      key: "notes",
      label: "Activation notes",
      type: "TEXTAREA",
      required: false,
      sortOrder: 2,
    },
  });

  console.log({
    adminEmail,
    adminPassword,
    seededProducts: [geminiProduct.slug, readyProduct.slug, customProduct.slug],
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
