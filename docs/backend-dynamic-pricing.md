# Dynamic pricing backend

Backend contract for dynamic pricing. The separate frontend integration is documented in [frontend-dynamic-pricing.md](frontend-dynamic-pricing.md).

## Money contract

- `priceCurrency`: `TOMAN` or `USD` (USD uses Wallex **USDT/TMN**, not an official fiat USD quotation).
- `basePrice`: exact non-negative decimal string; TOMAN is integer, USD supports six fractional digits.
- `profit`: single input: `20000` (toman), `%10` or `10%` (percentage), `$2.50` (USD), empty string/0 (zero).
- Persisted `profitType`/`profitValue` are structured fields. Percentage supports four decimals. Do not send them as writable API fields.
- Percentage markup applies to the converted, rounded base, not the selling price. Base and profit round half-up to integer toman **per unit**, then quantity multiplies the final unit price and margin.
- Public `product.price`, `OrderItem.priceSnapshot`, `Order.totalAmount` and wallet money are final TOMAN. Jibit adapter alone converts to IRR (`toman * 10`). Existing Prisma `Int` caps are enforced before recording money; direct payments also enforce the IRR cap.
- `Product.price` in the database/admin result remains a legacy TOMAN base field (0 for USD). Use `basePrice`/`priceCurrency` to edit and `product.pricing.unitPrice` to preview selling price. Never interpret the raw admin/database `price` as the final selling price.
- Effective rate order: last valid stored rate (including stale) → configured fallback → built-in 270000 TOMAN. Admin fallback is not a forced override of the last-good rate.
- Rate state distinguishes last attempt from last success; unchanged valid quotes are successes. Wallex does not provide a quote timestamp in the consumed stats, so freshness means successful retrieval time, not independently proven market freshness.
- New rows default to TOMAN and zero margin. Old orders have null cost/rate/margin snapshots, not fabricated zero profit.

## Admin APIs (existing ADMIN session required)

All paths are under `/api/v1/admin`; rate/pricing status responses are `Cache-Control: no-store`.

- `POST /products`: existing product fields plus `priceCurrency`, `basePrice`, `profit`. Legacy `{ price: 100000 }` remains accepted for TOMAN.
- `PATCH /products/:id`: omitted pricing fields are preserved. Changing currency requires `basePrice`. Legacy `price` on USD and mixing `price` with `basePrice` return `PRICING_LEGACY_AMBIGUOUS`.
- `GET /products`: private configuration and `pricing` breakdown, including rate context.
- `GET /pricing/settings`: fallback and staleness/alert thresholds.
- `PATCH /pricing/settings`: `fallbackRateToman` (10001..2147483647), `staleAfterSeconds` (120..86400, default 300), `alertCooldownSeconds` (120..86400, default 1800).
- `POST /pricing/preview`: `{ "priceCurrency": "USD", "basePrice": "2.5", "profit": "%10", "quantity": 2 }`. Returns `pricing` with unit/total price, unit/total margin and effective exchange rate. Does not create a product/order.
- `GET /pricing/status` and `GET /dashboard`: `exchangeRate` with rate/source/symbol, `FRESH|STALE|FALLBACK|DEFAULT`, retrieval/attempt/success timestamps and safe error code; `jobs` with due times, lease expiry and execution/failure counts. Dashboard is a backend contract for the later frontend step.
- Telegram settings now accept `exchangeRateEventsEnabled` (default true). Global Telegram integration still defaults OFF and requires existing bot/recipient configuration.

Public catalog and every customer order response use explicit serializers: no cost, margin definition or private financial snapshots. Embedded order products use the order's frozen final unit price, not today's product price. Public catalog reads have no network I/O and one shared DB rate per list response. The next frontend phase must also avoid stale Next.js/static caches and add customer handling for a price changing between browsing and purchase.

### Checkout price consent

`POST /api/v1/orders` additionally accepts optional `expectedUnitPrice` (integer TOMAN, 0..2147483647). Both wallet and Jibit compare it with the freshly calculated final unit price **inside the order transaction**, before any order/payment/wallet writes or provider call. A mismatch returns `409 PRICE_CHANGED` with only `{ unitPrice, totalAmount }` in `error.details`; the client must display the new price and obtain another explicit confirmation. Omitting the field preserves legacy clients. This guard requires no schema migration. Frontend refresh alone cannot provide this guarantee.

## Order snapshots

Both wallet and Jibit initiation calculate inside the order transaction, read one rate context and store on `OrderItem`:

