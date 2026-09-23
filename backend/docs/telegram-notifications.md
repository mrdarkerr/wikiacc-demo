# Telegram operational notifications (v1)

## Scope and ownership

`/admin/telegram` configures a **one-way operator notification destination**. The numeric ID can be a positive private admin chat ID or a negative channel/supergroup ID. It does not grant website permissions. The bot has no command handlers, webhook, refund buttons or ticket-reply authority.

Defaults: **OFF**, Telegram API endpoint `https://api.telegram.org`, no token or destination. Settings can be saved while disabled. Turning on requires a token and destination. For private messages the recipient must first start the bot. For a channel, give the bot permission to post. Prefer a private operational channel.

Events:

- Confirmed wallet purchase and server-verified Jibit purchase (not draft orders).
- Instant purchases combine paid + delivered in one message.
- Paid order transitions to awaiting admin, missing information, ready or cancelled; later delivery by admin or ShareBox.
- New ticket and customer reply; no notification for the admin's own reply.
- Jibit initiation/verification/reconciliation technical failure and manual-review states.
- ShareBox fulfillment that stops for operator review.

Every relevant message links to the authenticated order/ticket page. `WEB_APP_URL` must be the publicly reachable storefront URL in production. Financial behavior, SMS behavior and ShareBox issuance semantics remain independent. Inventory warnings, SLA reminders, summaries, refunds and external uptime monitoring are not part of v1.

## Implementation boundaries

- `src/modules/telegram/settings.js`: validated settings, public projection, encryption, configuration identity.
- `client.js`: bounded outbound Telegram HTTP requests, response validation and safe error codes; no database/business logic.
- `events.js`: domain-specific safe message builders and deduplicated outbox inserts; **no HTTP**.
- `queue.js`: one claimed message per tick, leases, retries, cooldown and lifecycle; **no payment transitions**.
- `admin-routes.js`: admin-only settings, explicit tests, status and failed-only retry API.
- Domain services call the event builders inside the existing business transaction for committed order/ticket/review/delivery changes. A rollback also rolls back the corresponding notification. Transport outages cannot block checkout or ticket creation because no Telegram call occurs on those paths. A database/outbox write failure can roll back its enclosing transaction (intentional atomicity, not best-effort silent loss).
- Technical payment errors that occur outside business transactions use a guarded alert insert so an alert database failure does not replace the original payment error.

Adding an event requires a named constant, a safe builder with a stable dedupe key, one domain hook and a regression test. Do not add Telegram HTTP calls to business services or reuse the SMS queue's provider-specific jobs.

## Admin settings and safety

Settings: enabled, HTTPS Bot API **base URL**, write-only bot token, numeric destination ID, separate order/ticket/payment/fulfillment toggles. An omitted token preserves the existing one; the UI omits a blank replacement field. GET responses expose only whether a token exists and its last four characters, never plaintext/ciphertext/fingerprint.

The custom URL can have a path:

```
https://tg.example.com/telegram
  → https://tg.example.com/telegram/bot<TOKEN>/sendMessage
```

It must implement the standard Bot API contract. This is not a SOCKS/HTTP forward-proxy setting. HTTPS is mandatory; credentials/query/fragment, obvious private/metadata/loopback addresses, and IPv6 literal endpoints are rejected. Redirects are disabled. Hostname validation is not a complete DNS-rebinding firewall: this is a trusted-admin integration setting, not a URL-fetch endpoint for untrusted users. Restrict outbound traffic at infrastructure level if that threat model applies. The proxy operator sees the bot token and notification contents; use only a trusted endpoint and do not log Bot API URL paths at the proxy.

Message content excludes ticket subject/body, phone, email, order form values, notes, licenses, passwords, OTPs, card details and raw upstream responses. Product titles, internal customer/order IDs, quantities, amount explicitly in **toman**, and state are included. Payment warnings explicitly do not establish whether money was debited. Error logs store allowlisted codes, not response descriptions or transport exception URLs.

The explicit connection test (`getMe`) validates endpoint/token. The explicit message test (`sendMessage`) validates the destination. Both use **saved settings**, are admin-only/rate-limited, and work even while automatic notifications are OFF. Connection success alone does not prove channel posting rights.

## Queue behavior

