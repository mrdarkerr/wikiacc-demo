# WikiAcc Backend

Lightweight Fastify backend for the WikiAcc storefront MVP.

## Core decisions

- Runtime: Fastify with JavaScript ES modules.
- Database: Prisma with SQLite for local development.
- Auth: email/password with a JWT stored in an HttpOnly cookie.
- Payments in this stage: wallet only. Admin credits/debits wallet balance manually.
- Product types:
  - `CUSTOM_FORM`: customer submits required order fields after purchase.
  - `INSTANT_DELIVERY`: the product consumes one or more ready delivery items from a delivery pool.

## Local setup

```bash
cd backend
copy .env.example .env
npm install
npm run prisma:generate
npm run db:apply
npm run db:seed
npm run dev
```

API docs are available at `http://localhost:4001/docs`.

## Module pattern

Each feature should keep the same shape:

```text
routes.js       HTTP mapping only
service.js      business rules and use-cases
repository.js   Prisma queries
schemas.js      Zod validation
```

Keep order, wallet, delivery, ticket and catalog logic out of route handlers. That keeps the codebase maintainable and makes a later Nest migration mostly a controller/provider rewrite.