- `priceCurrencySnapshot`, `basePriceSnapshot`
- `profitTypeSnapshot`, `profitValueSnapshot`
- `exchangeRateSnapshot`, `rateSourceSnapshot`, `rateFetchedAtSnapshot`
- `baseTomanSnapshot`, `profitTomanSnapshot` (per unit), `totalProfitSnapshot` (quantity included)
- existing `priceSnapshot` (final unit selling price)

These do not change after product/rate updates, repeated callbacks or refunds. Customer APIs expose only final sale money. Admin order APIs expose the private snapshot. `totalProfitSnapshot` is the **quoted product margin**, not net profit after processor fees or other costs. It becomes sale profit only when payment is PAID and the order is not cancelled/refunded; historical null margins remain unknown. Direct refunds retain the existing provider-only guard; wallet refunds credit the frozen `Order.totalAmount`.

## Periodic jobs

- `wallex-usd-toman`: due immediately on first registration, then 120000ms from its last start.
- `exchange-rate-health`: independent 60000ms staleness/incident checker. Admin status reads also check health.
- SQLite-backed atomic lease, owner token and expiry; persisted next-run time survives restarts. A restart respects a still-future due time rather than duplicating an in-flight fetch. An expired crashed owner is recovered when the job is due.
- Handlers perform network work outside transactions and **all durable side effects use `withLease`**, which fences late owners. Keep fenced callbacks DB-only and short; never make network requests inside them.
- Job failures are isolated, have safe code-only logging, bounded runtime and graceful shutdown. Fenced callback work has an explicit one-second deadline and abort guard, in addition to Prisma’s transaction timeout. A commit already submitted cannot be revoked; the owner waits for its transaction to settle before logging/finalizing/releasing the lease. Registry supports additional named periodic handlers; existing unrelated workers are not rewritten.
- `JOBS_ENABLED=true` by default outside tests; `WALLEX_REQUEST_TIMEOUT_MS=8000` default (1000..30000). Wallex uses two bounded attempts. Tests disable timers by default and inject provider/clock.
- Valid samples retained for 30 days; failed fetches never remove the last-good rate.
- Error/stale incidents enqueue Telegram notices through the existing durable queue, with persistent cooldown/dedupe and one recovery event per incident. A first fetch has a startup grace equal to `staleAfterSeconds`; even a job that never records its first attempt raises an incident after this grace. Notifications cannot be delivered if Telegram is disabled/unconfigured or the entire backend is offline; use external uptime/health monitoring for complete outages.

To add another job, register `{ name, intervalMs, timeoutMs, handler }` through the scheduler, use the supplied `signal` for outbound requests and `withLease` for writes, add clock/lease tests, and wire its status/alert behavior explicitly.

## Installation and migration

Development/test only: `npm ci`, `npm run prisma:generate`, `npm test`. `scripts/apply-schema.js` **creates/overwrites** a database; never run it on production.

For legacy installations without complete Prisma migration history, after reviewing the diff and entering a maintenance window:

1. Stop backend writers, including all queue/job workers, while preserving the site's previous source revision.
2. Take a verified SQLite-aware backup, check integrity/foreign keys and record its location; do not copy a live SQLite file ignoring WAL.
3. With the explicitly selected existing `DATABASE_URL` and newly generated Prisma client, run:
   `PRICING_MIGRATION_OFFLINE_ACK=1 node scripts/apply-pricing-migration.js`
4. The guarded script refuses missing/unexpected/partially-upgraded schemas, creates a private mode-600 `VACUUM INTO` backup, applies additive changes atomically and verifies integrity/foreign keys. It can be rerun against a complete schema. It does not alter or reset old order/payment/wallet values.
5. For installations with a complete migration history use the committed Prisma migration through the normal migration process instead; do not run both paths blindly.
6. Start the new backend, verify health, first Wallex sample, admin status, legacy catalog prices and Telegram configuration. Confirm dynamic product prices before enabling them for sale. Frontend changes are still a separate stage.

### Rollback safety

An old backend does not understand USD/margin products (`Product.price` is a legacy base and is zero for USD). **Never simply revert the code while those products remain active.**

- Before reopening traffic/no new writes: restore the verified pre-migration backup and prior source, then verify old catalog/payment behavior.
- After new orders/wallet/payment writes: never overwrite the DB with an old backup; that would lose financial records. Prefer fix-forward. If reverting code is unavoidable, enter maintenance, deactivate all dynamic USD/non-zero-margin products first, keep the additive schema/new financial data, then verify that only legacy-compatible TOMAN/zero-margin products can be sold.
- Preserve all incident, financial snapshot and backup files until reconciliation is complete.

Production deployment was not part of this development step. No real customer order, actual payment or production Telegram message is required for acceptance tests.
