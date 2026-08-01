import {
  DEFAULT_ADMIN_TICKET_ACTIVITY_PATTERN_CODE,
  DEFAULT_ORDER_COMPLETED_PATTERN_CODE,
  DEFAULT_ORDER_CREATED_PATTERN_CODE,
  DEFAULT_TICKET_ANSWERED_PATTERN_CODE,
  DEFAULT_TICKET_CREATED_PATTERN_CODE,
  SMS_NOTIFICATION_EVENTS,
  SMS_SETTINGS_ID,
} from "./constants.js";

const DEFAULT_NOTIFICATION_SETTINGS = Object.freeze({
  adminNotificationsEnabled: true,
  adminPhone: null,
  adminTicketActivityPatternCode:
    DEFAULT_ADMIN_TICKET_ACTIVITY_PATTERN_CODE,
  orderCompletedPatternCode: DEFAULT_ORDER_COMPLETED_PATTERN_CODE,
  orderCreatedPatternCode: DEFAULT_ORDER_CREATED_PATTERN_CODE,
  ticketAnsweredPatternCode: DEFAULT_TICKET_ANSWERED_PATTERN_CODE,
  ticketCreatedPatternCode: DEFAULT_TICKET_CREATED_PATTERN_CODE,
  userNotificationsEnabled: true,
});

async function getNotificationSettings(prisma) {
  const settings = await prisma.smsProviderSettings.findUnique({
    where: { id: SMS_SETTINGS_ID },
    select: {
      adminNotificationsEnabled: true,
      adminPhone: true,
      adminTicketActivityPatternCode: true,
      orderCompletedPatternCode: true,
      orderCreatedPatternCode: true,
      ticketAnsweredPatternCode: true,
      ticketCreatedPatternCode: true,
      userNotificationsEnabled: true,
    },
  });

  return settings
    ? { ...DEFAULT_NOTIFICATION_SETTINGS, ...settings }
    : DEFAULT_NOTIFICATION_SETTINGS;
}

function smsJob({
  attributes,
  audience,
  dedupeId,
  eventType,
  patternCode,
  recipient,
  referenceId,
  referenceType,
  sequence = 0,
}) {
  if (!patternCode || !recipient) return null;

  return {
    attributesJson: JSON.stringify(attributes),
    audience,
    dedupeKey: `${eventType}:${audience}:${dedupeId}`,
    eventType,
    patternCode,
    recipient,
    referenceId,
    referenceType,
    sequence,
  };
}

async function enqueueJobs(prisma, jobs) {
  const validJobs = jobs.filter(Boolean);
  for (const job of validJobs) {
    await prisma.smsQueueJob.upsert({
      where: { dedupeKey: job.dedupeKey },
      update: {},
      create: job,
    });
  }
  return validJobs.length;
}

export async function enqueueOrderNotifications(
  prisma,
  { completed, orderId, userPhone },
) {
  const settings = await getNotificationSettings(prisma);
  if (!settings.userNotificationsEnabled || !userPhone) return 0;

  const jobs = [
    smsJob({
      attributes: { order: orderId },
      audience: "USER",
      dedupeId: orderId,
      eventType: SMS_NOTIFICATION_EVENTS.ORDER_CREATED,
      patternCode: settings.orderCreatedPatternCode,
      recipient: userPhone,
      referenceId: orderId,
      referenceType: "ORDER",
    }),
  ];

  if (completed) {
    jobs.push(
      smsJob({
        attributes: { order: orderId },
        audience: "USER",
        dedupeId: orderId,
        eventType: SMS_NOTIFICATION_EVENTS.ORDER_COMPLETED,
        patternCode: settings.orderCompletedPatternCode,
        recipient: userPhone,
        referenceId: orderId,
        referenceType: "ORDER",
        sequence: 1,
      }),
    );
  }

  return enqueueJobs(prisma, jobs);
}

export async function enqueueOrderCompletedNotification(
  prisma,
  { orderId, userPhone },
) {
  const settings = await getNotificationSettings(prisma);
  if (!settings.userNotificationsEnabled || !userPhone) return 0;

  return enqueueJobs(prisma, [
    smsJob({
      attributes: { order: orderId },
      audience: "USER",
      dedupeId: orderId,
      eventType: SMS_NOTIFICATION_EVENTS.ORDER_COMPLETED,
      patternCode: settings.orderCompletedPatternCode,
      recipient: userPhone,
      referenceId: orderId,
      referenceType: "ORDER",
    }),
  ]);
}

export async function enqueueTicketCreatedNotifications(
  prisma,
  { messageId, ticketId, userPhone },
) {
  const settings = await getNotificationSettings(prisma);
  const jobs = [];

  if (settings.userNotificationsEnabled && userPhone) {
    jobs.push(
      smsJob({
        attributes: { ticket: ticketId },
        audience: "USER",
        dedupeId: ticketId,
        eventType: SMS_NOTIFICATION_EVENTS.TICKET_CREATED,
        patternCode: settings.ticketCreatedPatternCode,
        recipient: userPhone,
        referenceId: ticketId,
        referenceType: "TICKET",
      }),
    );
  }

  if (settings.adminNotificationsEnabled && settings.adminPhone) {
    jobs.push(
      smsJob({
        attributes: { ticket: ticketId },
        audience: "ADMIN",
        dedupeId: messageId,
        eventType: SMS_NOTIFICATION_EVENTS.ADMIN_TICKET_ACTIVITY,
        patternCode: settings.adminTicketActivityPatternCode,
        recipient: settings.adminPhone,
        referenceId: ticketId,
        referenceType: "TICKET",
      }),
    );
  }

  return enqueueJobs(prisma, jobs);
}

export async function enqueueTicketMessageNotification(
  prisma,
  { isAdmin, messageId, ticketId, userPhone },
) {
  const settings = await getNotificationSettings(prisma);

  if (isAdmin) {
    if (!settings.userNotificationsEnabled || !userPhone) return 0;
    return enqueueJobs(prisma, [
      smsJob({
        attributes: { ticket: ticketId },
        audience: "USER",
        dedupeId: messageId,
        eventType: SMS_NOTIFICATION_EVENTS.TICKET_ANSWERED,
        patternCode: settings.ticketAnsweredPatternCode,
        recipient: userPhone,
        referenceId: ticketId,
        referenceType: "TICKET",
      }),
    ]);
  }

  if (!settings.adminNotificationsEnabled || !settings.adminPhone) return 0;
  return enqueueJobs(prisma, [
    smsJob({
      attributes: { ticket: ticketId },
      audience: "ADMIN",
      dedupeId: messageId,
      eventType: SMS_NOTIFICATION_EVENTS.ADMIN_TICKET_ACTIVITY,
      patternCode: settings.adminTicketActivityPatternCode,
      recipient: settings.adminPhone,
      referenceId: ticketId,
      referenceType: "TICKET",
    }),
  ]);
}
