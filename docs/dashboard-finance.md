# Admin dashboard finance

## Backend contract

- `GET /api/v1/admin/finance/history?interval=daily|weekly&page=1`: newest first pagination, chronological points within each page. Daily 7 points/page; weekly 8 Saturday–Friday weeks/page. Explicit inclusive `startDate`/`endDate` on range and every point; current incomplete period flagged. Clamps a page past the oldest eligible order to the last page. No legacy 200-order list limit.
- `GET /api/v1/admin/finance/forecast`: 7 and 30 calendar-day horizons starting tomorrow. Trailing daily average over up to 28 complete Tehran days, including zero-sale days. At least 7 observed days since first eligible order and 3 paid orders in the sample required; otherwise amounts are null with `INSUFFICIENT_DATA`. No future exchange-rate prediction.
- Admin authentication only; `Cache-Control: no-store`; all money integer TOMAN. Turnover is `Order.totalAmount` for PAID orders excluding CANCELLED/REFUNDED; wallet top-ups are not sales. Time grouping uses **order creation**, not payment verification time: no uniform paidAt exists. Date conversion uses IANA Asia/Tehran including historical DST, independent of host/browser timezone.
- Profit is the sum of frozen `totalProfitSnapshot` (**already quantity-inclusive**). No revaluation from today's product/rate. This is product margin before payment fees/operating costs, not accounting net profit. Null historic snapshots are unknown, never fabricated zero: totals include known margin plus explicit known/unknown item counts; an all-unknown/empty total is null. Forecast profit is null if any sample item has unknown margin.
- These reports reflect current cancellation/refund state, not a historical cash ledger or period-specific refund movement. This change does not alter order/payment/wallet records or schemas.

## Strict API and generated client

All success fields are required, nullable values are explicit, and objects reject additional properties. Both endpoints declare 200/400/401/403/429/500 JSON responses and session security in live Swagger at `/docs`. Strict raw-payload validation runs **before** Fastify serialization, preventing silent stripping/coercion of malformed amounts. Input validation is scoped to these routes. Existing unrelated APIs are not rewritten.

`npm run generate:finance` exports the actual registered Swagger paths to `docs/openapi-finance.json` without DB reads or workers, then generates the SDK/types/Zod validators under `lib/generated/finance/`. Do not edit generated files. Generator configuration makes closed OpenAPI objects strict in Zod as well (the generator's default would silently strip extras). The finance adapter validates error statuses and envelopes, handles timeout/cancellation, and maps malformed responses to a visible contract error instead of rendering money.

## Verification

- Backend: `npm test --prefix backend -- --maxWorkers=2`
- Frontend: `npm run test:frontend -- --maxWorkers=2`
- Types/build: `npx tsc --noEmit`; `npm run build`
- Regenerate and compare committed spec/SDK for drift with `npm run generate:finance`.
- Browser acceptance uses an isolated scratch SQLite DB, synthetic test orders persisted through Prisma and real Fastify APIs. No production credentials, customer data, payment, SMS, or Telegram messages required. Mobile screenshots are responsive Android Chrome emulation, not an APK/device test.

## Verified local acceptance

Backend suite: 17 files / 161 tests passing. Frontend suite: 10 files / 44 tests passing. TypeScript, scoped ESLint, production Next build and OpenAPI/SDK regeneration drift check passed. Browser used the real local APIs with 300 synthetic persisted orders; report totals matched rendered money. Weekly older/newer navigation, historical unknown-margin warning, malformed-response error/retry, and a delayed weekly request superseded by daily selection were exercised. No horizontal page overflow at 320, 390, 768 and 1440 viewport widths; only the chart scrolls horizontally. Final browser error capture was empty. Screenshots cover both changed financial sections in desktop and Android Chrome responsive emulation; not a physical device test.

Dependency audit is not clean: existing application/toolchain advisories remain, and the new development-only OpenAPI generator has a transitive high advisory. No broad dependency upgrades were included in this scoped feature. Review/update dependencies separately before treating the repository as security-clean.

Deployment requires explicit approval; deploy backend and generated-client frontend together. No migration required. Rollback only this finance feature to its parent revision without undoing the already-deployed dynamic pricing code/schema.
