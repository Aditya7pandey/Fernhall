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

Every seeded customer (e.g. any email on the admin **Customers** page) also logs in with `demo1234`.

**Dataset size.** The seed is deterministic and builds roughly 1,000 customers, ~600 products (37 hand-written
plus generated colour/material variants), ~6,900 orders spread over a year (growth, weekends, Diwali and other
sale spikes), ~13k order items, ~2.3k verified-purchase reviews, wishlists, carts and notifications. Takes ~10s.
Tune it with env vars:

```bash
SEED_CUSTOMERS=5000 SEED_VARIANTS_PER_PRODUCT=30 pnpm db:seed
```

Coupons: `WELCOME10` (10% off), `SAVE200` (₹200 off ≥ ₹2,000), `VIP500` (₹500 off ≥ ₹5,000), `FESTIVE15` (15% off, festive sale — already expired, so you can test the expired-coupon path).

Prices are in **INR**, stored in paise in the `*Cents` fields (₹1 = 100) and **GST-inclusive** (18%).

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
| Payments | `POST /payments/orders/:id` · `POST /payments/verify` · `POST /payments/webhook` (Razorpay, see below) |
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

## Payments (Razorpay) & idempotency

1. Get **test mode** keys from the Razorpay Dashboard → Account & Settings → API Keys, and put them in
   `apps/api/.env` (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`). Restart the API.
2. Place an order on the storefront → **Pay** → Razorpay Checkout opens. Use Razorpay's test card / UPI details.
3. *(Optional)* Webhooks need a public URL. Run a tunnel (e.g. `cloudflared tunnel --url http://localhost:4000`), then add a
   webhook in the Dashboard pointing at `<tunnel>/payments/webhook` with the events `payment.captured`, `order.paid`
   and `payment.failed`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`. Without it, the browser's verify call still marks orders paid.

| Endpoint | Idempotency technique |
| --- | --- |
| `POST /orders`, `POST /payments/orders/:id` | `Idempotency-Key` header → `middleware/idempotency.ts` (stores and replays responses) |
| `POST /payments/orders/:id` | One Razorpay order per order (`providerOrderId` is unique; conditional update) |
| `POST /payments/verify` | Naturally idempotent: signature check + conditional `UPDATE … WHERE paymentStatus IN (UNPAID, FAILED)` |
| `POST /payments/webhook` | Event de-duplication: `PaymentEvent.eventId` is unique, recorded in the same transaction as the work |

`pnpm --filter @ecom/api test` runs the 11 tests that pin down the middleware's behaviour
(replay, 409 on concurrent requests, 422 on key reuse, 5xx releases the key, per-user scope, TTL).

Not built yet: refunds (then allow cancelling PAID orders in `ADMIN_TRANSITIONS`) and a real email provider.

## Background jobs (BullMQ + Redis)

Slow or retryable side effects run on queues instead of inside HTTP requests. Redis comes from
`docker-compose.yml` (host port **6380**; `pnpm db:up` starts it with Postgres).

| Event (published after the DB commit) | Queue | Job | What the worker does |
| --- | --- | --- | --- |
| Order placed (`POST /orders`) | `orders` | `order.placed` | "Items reserved" email |
| | `orders` | `order.expire` (delayed `ORDER_PAYMENT_TIMEOUT_MINUTES`, default 30) | Unpaid? Ask Razorpay if a payment exists → mark paid, else cancel + release stock + email |
| Payment succeeded (verify or webhook, whichever flipped it to PAID) | `payments` | `payment.succeeded` | Confirmation email, drop the expiry job |
| — (every 10 min) | `orders` | `orders.sweep` | Safety net: expires stale unpaid orders, sends missing confirmations |

- Workers run inside the API in dev (`RUN_WORKERS_IN_API=true`). In production set it to `false` and run
  `pnpm --filter @ecom/api worker:start` as its own process.
- Delivery is at-least-once, so every handler is idempotent: deterministic job ids de-dup publishing,
  `OrderNotification (orderId, kind)` is unique so an email goes out once, and order state changes are conditional updates.
- Emails are logged to the console (`lib/mailer.ts`) until a real provider is plugged in.
- Code: `src/queues/` (queues + publishers) · `src/jobs/` (handlers) · `src/workers/` (BullMQ workers) · `src/worker.ts` (standalone entry).

## API code layout

`routes/*` only wire paths to middleware and controller functions; the request handling lives in
`controllers/*.controller.ts`; shared domain logic in `lib/`.

## Changing the schema

Edit `packages/db/prisma/schema.prisma`, then `pnpm db:migrate`. The Prisma client is generated into
`packages/db/src/generated` (gitignored) and regenerated automatically before `dev`/`build`/`typecheck`.
Frontends import model types via `@ecom/db/browser` (type-only), so schema changes flow through to the UI types.
