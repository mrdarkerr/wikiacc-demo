import { publicUserSelect } from "./schemas.js";

export function findUserByEmail(prisma, email) {
  return prisma.user.findUnique({ where: { email } });
}

export function findPublicUserById(prisma, id) {
  return prisma.user.findUnique({
    where: { id },
    select: publicUserSelect,
  });
}

export function createUser(prisma, data) {
  return prisma.user.create({
    data: {
      email: data.email,
      phone: data.phone,
      name: data.name,
      passwordHash: data.passwordHash,
      wallet: { create: { balance: 0 } },
    },
    select: publicUserSelect,
  });
}
