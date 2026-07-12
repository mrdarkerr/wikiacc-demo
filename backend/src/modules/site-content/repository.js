export const SITE_CONTENT_ID = "main";

export async function ensureSiteContent(prisma, defaultJson) {
  const existing = await prisma.siteContent.findUnique({
    where: { id: SITE_CONTENT_ID },
  });
  if (existing) return existing;

  const now = new Date();

  try {
    return await prisma.siteContent.create({
      data: {
        id: SITE_CONTENT_ID,
        draftJson: defaultJson,
        publishedJson: defaultJson,
        draftVersion: 1,
        publishedVersion: 1,
        draftUpdatedAt: now,
        publishedAt: now,
      },
    });
  } catch (error) {
    if (error?.code !== "P2002") throw error;
    return prisma.siteContent.findUniqueOrThrow({
      where: { id: SITE_CONTENT_ID },
    });
  }
}

export function saveDraftIfVersion(
  prisma,
  { draftJson, expectedVersion, updatedById },
) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const result = await tx.siteContent.updateMany({
      where: {
        id: SITE_CONTENT_ID,
        draftVersion: expectedVersion,
      },
      data: {
        draftJson,
        draftVersion: { increment: 1 },
        draftUpdatedAt: now,
        draftUpdatedById: updatedById,
        updatedAt: now,
      },
    });
    const row = await tx.siteContent.findUnique({
      where: { id: SITE_CONTENT_ID },
    });

    return { row, updated: result.count === 1 };
  });
}

export function publishDraftIfVersion(
  prisma,
  { expectedVersion, publishedById },
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.siteContent.findUnique({
      where: { id: SITE_CONTENT_ID },
    });

    if (!current || current.draftVersion !== expectedVersion) {
      return { row: current, updated: false };
    }

    const now = new Date();
    const result = await tx.siteContent.updateMany({
      where: {
        id: SITE_CONTENT_ID,
        draftVersion: expectedVersion,
        publishedJson: { not: current.draftJson },
      },
      data: {
        publishedJson: current.draftJson,
        publishedVersion: { increment: 1 },
        publishedAt: now,
        publishedById,
        updatedAt: now,
      },
    });
    const row = await tx.siteContent.findUnique({
      where: { id: SITE_CONTENT_ID },
    });

    return {
      row,
      updated: result.count === 1,
      alreadyPublished:
        row?.draftVersion === expectedVersion &&
        row?.draftJson === row?.publishedJson,
    };
  });
}

export function resetDraftIfVersion(prisma, { expectedVersion, updatedById }) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.siteContent.findUnique({
      where: { id: SITE_CONTENT_ID },
    });

    if (!current || current.draftVersion !== expectedVersion) {
      return { row: current, updated: false };
    }

    const now = new Date();
    const result = await tx.siteContent.updateMany({
      where: {
        id: SITE_CONTENT_ID,
        draftVersion: expectedVersion,
      },
      data: {
        draftJson: current.publishedJson,
        draftVersion: { increment: 1 },
        draftUpdatedAt: now,
        draftUpdatedById: updatedById,
        updatedAt: now,
      },
    });
    const row = await tx.siteContent.findUnique({
      where: { id: SITE_CONTENT_ID },
    });

    return { row, updated: result.count === 1 };
  });
}
