import { prisma } from '@ecom/db'
import { Router } from 'express'
import { HttpError, notFound } from '../lib/http.js'
import { currentUser, requireAuth } from '../middleware/auth.js'

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  PAYMENTS — NOT IMPLEMENTED YET (to be built together)                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Everything up to this point is done: an order exists in PENDING_PAYMENT /
 * UNPAID with its totals, items and reserved stock. What's left:
 *
 *  - Pick a provider (Stripe, Razorpay, PayPal, …) and create a payment
 *    session/intent for `order.totalCents` here.
 *  - A webhook route (needs the raw request body, so mount it BEFORE
 *    express.json() in app.ts) that verifies the provider signature and, on
 *    success, sets status=PAID, paymentStatus=PAID, paidAt, paymentProvider,
 *    paymentRef.
 *  - Failure / expiry handling: paymentStatus=FAILED, and release stock for
 *    abandoned orders (see cancelUnpaidOrder in lib/orders.ts).
 *  - Refunds: REFUNDED status, and allow cancelling PAID orders in
 *    ADMIN_TRANSITIONS (lib/orders.ts) once refunds exist.
 *
 * The storefront already calls POST /payments/orders/:id and shows a
 * "payment coming soon" state when it gets PAYMENT_NOT_IMPLEMENTED.
 */
export const paymentsRouter = Router()

paymentsRouter.post<{ id: string }>('/orders/:id', requireAuth, async (req, _res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: currentUser(req).id } })
  if (!order) throw notFound('Order')

  // TODO(payments): create a payment session with the chosen provider and return what the client needs.
  throw new HttpError(501, 'Online payment is not available yet', 'PAYMENT_NOT_IMPLEMENTED')
})
