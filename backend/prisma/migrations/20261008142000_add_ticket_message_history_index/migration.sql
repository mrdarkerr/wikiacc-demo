-- Additive only: never rebuild/reset existing ticket or message tables.
CREATE INDEX IF NOT EXISTS "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");
