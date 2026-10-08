# Dynamic pricing frontend

## Scope

Development integration on `feat/frontend-dynamic-pricing`; no production deployment, database migration or real payment/Telegram delivery is implied by this work. The backend contract and deployment requirements remain in [backend-dynamic-pricing.md](backend-dynamic-pricing.md).

- `/admin/products/new` and `?edit=<id>`: exact TOMAN/USD base price, one profit field (`20000`, `%10`, `$2`, empty/zero), and a server-calculated private preview. Changing currency clears the base instead of silently reinterpreting an old amount. Save sends `priceCurrency`, `basePrice` and `profit`, never legacy `price` or preview `quantity`.
- `/admin/products`: the selling amount comes from `pricing.unitPrice`, not legacy `Product.price` (zero for USD). The base and profit definition are admin-only.
- `/admin`: current effective rate with fresh/stale/fallback/default distinction and a link to rate settings.
- `/admin/pricing`: fallback and staleness/cooldown settings; status of scheduled rate/health jobs. Status polling does not replace an unsaved settings form. Reading status does not force a Wallex fetch.
- `/admin/telegram`: explicit exchange-rate category for failure/staleness/recovery alerts. Global integration and valid bot/recipient configuration are still required.
- `/admin/orders/<id>`: frozen private base/rate/profit snapshot; unknown historical data is not reconstructed. Quantity-inclusive quoted margin is not net realized profit.
- `/` and `/store?product=<slug>`: final TOMAN prices only, refreshed while visible every 30 seconds and on focus/reconnection. Checkout does not make customer-facing base/profit calculations.

## Client and synchronization

`lib/api.ts` is the shared transport; `types/api.ts` separates public and admin products and private order snapshots. Existing pricing routes are wrapped by typed methods. Pricing/settings/status and public catalog successes are checked before the UI consumes amounts.

- Success envelope: `{data: ...}`; metadata is preserved by `apiFetchWithMeta`.
- Errors preserve HTTP status, `error.code`, message and details. Malformed/empty JSON is an `API_INVALID_RESPONSE`, not a raw parsing exception.
- Fetch plus body reading share a 30-second bound. Caller cancellation remains an intentional abort; timeout/network failures are separately classified. Timers and abort listeners are cleaned up.
- Requests use `credentials: include` and `cache: no-store`. Mutations are never automatically retried: a lost response may follow a completed server operation.
- Pricing preview is debounced 350ms, keyed to the exact normalized draft and refresh epoch, cancelled on edits/unmount, and refreshed every 30 seconds/focus. Only the current valid preview can be saved; old quotes are hidden immediately when the input changes.
- Currency/decimal/profit syntax is validated before requesting a preview; Persian/Arabic digits and numeric separators normalize to exact strings. The frontend does not duplicate the financial calculator.
- Checkout first reads the existing product-detail route. A changed price is displayed without creating an order. It then posts the amount shown at confirmation as `expectedUnitPrice`. The backend transaction guard rejects any subsequent price race with `409 PRICE_CHANGED` before wallet/payment side effects. The new amount requires another explicit user submission. Both WALLET and JIBIT share the guard; input controls are locked during submission.
- Applying a checkout quote cancels any older catalog refresh, so that a delayed list response cannot replace the confirmed price. Later genuinely fresh polls remain allowed.
- After a successful wallet purchase, the displayed balance is read from the existing wallet-summary API, never locally subtracted. A failed or malformed follow-up read displays an unknown balance while preserving the successful order; it cannot retry the purchase. Mounted/epoch guards reject obsolete balance callbacks.

## Verification commands

Use Node 22 matching the target environment. Install frontend and backend dependencies from their existing lockfiles and generate the backend Prisma client first. No new test dependency is required; frontend tests reuse the installed backend Vitest:

```sh
node backend/node_modules/vitest/vitest.mjs run --config vitest.frontend.config.mts
npm run build
npm run lint
cd backend && npm test
```

Tests cover malformed envelopes and prices, validation/auth status and details, no automatic retry, stalled bodies, caller abort, HTTP 204, numeric/profit forms, real Fastify settings/status/preview/catalog/checkout contracts, admin display states and nullable financial history. Backend consent regressions cover both payment methods, no-write conflicts, invalid input, quantity and legacy callers.

Browser interaction and desktop/mobile screenshot acceptance are a separate verification step against an isolated test database. Do not treat unit-test/build success as proof that visual acceptance has completed. No real payment provider or Telegram delivery is needed for this step.

The isolated browser checks exercised actual product saves and readback, all profit modes including zero, currency-reset and invalid-preview gating, fallback settings and range rejection, unsaved-form retention, Telegram category toggle/readback with delivery disabled, customer admin-access rejection and financial-field privacy, WALLET/JIBIT changed-price preflight, a real wallet `409 PRICE_CHANGED` race without debit/order writes, and explicit confirmation with double-click protection. A wallet read failure was fault-injected after a real test-order success; the order remained successful and no second mutation was sent. Six recorded checkout browser scenarios passed. No real Jibit bank redirect or Telegram delivery was exercised.

Desktop/mobile images were captured for eight areas (16 originals): product pricing, admin products, dashboard rate, rate settings, Telegram rate category, private order finances, customer storefront and changed-price checkout. These are development fixtures, not production/customer data. Visual approval remains a user decision; capture and inspection are not approval.

## Deployment compatibility

The new frontend must run with the matching backend that accepts `expectedUnitPrice`; older strict order schemas reject this new field. The price-consent guard itself needs no database migration, but an installation without the previously merged dynamic-pricing schema still needs the additive migration documented in the backend guide. Never deploy only the new frontend onto an old live backend and assume checkout remains compatible.
