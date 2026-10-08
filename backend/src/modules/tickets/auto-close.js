// Policy stays independent of the scheduler. Call inside a fenced transaction:
// message creation + status changes and auto-close must commit atomically.
export async function closeUnansweredTicketBatch(tx, { cutoff, closedAt, afterId, batchSize = 100 }) {
  const tickets = await tx.ticket.findMany({
    where: {
      status: { in: ["OPEN", "ANSWERED"] },
      ...(afterId ? { id: { gt: afterId } } : {}),
      messages: { some: { isAdmin: true, createdAt: { lt: cutoff } }, none: { createdAt: { gte: cutoff } } },
    },
    orderBy: { id: "asc" }, take: batchSize,
    select: { id: true, messages: {
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1,
      select: { isAdmin: true, createdAt: true },
    } },
  });
  let closedCount = 0;
  for (const ticket of tickets) {
    const last = ticket.messages[0];
    if (!last?.isAdmin) continue;
    // Recheck the predicate in the write. Equal-timestamp customer messages
    // conservatively keep a ticket open; do not infer ordering from a CUID.
    const result = await tx.ticket.updateMany({
      where: { id: ticket.id, status: { in: ["OPEN", "ANSWERED"] },
        messages: { none: { OR: [
          { createdAt: { gt: last.createdAt } },
          { isAdmin: false, createdAt: { gte: last.createdAt } },
        ] } },
      },
      data: { status: "CLOSED", updatedAt: closedAt },
    });
    closedCount += result.count;
  }
  return { closedCount, afterId: tickets.at(-1)?.id, hasMore: tickets.length === batchSize };
}
