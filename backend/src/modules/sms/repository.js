import { conflict, notFound } from "../../shared/errors.js";
import {
  DEFAULT_AUTH_PATTERN_CODE,
  DEFAULT_SMS_SENDERS,
  IRANPAYAMAK_PROVIDER,
  SMS_SETTINGS_ID,
} from "./constants.js";

const settingsInclude = {
  senders: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
};

export async function ensureSmsSettings(prisma) {
  return prisma.$transaction(async (tx) => {
    await tx.smsProviderSettings.upsert({
      where: { id: SMS_SETTINGS_ID },
      update: {},
      create: {
        authPatternCode: DEFAULT_AUTH_PATTERN_CODE,
        id: SMS_SETTINGS_ID,
        provider: IRANPAYAMAK_PROVIDER,
        senders: {
          create: DEFAULT_SMS_SENDERS,
        },
      },
    });

    let settings = await tx.smsProviderSettings.findUniqueOrThrow({
      where: { id: SMS_SETTINGS_ID },
      include: settingsInclude,
    });

    const defaultSenderIsUsable = settings.senders.some(
      (sender) => sender.id === settings.defaultSenderId && sender.isActive,
    );

    if (!defaultSenderIsUsable) {
      const fallbackSender = settings.senders.find((sender) => sender.isActive);
      settings = await tx.smsProviderSettings.update({
        where: { id: SMS_SETTINGS_ID },
        data: { defaultSenderId: fallbackSender?.id ?? null },
        include: settingsInclude,
      });
    }

    return settings;
  });
}

export async function updateStoredSmsSettings(prisma, data) {
  await ensureSmsSettings(prisma);

  return prisma.$transaction(async (tx) => {
    if (data.defaultSenderId !== undefined) {
      const sender = await tx.smsSenderLine.findFirst({
        where: {
          id: data.defaultSenderId,
          isActive: true,
          settingsId: SMS_SETTINGS_ID,
        },
      });
      if (!sender) {
        throw notFound("SMS_SENDER_NOT_FOUND", "SMS sender line was not found");
      }
    }

    return tx.smsProviderSettings.update({
      where: { id: SMS_SETTINGS_ID },
      data,
      include: settingsInclude,
    });
  });
}

export async function createStoredSmsSender(prisma, input) {
  await ensureSmsSettings(prisma);

  try {
    return await prisma.smsSenderLine.create({
      data: {
        ...input,
        settingsId: SMS_SETTINGS_ID,
        sortOrder: await prisma.smsSenderLine.count({
          where: { settingsId: SMS_SETTINGS_ID },
        }),
      },
    });
  } catch (error) {
    if (error?.code === "P2002") {
      throw conflict(
        "SMS_SENDER_ALREADY_EXISTS",
        "This SMS sender line already exists",
      );
    }
    throw error;
  }
}

export async function deleteStoredSmsSender(prisma, senderId) {
  const settings = await ensureSmsSettings(prisma);
  const sender = settings.senders.find((item) => item.id === senderId);

  if (!sender) {
    throw notFound("SMS_SENDER_NOT_FOUND", "SMS sender line was not found");
  }
  if (settings.defaultSenderId === senderId) {
    throw conflict(
      "SMS_DEFAULT_SENDER_REQUIRED",
      "Select another default SMS sender before deleting this line",
    );
  }

  await prisma.smsSenderLine.delete({ where: { id: senderId } });
  return sender;
}
