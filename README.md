# ecom

Full-stack e-commerce monorepo (pnpm + Turborepo).

| Package | What | Dev URL |
| --- | --- | --- |
| `apps/web` | Customer storefront — React + Vite + Tailwind | http://localhost:5173 |
| `apps/admin` | Store admin dashboard — React + Vite + Tailwind | http://localhost:5174 |
| `apps/api` | REST API — Express 5 + TypeScript + Zod | http://localhost:4000 |
| `packages/db` | Prisma 7 schema, migrations, seed, shared client (`@ecom/db`) | — |
| `packages/shared` | Typed API client, DTO types, formatters (`@ecom/shared`) | — |

## Getting started

```bash
pnpm install
pnpm db:up          # Postgres in Docker (host port 5433)
pnpm db:migrate     # apply migrations
pnpm db:seed        # demo catalog, customers, reviews, coupons, order history (wipes data!)
pnpm dev            # api + web + admin
```

Demo accounts (from the seed):

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@ecom.dev | admin1234 |
| Customer | demo@ecom.dev | demo1234 |

Coupons: `WELCOME10` (10% off), `SAVE20` ($20 off ≥ $150), `VIP50` ($50 off ≥ $300).

## Environment

Copy each `.env.example` to `.env`:

- `packages/db/.env` — `DATABASE_URL`
- `apps/api/.env` — `DATABASE_URL`, `PORT`, `JWT_SECRET`, `COOKIE_SECRET` (generate with `openssl rand -hex 32`), `CORS_ORIGINS`

Both Vite apps proxy `/api/*` to the API in dev, so the browser talks to a single origin and auth cookies just work.
For production builds set `VITE_API_URL` to the deployed API URL.

## API overview

Auth is a JWT in an httpOnly cookie. Guests get a signed-cookie cart that merges into the user's cart on sign-in.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET/PATCH /auth/me` · `POST /auth/password` |
| Catalog | `GET /categories` · `GET /products` (search, filters, sort, pagination) · `GET /products/:slug` · `POST /products/:id/reviews` |
| Cart | `GET /cart` · `POST /cart/items` · `PATCH/DELETE /cart/items/:productId` · `POST/DELETE /cart/coupon` |
| Checkout | `GET /checkout/shipping-methods` · `GET /checkout/quote` · `POST /orders` |
| Account | `GET /orders` · `GET /orders/:id` · `POST /orders/:id/cancel` · `/wishlist` · `/addresses` |
| Payments | `POST /payments/orders/:id` — **stub, returns 501** (see below) |
| Admin | `/admin/stats` · `/admin/products` · `/admin/categories` · `/admin/orders` (+ `PATCH :id/status`) · `/admin/customers` · `/admin/coupons` · `/admin/reviews` · `POST /admin/uploads` |

Use the typed client from `@ecom/shared` (`createApiClient`) rather than calling these by hand.

### Order lifecycle

```
PENDING_PAYMENT ──(payment)──▶ PAID ──▶ PROCESSING ──▶ SHIPPED ──▶ DELIVERED
       │
       └──▶ CANCELLED   (stock and coupon use are returned)
```

Placing an order reserves stock and empties the cart. Admins can move orders along the fulfilment
steps; `PAID` and `REFUNDED` are set only by the payment integration.

## 🚧 Payments — not implemented yet

Everything up to payment is built. An order is created as `PENDING_PAYMENT` / `UNPAID`, and the storefront
shows a "payment coming soon" step. To finish:

1. `apps/api/src/routes/payments.ts` — create a payment session with the chosen provider.
2. Add a webhook route in `apps/api/src/app.ts` **before** `express.json()` (needs the raw body); on success set
   `status=PAID`, `paymentStatus=PAID`, `paidAt`, `paymentProvider`, `paymentRef`.
3. Release stock for abandoned or failed payments (`cancelUnpaidOrder` in `apps/api/src/lib/orders.ts`).
4. Refunds, then allow cancelling paid orders in `ADMIN_TRANSITIONS` (`apps/api/src/lib/orders.ts`).
5. Wire the storefront's payment step (search for `TODO(payments)`).

## Changing the schema

Edit `packages/db/prisma/schema.prisma`, then `pnpm db:migrate`. The Prisma client is generated into
`packages/db/src/generated` (gitignored) and regenerated automatically before `dev`/`build`/`typecheck`.
Frontends import model types via `@ecom/db/browser` (type-only), so schema changes flow through to the UI types.
