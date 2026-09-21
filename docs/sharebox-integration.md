# ShareBox storefront integration

## Scope

Wikiacc products of type `SHAREBOX` link to one ShareBox sales category independently of their Wikiacc storefront category. A product's price is managed by Wikiacc; license duration and available capacity are governed by the selected ShareBox category. The sales category list does not promise or reserve stock.

The connection targets ShareBox's sales API, not its admin or native-client API. Generate a named sales API key such as **Wikiacc** in the ShareBox admin panel and enter it only in Wikiacc's protected integration settings. The plaintext credential must not be checked into Git, sent to customer browsers, included in error bodies, or logged.

## Purchase and delivery guarantees

- Both wallet purchases and verified Jibit purchases must use the same durable fulfillment path.
- The customer receives issued credentials in their existing order deliveries. A paid order waiting for ShareBox is not a failed payment.
- Each purchased unit has a permanent identity and immutable request snapshot. Quantity three requires three different identities, not three retries of one identity.
- The snapshot binds category, customer name/phone, order reference and integration key identity before issuance. Later profile or product edits must not change retries.
- `reference` is the customer-visible Wikiacc order code (`WKA-` plus the final six ID characters in uppercase). The full internal item ID is used in the permanent fulfillment identity; the short display code is not an idempotency key.
- ShareBox constructs the license label as `customer_name | customer_phone`.
- Network timeouts can occur after ShareBox has committed. Always retry the same body, same external identity and same API key. Never refund or generate a replacement identity merely because a response was lost.
- A replaced API key has a different ShareBox deduplication namespace. Changing the key is rejected while unfulfilled active orders exist (including unpaid Jibit orders); the check and settings write share a transaction with respect to checkout snapshots. Re-saving the same key is allowed. Do not revoke the current key in ShareBox before outstanding orders are resolved, and never automatically resend jobs under a replacement key.
- Unpaid, cancelled and refunded orders must not begin issuance. Administrative state changes must not race in-flight or ambiguous issuance.
- Mark delivery complete and enqueue the existing completion notification only after all units have durable delivery records.

## Operational acceptance

Before an approved deployment, run the isolated backend suite, frontend type/build checks, and a purchase acceptance against an isolated real ShareBox instance. Cover quantities, successful wallet/Jibit purchases, unpaid/failed Jibit attempts, temporary capacity/network failures, exact replay after a lost response, changed customer/product/key, concurrent workers, and secret-safe admin/customer responses.

Production deployment, schema upgrade, real key creation and enabling the integration are separate authorized operations. Back up the SQLite database and preserve its encryption secret before upgrade. **Do not run `db:apply` on an existing database**: that script creates a fresh schema and overwrites its target file. Use the dedicated ShareBox upgrade path documented with the implementation.

## Approved upgrade procedure

1. Stop **all Wikiacc backend processes** that access its SQLite database. Do not stop or modify ShareBox services for this integration upgrade.
2. Take an independent verified backup, including the backend configuration and encryption secret. Preserve `SMS_CONFIG_ENCRYPTION_KEY` (or its existing `JWT_SECRET` fallback).
3. With the approved code/dependencies installed, run in `backend/`:

   ```sh
   npm run prisma:generate
   SHAREBOX_MIGRATION_OFFLINE_ACK=1 npm run db:migrate:sharebox
   ```

   Use the existing correct `DATABASE_URL`; do not replace it with a test/default database path. The migration also creates a consistent private `.pre-sharebox-*.bak` file, checks preserved row counts and foreign keys, and refuses a partially applied schema. The offline acknowledgement is an operator confirmation, not a process supervisor.
4. Build/restart the approved Wikiacc version and verify original products, orders and inventory. The integration defaults disabled. Do not roll the backend back to a version that cannot read the new `SHAREBOX` product type after new products/orders exist.
5. In `/admin/sharebox`, enter the named sales key, then enable issuance. In product creation choose **شیر‌باکس** and its target category. Wikiacc's storefront category remains independent.

## Operations

- Pending paid jobs are picked up on startup and then every 10 seconds by default; API requests time out after 8 seconds by default. Retry failures use backoff and stop for manual review after eight attempts or a terminal upstream error. Admin order retry requeues the same jobs, not a new purchase.
- Disabling the connection prevents new purchases and future issuance attempts once the worker observes it; an in-flight request may still finish. Configuration failures before any external request do not count as issuance attempts and do not permanently block an otherwise valid refund. Existing jobs retain their original credential fingerprint and target; changing the key is blocked until active outstanding orders are resolved.
- Refund/cancellation is blocked once issuance has been attempted, including ambiguous timeouts. Reconcile and, where necessary, revoke the remote license through authorized ShareBox administration before operational resolution. There is no automatic ShareBox revoke/refund API in this feature.

## Verification commands

From the repository root:

```sh
npm --prefix backend test
npx tsc --noEmit
npm run lint
npm run build
```

An optional real-service contract acceptance script is available:

```sh
node scripts/sharebox-contract-acceptance.mjs /absolute/private/disposable-fixtures
```

The directory must contain `fixture.json` with `baseUrl` (loopback only), `category.id`, `apiKey` and `adminToken` from a **disposable** ShareBox v0.2.0+ installation. The category needs at least three available seats. Keep this file mode 0600 outside Git. The script creates/removes its own temporary Wikiacc SQLite database and creates three real test licenses in that disposable ShareBox. It exercises lost responses *after an actual remote commit*, immutable replay and the verified Jibit path (gateway simulated, ShareBox real). Never point it at development/customer datasets.

Upstream contract: `sharebox-dashboard/docs/sales-api.md` (ShareBox v0.2.0 or later).
