# Inactive ticket auto-close

## Contract

The `ticket-auto-close` durable job closes `OPEN` and `ANSWERED` tickets only
when their latest message is from an administrator and is **strictly older**
than the inactivity threshold. Default: more than 48 elapsed hours, checked
every 300 seconds. The creation date and ticket `updatedAt` do not start the
countdown. A new admin reply resets it; a customer reply prevents closure.
Already-closed and message-less tickets are untouched. If admin and customer
messages share a timestamp, keep the ticket open conservatively.

Only the status and `updatedAt` change. No messages are deleted or synthesized,
and no SMS/Telegram notifications are sent. Existing API behavior is retained:
a new message can reopen a closed ticket.

## Configuration

Validated in `backend/src/config/env.js`; documented in `backend/.env.example`:

- `JOBS_ENABLED=true`: master scheduler switch (existing).
- `TICKET_AUTO_CLOSE_ENABLED=true`: independently enable/disable this job.
- `TICKET_AUTO_CLOSE_AFTER_HOURS=48`: integer, 1..8760 hours.
- `TICKET_AUTO_CLOSE_INTERVAL_SECONDS=300`: integer, 1..86400 seconds.

Restart the backend after changing environment settings. Defaults enable this
job on deployment; the first scheduler cycle processes existing eligible
tickets as well as future ones. Disabling it does not reopen tickets already
closed. Tests disable automatic background timers by default.

## Maintenance boundaries

- `modules/tickets/auto-close.js`: domain predicate and guarded status writes.
- `modules/jobs/ticket-auto-close.js`: scheduler adapter, fixed per-cycle cutoff,
  bounded 100-ticket transactions, aggregate non-sensitive logging.
- `app.js`: registration only; do not put ticket policy in the generic scheduler.

All reads/writes run inside the scheduler's `withLease` transaction. The lease
write obtains SQLite's writer lock before reading messages, so a competing
message transaction cannot slip between the read and close. The write also
checks for newer messages/customer replies at the same timestamp. Cursoring
uses an ID boundary rather than an offset, avoiding skips as tickets close.
The existing timeout/lease fences apply to every batch. Committed batches
remain committed on failure; rerunning is idempotent. Transaction deadlines reduce the batch size and retry the same
cursor (down to one ticket); other failures still propagate. The composite
`TicketMessage(ticketId, createdAt)` index avoids scanning the entire message
history for each ticket. No new dependency or separate worker is required.

## Verification and rollout

Run `cd backend && npm test`; the ticket-specific suite is
`npm test -- tests/ticket-auto-close.test.js`. Coverage includes elapsed-time
boundaries, last-sender rules, timestamp ties, repeat cycles, customer replies,
multiple batches and job-specific settings. Scheduler lease/timeout behavior
is also covered by the existing scheduler suite.

Before production restart, make and integrity-check an SQLite online backup
and save private config files. Deploy the merged `main` from GitHub. Before
restarting the backend, add the idempotent index with:

```sh
cd backend
npx prisma db execute --schema prisma/schema.prisma --file prisma/migrations/20261008142000_add_ticket_message_history_index/migration.sql
```

This only adds an index; it does not rebuild tables or change customer records.
Do not run `apply-schema.js` on an existing database (it creates a fresh DB).
Verify `PRAGMA index_info('TicketMessage_ticketId_createdAt_idx')` reports
`ticketId, createdAt`. This change is backend-only; no frontend rebuild/restart
is needed. Inspect the exact
`ScheduledJob` row for `ticket-auto-close` after restart (`lastSuccessAt`,
`lastErrorCode`, `nextRunAt`, `runCount`, `failureCount`), check health and
aggregate eligible-ticket counts without exposing customer data.

For rollback, disable `TICKET_AUTO_CLOSE_ENABLED` and restart, or return the
backend source to the previous known-good commit. Do **not** restore an old
database over ongoing orders/payments. Existing closed tickets stay closed;
selective reopening, if required, must be reviewed against subsequent replies
rather than blindly reverting a database snapshot.
