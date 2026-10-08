import { afterAll, beforeEach, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createTestDatabase } from "./helpers/database.js";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "ticket-auto-close-test-secret";
const db = createTestDatabase("ticket-auto-close");
const start = new Date("2026-10-08T08:00:00Z");
let clock = start;
let app;
const user = await db.prisma.user.create({ data: { name: "Ticket customer" } });
const admin = await db.prisma.user.create({ data: { name: "Ticket admin", role: "ADMIN" } });
afterAll(async () => { await app?.close(); await db.close(); });
beforeEach(async () => {
  await app?.close();
  app = null;
  clock = start;
  await db.prisma.ticket.deleteMany();
  await db.prisma.scheduledJob.deleteMany();
});
async function ticket(status, messages) {
  return db.prisma.ticket.create({ data: {
    userId: user.id, subject: "Auto-close test", status,
    messages: { create: messages.map(([isAdmin, ageMs]) => ({
      senderId: isAdmin ? admin.id : user.id, isAdmin, body: "Test message",
      createdAt: new Date(start.getTime() - ageMs),
    })) },
  } });
}
async function build() {
  const { buildApp } = await import("../src/app.js");
  app = await buildApp({ prisma: db.prisma, logger: false,
    wallexClient: { fetchRate: async () => ({ rateToman: 270000, source: "WALLEX", symbol: "USDTTMN" }) },
    enableJibitReconciliation: false, schedulerOptions: { now: () => clock },
  });
}
const twoDays = 48 * 60 * 60 * 1000;
it("keeps customer-last, recent, exactly-48-hour, empty and already-closed tickets unchanged", async () => {
  const cases = [
    ["OPEN", [[true, twoDays + 10000], [false, twoDays + 1]]],
    ["OPEN", [[false, twoDays + 1]]],
    ["ANSWERED", [[true, twoDays - 1]]],
    ["ANSWERED", [[true, twoDays]]],
    ["ANSWERED", [[true, twoDays + 10000], [true, 1000]]],
    ["OPEN", []],
    ["OPEN", [[false, twoDays + 1], [true, twoDays + 1]]],
    ["CLOSED", [[true, twoDays + 1]]],
  ];
  const originals = [];
  for (const [status, messages] of cases) originals.push(await ticket(status, messages));
  await build();
  await app.scheduler.runDue();
  for (const original of originals) {
    expect(await db.prisma.ticket.findUnique({ where: { id: original.id } })).toMatchObject({
      status: original.status, updatedAt: original.updatedAt,
    });
  }
});
it("uses the latest admin reply rather than ticket age or status-update time", async () => {
  const stale = await ticket("OPEN", [[false, twoDays + 10000], [true, twoDays + 1]]);
  await build();
  await app.scheduler.runDue();
  expect(await db.prisma.ticket.findUnique({ where: { id: stale.id } })).toMatchObject({ status: "CLOSED", updatedAt: start });
  expect(await db.prisma.ticketMessage.count()).toBe(2);
  expect(await db.prisma.smsQueueJob.count()).toBe(0);
  expect(await db.prisma.telegramQueueJob.count()).toBe(0);
  await app.scheduler.runDue();
  expect((await db.prisma.scheduledJob.findUnique({ where: { name: "ticket-auto-close" } })).runCount).toBe(1);
  clock = new Date(start.getTime() + 300000);
  await app.scheduler.runDue();
  expect((await db.prisma.ticket.findUnique({ where: { id: stale.id } })).updatedAt).toEqual(start);
});
it("closes tickets after the next interval but preserves a customer reply sent before that cycle", async () => {
  const due = await ticket("ANSWERED", [[true, twoDays - 1]]);
  const replied = await ticket("ANSWERED", [[true, twoDays - 1]]);
  await build();
  await app.scheduler.runDue();
  await db.prisma.ticketMessage.create({ data: { ticketId: replied.id, senderId: user.id, isAdmin: false, body: "New reply", createdAt: start } });
  // Even an inconsistent ANSWERED status must not override the message history.
  clock = new Date(start.getTime() + 300000);
  await app.scheduler.runDue();
  expect((await db.prisma.ticket.findUnique({ where: { id: due.id } })).status).toBe("CLOSED");
  expect((await db.prisma.ticket.findUnique({ where: { id: replied.id } })).status).toBe("ANSWERED");
});
it("processes more than one bounded batch without skipping matching tickets", async () => {
  const tickets = [];
  for (let i = 0; i < 105; i++) tickets.push(await ticket("ANSWERED", [[true, twoDays + 1]]));
  await build();
  await app.scheduler.runDue();
  expect(await db.prisma.ticket.count({ where: { status: "CLOSED" } })).toBe(tickets.length);
  expect((await db.prisma.scheduledJob.findUnique({ where: { name: "ticket-auto-close" } })).lastErrorCode).toBe(null);
});
it("supports job-specific disablement and configurable timing independently of other jobs", async () => {
  const { createScheduler } = await import("../src/modules/jobs/scheduler.js");
  const { registerTicketAutoCloseJob } = await import("../src/modules/jobs/ticket-auto-close.js");
  const stale = await ticket("ANSWERED", [[true, 2 * 60 * 60 * 1000]]);
  const disabled = createScheduler(db.prisma, { now: () => clock });
  registerTicketAutoCloseJob(disabled, { enabled: false });
  await disabled.runDue();
  expect(await db.prisma.scheduledJob.count()).toBe(0);
  expect((await db.prisma.ticket.findUnique({ where: { id: stale.id } })).status).toBe("ANSWERED");
  await disabled.stop();
  const enabled = createScheduler(db.prisma, { now: () => clock });
  try {
    registerTicketAutoCloseJob(enabled, { inactivityHours: 1, intervalSeconds: 60 });
    await enabled.runDue();
    expect((await db.prisma.ticket.findUnique({ where: { id: stale.id } })).status).toBe("CLOSED");
    expect((await db.prisma.scheduledJob.findUnique({ where: { name: "ticket-auto-close" } })).nextRunAt).toEqual(new Date(start.getTime() + 60000));
  } finally { await enabled.stop(); }
});
it("indexes message history by ticket and timestamp for bounded job queries", async () => {
  const parts = await db.prisma.$queryRawUnsafe('PRAGMA index_info("TicketMessage_ticketId_createdAt_idx")');
  expect(parts.map((p) => p.name)).toEqual(["ticketId", "createdAt"]);
});
it("adds the production history index idempotently without changing existing tickets or messages", async () => {
  const original = await ticket("ANSWERED", [[false, twoDays + 10000], [true, twoDays + 1]]);
  const messages = await db.prisma.ticketMessage.findMany();
  await db.prisma.$executeRawUnsafe('DROP INDEX "TicketMessage_ticketId_createdAt_idx"');
  const sql = readFileSync(new URL("../prisma/migrations/20261008142000_add_ticket_message_history_index/migration.sql", import.meta.url), "utf8");
  await db.prisma.$executeRawUnsafe(sql);
  await db.prisma.$executeRawUnsafe(sql);
  expect(await db.prisma.ticket.findUnique({ where: { id: original.id } })).toEqual(original);
  expect(await db.prisma.ticketMessage.findMany()).toEqual(messages);
  expect(await db.prisma.$queryRawUnsafe('PRAGMA foreign_key_check')).toEqual([]);
  const index = await db.prisma.$queryRawUnsafe('PRAGMA index_info("TicketMessage_ticketId_createdAt_idx")');
  expect(index.map((p) => p.name)).toEqual(["ticketId", "createdAt"]);
});
it("retries rolled-back timeout batches with smaller batches without skipping tickets", async () => {
  const { registerTicketAutoCloseJob } = await import("../src/modules/jobs/ticket-auto-close.js");
  for (let i = 0; i < 5; i++) await ticket("ANSWERED", [[true, twoDays + 1]]);
  let job, retries = 0;
  registerTicketAutoCloseJob({ register(value) { job = value; } });
  await job.handler({ now: () => clock, withLease: (fn) => db.prisma.$transaction(async (tx) => {
    const result = await fn(tx);
    if (result.closedCount > 2) {
      retries++;
      throw Object.assign(new Error("Simulated transaction deadline"), { code: "P2028" });
    }
    return result;
  }) });
  expect(retries).toBeGreaterThan(0);
  expect(await db.prisma.ticket.count({ where: { status: "CLOSED" } })).toBe(5);
});
it("does not swallow infrastructure failures or lost leases", async () => {
  const { registerTicketAutoCloseJob } = await import("../src/modules/jobs/ticket-auto-close.js");
  let job;
  registerTicketAutoCloseJob({ register(value) { job = value; } });
  for (const code of ["JOB_LEASE_LOST", "P1001"]) {
    const error = Object.assign(new Error(code), { code });
    await expect(job.handler({ now: () => clock, withLease: async () => { throw error; } })).rejects.toBe(error);
  }
});
it("closes an unanswered admin ticket through the existing durable scheduler", async () => {
  const stale = await ticket("ANSWERED", [[false, twoDays + 10000], [true, twoDays + 1]]);
  await build();
  expect((await db.prisma.ticket.findUnique({ where: { id: stale.id } })).status).toBe("ANSWERED");
  await app.scheduler.runDue();
  expect((await db.prisma.ticket.findUnique({ where: { id: stale.id } })).status).toBe("CLOSED");
  expect(await db.prisma.scheduledJob.findUnique({ where: { name: "ticket-auto-close" } })).toMatchObject({
    runCount: 1, failureCount: 0, lastErrorCode: null, lastSuccessAt: start,
    nextRunAt: new Date(start.getTime() + 300000),
  });
});
