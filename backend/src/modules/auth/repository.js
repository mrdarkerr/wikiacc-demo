import { authUserSelect } from "./schemas.js";

export function findUserByEmail(prisma, email) {
  return prisma.user.findUnique({ where: { email } });
}

export function findUserByPhone(prisma, phone) {
  return prisma.user.findUnique({ where: { phone } });
}

export function findUserByIdentifier(prisma, identifier) {
  return prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { phone: identifier }] },
  });
}

export function findAuthUserById(prisma, id) {
  return prisma.user.findUnique({
    where: { id },
    select: authUserSelect,
  });
}

export async function reserveOtpChallenge(prisma, data, limits) {
  return prisma.$transaction(async (tx) => {
    await tx.authOtpChallenge.deleteMany({
      where: {
        createdAt: { lt: new Date(data.now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    const active = await tx.authOtpChallenge.findFirst({
      where: {
        consumedAt: null,
        expiresAt: { gt: data.now },
        invalidatedAt: null,
        phone: data.phone,
      },
      orderBy: { createdAt: "desc" },
    });

    if (active) {
      return {
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((active.expiresAt.getTime() - data.now.getTime()) / 1000),
        ),
        status: "active",
      };
    }

    const hourAgo = new Date(data.now.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(data.now.getTime() - 24 * 60 * 60 * 1000);
    const [phoneHourlyCount, phoneDailyCount, ipHourlyCount] = await Promise.all([
      tx.authOtpChallenge.count({
        where: { phone: data.phone, sentAt: { gte: hourAgo } },
      }),
      tx.authOtpChallenge.count({
        where: { phone: data.phone, sentAt: { gte: dayAgo } },
      }),
      tx.authOtpChallenge.count({
        where: { requestIpHash: data.requestIpHash, sentAt: { gte: hourAgo } },
      }),
    ]);

    if (phoneHourlyCount >= limits.phoneHourly) {
      return { retryAfterSeconds: 3600, status: "phone_hourly_limit" };
    }
    if (phoneDailyCount >= limits.phoneDaily) {
      return { retryAfterSeconds: 86400, status: "phone_daily_limit" };
    }
    if (ipHourlyCount >= limits.ipHourly) {
      return { retryAfterSeconds: 3600, status: "ip_hourly_limit" };
    }

    const challenge = await tx.authOtpChallenge.create({
      data: {
        codeHash: data.codeHash,
        expiresAt: data.expiresAt,
        id: data.id,
        phone: data.phone,
        purpose: data.purpose,
        registrationEmail: data.registrationEmail ?? null,
        registrationName: data.registrationName ?? null,
        requestIpHash: data.requestIpHash,
      },
    });
    return { challenge, status: "created" };
  });
}

export function markOtpChallengeSent(prisma, id, sentAt, expiresAt) {
  return prisma.authOtpChallenge.update({
    where: { id },
    data: { expiresAt, sentAt },
  });
}

export function removeOtpChallenge(prisma, id) {
  return prisma.authOtpChallenge.deleteMany({ where: { id, sentAt: null } });
}