- Disabled integration/categories do not capture new events; there is no retrospective import.
- Already queued messages remain paused while disabled and resume when enabled. An in-flight HTTP send may complete after disable.
- One send per tick (default five seconds) deliberately favors reliable single-channel delivery over throughput.
- Temporary errors use exponential backoff, maximum eight automatic attempts. Telegram `retry_after` creates a persisted shared cooldown, including messages added during it.
- Authentication/permission/configuration failures become `FAILED` immediately. The panel shows counts, latest successful send/error and the latest 50 jobs; retry is only allowed for `FAILED`, never `SENT`.
- A configuration fingerprint binds each queued job to its original endpoint + destination + bot identity. Changing any of these does **not** silently forward old messages to another destination: the job fails with `TELEGRAM_CONFIGURATION_CHANGED`. An explicit failed-job retry confirms use of the current settings.
- Unique keys deduplicate purchase/delivery callbacks and one technical error per stage/payment attempt. Status-change notices are one per order/status, ShareBox-review notices one per fulfillment unit. This intentionally suppresses repeated polling and repeated transitions back to the same state.
- Expired leases recover after a crash; writes are fenced by the claim's UUID. Delivery is **at least once**, not exactly once: if Telegram accepted a send but the reply/local receipt was lost, recovery may duplicate it. `SENT` means Telegram accepted the message, not that a human read it.
- Jobs remain in SQLite for audit/deduplication. There is no automatic deletion/retention job in v1. Do not delete sent dedupe records as routine cleanup without a retention design.
- No Redis, extra daemon, webhook, or package dependency is introduced. The worker runs with the existing backend and stops on Fastify close. Run one backend worker process for this small SQLite deployment; this is not a high-throughput distributed messaging platform.

## Encryption/runtime configuration

Optional backend environment values (panel owns token/endpoint/chat ID):

```
TELEGRAM_CONFIG_ENCRYPTION_KEY=<stable random server-side secret>
TELEGRAM_REQUEST_TIMEOUT_MS=8000
TELEGRAM_WORKER_INTERVAL_SECONDS=5
```

AES-256-GCM uses the existing secret utility. If the dedicated key is absent it follows the existing application's pattern: SMS encryption key, then JWT secret. Production should use a dedicated strong stable key, stored outside Git and backed up securely. Set it **before saving a bot token**; changing the effective key requires re-entering the bot token. Never configure a placeholder key in production.

## Migration and rollout

There are only additive `TelegramSettings` and `TelegramQueueJob` tables and their indexes. No existing domain tables are rebuilt. Integration remains OFF until an administrator explicitly enables it.

1. Approve production deployment separately; stop backend writers and take a verified SQLite online backup outside the web root. Keep the previous code SHA and environment backup.
2. Pull the approved commit and run `npm run prisma:generate` from `backend`.
3. For databases with a complete, consistent Prisma migration history, run `npx prisma migrate deploy`.
4. For the existing bootstrap-style database without complete migration history, explicitly select its existing `DATABASE_URL` and run `TELEGRAM_MIGRATION_OFFLINE_ACK=1 npm run db:migrate:telegram`. This additive helper executes both table creations/indexes in one transaction, verifies integrity, refuses partial schemas, and is repeatable. It requires an operator backup; it does not silently create or overwrite a database.
5. **Never use `npm run db:apply` on production**: that existing command creates a fresh database for tests/bootstrap.
6. Build frontend, restart only this project's services, verify `/health`, authenticated `/api/v1/admin/telegram/settings` defaults OFF and `/admin/telegram` renders.
7. Configure token/base URL/destination in the panel, run connection and message tests from the actual application server, then enable chosen event categories. This is the real Iran-to-proxy-to-Telegram connectivity check.

Rollback: stop the new backend, revert code and restart. The additive tables can remain; do not drop/restore the whole live DB after new orders have arrived. If rolling back during migration before reopening writers, use the verified pre-deployment backup under the established restore procedure.

## Verification

```
cd backend
npm run prisma:generate
npm test
cd ..
npm run lint
npm run build
```

`tests/telegram.test.js` uses a temporary SQLite DB, admin/user API injection and mocked Telegram/Jibit/ShareBox transports. It covers settings/auth/secrets, default OFF, custom path, dedupe/retry/cooldown/pause/config changes, leases, transactional rollback, wallet/Jibit/instant/admin delivery, ticket/customer replies, payment review/errors, ShareBox review/completion and repeatable additive upgrade. Tests never send real Telegram messages, create real payments or mutate a live database. Real Telegram delivery cannot be claimed until the panel's message test succeeds using the configured bot and endpoint from the deployment host.
