import { defaultSiteContent } from "../../../../shared/default-site-content.js";

import { AppError, conflict } from "../../shared/errors.js";
import {
  ensureSiteContent,
  publishDraftIfVersion,
  resetDraftIfVersion,
  saveDraftIfVersion,
} from "./repository.js";
import { siteContentDocumentSchema } from "./schemas.js";

const defaultContent = siteContentDocumentSchema.parse(defaultSiteContent);
const defaultContentJson = JSON.stringify(defaultContent);

function parseStoredContent(json) {
  try {
    return siteContentDocumentSchema.parse(JSON.parse(json));
  } catch {
    throw new AppError(
      500,
      "SITE_CONTENT_CORRUPT",
      "Stored site content is invalid",
    );
  }
}

function versionConflict(expectedVersion, row) {
  return conflict(
    "SITE_CONTENT_VERSION_CONFLICT",
    "Site content changed since it was loaded",
    {
      currentVersion: row?.draftVersion ?? null,
      expectedVersion,
    },
  );
}

function toAdminResponse(row) {
  const content = parseStoredContent(row.draftJson);
  const published = parseStoredContent(row.publishedJson);

  return {
    content,
    published,
    draftVersion: row.draftVersion,
    publishedVersion: row.publishedVersion,
    hasUnpublishedChanges:
      JSON.stringify(content) !== JSON.stringify(published),
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  };
}

async function getSiteContentRow(prisma) {
  return ensureSiteContent(prisma, defaultContentJson);
}

export async function getPublishedSiteContent(prisma) {
  const row = await getSiteContentRow(prisma);

  return {
    content: parseStoredContent(row.publishedJson),
    version: row.publishedVersion,
    publishedAt: row.publishedAt,
  };
}

export async function getAdminSiteContent(prisma) {
  return toAdminResponse(await getSiteContentRow(prisma));
}

export async function saveSiteContentDraft(prisma, userId, input) {
  await getSiteContentRow(prisma);
  const content = siteContentDocumentSchema.parse(input.content);
  const result = await saveDraftIfVersion(prisma, {
    draftJson: JSON.stringify(content),
    expectedVersion: input.expectedVersion,
    updatedById: userId,
  });

  if (!result.updated) {
    throw versionConflict(input.expectedVersion, result.row);
  }

  return toAdminResponse(result.row);
}

export async function publishSiteContent(prisma, userId, input) {
  await getSiteContentRow(prisma);
  const result = await publishDraftIfVersion(prisma, {
    expectedVersion: input.expectedVersion,
    publishedById: userId,
  });

  if (!result.updated && !result.alreadyPublished) {
    throw versionConflict(input.expectedVersion, result.row);
  }

  return toAdminResponse(result.row);
}

export async function resetSiteContentDraft(prisma, userId, input) {
  await getSiteContentRow(prisma);
  const result = await resetDraftIfVersion(prisma, {
    expectedVersion: input.expectedVersion,
    updatedById: userId,
  });

  if (!result.updated) {
    throw versionConflict(input.expectedVersion, result.row);
  }

  return toAdminResponse(result.row);
}
