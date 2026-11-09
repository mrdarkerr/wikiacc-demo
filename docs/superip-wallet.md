# Super IP reseller wallet product

`SUPERIP_WALLET` is a variable-amount product, not an editable custom form. Title, description, features, category, active/archive state follow the existing catalog. Static price/base/profit are zero; the customer selects 1,000–200,000,000 integer toman, quantity one. Charged amount equals credited principal; profit snapshot is zero. Both wallet and Jibit checkout snapshot the lower-case ASCII username, principal, complete HTTPS endpoint and `gimiacc:<full order item id>` reference inside the order transaction. Jibit uses the existing rial conversion and verification path.

## Ownership and API

- Manager owns reseller identity and append-only wallet ledger. WikiAcc only sends paid fulfillment intents.
- Configure `/admin/superip` and manager Settings → wallet webhook with the same random 32+ character secret. Manager stores only SHA-256; WikiAcc encrypts it using its existing `SMS_CONFIG_ENCRYPTION_KEY`. Public/settings responses never return credentials.
- Endpoint: `POST https://reseller.superip-app.com/api/reseller/wallet-webhook`, `Authorization: Bearer <secret>`, JSON `{reference,username,amount}`. Successful response: `{reference,username,amount,receiptId,status:"credited"}`.
- Reference is globally unique in the manager integration, independent of username and secret rotation. Identical replay returns the immutable receipt; altered payload returns 409. No credit to absent/suspended reseller. A prior successful receipt remains replayable after suspension.
- Admin-only WikiAcc routes: GET/PATCH `/api/v1/admin/superip/settings`; POST `/api/v1/admin/orders/:id/superip/retry`.

## Recovery boundaries

The small durable `SuperipFulfillment` worker uses per-row claim tokens, bounded retries and a lease longer than its HTTP deadline. It never calls the manager inside a SQLite transaction. Claim, dispatch and receipt persistence require a paid, noncancelled order. A timeout is an unknown result, not proof of failure: retry exactly the frozen reference, username and amount. The manager deduplicates even if a request outlives a local lease. Receipt persistence and delivery creation are one fenced transaction.

After any claim/attempt, automatic refund/cancellation/manual delivery is blocked; use reconciliation and same-reference retry. A failure does not return money automatically. Absent/suspended users or credential errors enter REVIEW_REQUIRED. An admin cannot change the recipient on an existing purchase. A genuinely wrong recipient requires explicit financial reconciliation, not editing history. Endpoint changes are blocked while active orders (including unpaid direct-payment orders) remain outstanding; shared-secret rotation is allowed because it does not change the manager identity/reference namespace. Changing an endpoint to a different manager is not a supported pending-order recovery technique.

## Release and rollback

1. Verify current Git revisions and run focused backend/frontend tests; build with production public environment variables. No real-customer credit is needed for smoke acceptance.
2. Deploy manager migration 19 and API/web first, with the existing application-only Docker release procedure and verified database/config backups. Existing reseller nginx allowlist already includes the webhook.
3. Stop WikiAcc backend writers, retain a final SQLite backup via SQLite backup API, integrity-check it and copy offhost. Run `SUPERIP_MIGRATION_OFFLINE_ACK=1 node scripts/apply-superip-migration.js` with the production DATABASE_URL, then repeat it to verify idempotence. Never run `db:apply` on production.
4. Generate Prisma client, activate built frontend/backend, verify HTTPS pages/assets, admin-only settings and authenticated non-crediting webhook rejection. Configure both secrets privately; then publish the catalog product.
5. Schema is additive (two new tables); keep it on rollback. Disable the product and integration first. Once new paid orders exist, prefer a forward fix; old Prisma does not recognize the new product enum, and old workers cannot fulfill these jobs. Never restore an old financial database after reopening payment writers.

## GimiAcc brand boundary

This branch preserves GimiAcc branding, assets, configured cookie, GMA payment identifiers and existing ShareBox download URLs. The upstream merge deliberately excludes unrelated download and description-renderer changes. New fulfillment references use `gimiacc:<full order item id>`; already persisted references must never be rewritten. GimiAcc keeps its own database and encryption key; only the explicitly configured integration credential is shared with the existing receiver. The receiver currently uses the historical `wikiacc-webhook` integration audit label for this shared connection.

## GimiAcc published acceptance

Application/build revision: `edeae75a10483480abe6f3c16d1e6ba97e716567`, merged into the dedicated `gimiacc` branch. Product `/store?product=superip-reseller-wallet` is active on `gimiacc.com`; its integration is configured with the existing receiver credential, encrypted with GimiAcc's own key. The receiver and WikiAcc settings were not changed. An authenticated amount-zero request from GimiAcc's real client confirmed HTTPS/authentication without a wallet credit.

The final quiescent snapshot SHA-256 is `3fe722d967cac7ff8c94bb9d8f7bf91fd055c711455f7ebe78893c783d253a11`. Backups are retained at `/opt/gimiacc/backups/superip-wallet-release` on live and `/root/backups/gimiacc/superip-wallet` on dev. Two isolated and two live additive migrations preserved all 29 original tables. Backend/frontend environment and PM2 configuration hashes stayed unchanged. The public product page retained GimiAcc title/logo and loaded all observed application assets successfully; public health passed and unauthenticated settings returned 401. This acceptance does not include a real payment or customer credit.

## Upstream WikiAcc published acceptance

The live application/frontend build is from `ef09e0e6934c2843c6e21f0666e2b889f9dc0880`. Product `superip-reseller-wallet` is active at `/store?product=superip-reseller-wallet`; integration settings are enabled and configured. Public catalog readback, desktop/mobile product rendering, linked browser assets and backend health passed. The real production client made an authenticated HTTPS request with amount zero and received the expected validation rejection; no real wallet credit or payment was made. Focused financial/component tests, typecheck and production build passed; full-tree lint retains pre-existing generated-finance errors outside this scope.

Backups: live `/opt/wikiacc/backups/superip-wallet-release`, offhost `/root/backups/wikiacc/superip-wallet`. Final quiescent snapshot SHA-256 `eeeaf80d786937614ca8bbc347e79c2d25ecee06b5b79b97ea779e5476007048`; two isolated and two live migration runs preserved all 30 original tables' contents. The prior frontend build is retained as `previous-next` in the live backup directory. Acceptance/provenance is under `/root/.hermes/cache/scratch/wikiacc-superip-release/` on dev. Never restore this pre-release financial snapshot after new purchases; follow the forward-fix boundary above.

## Targeted tests

`npm --prefix backend test -- tests/superip.test.js tests/sharebox.test.js tests/price-consent.test.js tests/pricing-orders.test.js tests/api.test.js`

`npm run test:frontend` and `npx tsc --noEmit --incremental false`.

Standalone migration accepts only an existing database, checks for partial schema and runs its additive SQL atomically. Production backup/restore acceptance belongs to release orchestration, not the application worker.
