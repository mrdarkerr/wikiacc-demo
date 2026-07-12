-- Add the singleton site-content document without changing existing tables or data.
CREATE TABLE IF NOT EXISTS "SiteContent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftJson" TEXT NOT NULL,
    "publishedJson" TEXT NOT NULL,
    "draftVersion" INTEGER NOT NULL DEFAULT 1,
    "publishedVersion" INTEGER NOT NULL DEFAULT 1,
    "draftUpdatedById" TEXT,
    "publishedById" TEXT,
    "draftUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteContent_draftUpdatedById_fkey"
        FOREIGN KEY ("draftUpdatedById") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SiteContent_publishedById_fkey"
        FOREIGN KEY ("publishedById") REFERENCES "User" ("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SiteContent_draftUpdatedById_idx"
    ON "SiteContent"("draftUpdatedById");

CREATE INDEX IF NOT EXISTS "SiteContent_publishedById_idx"
    ON "SiteContent"("publishedById");
