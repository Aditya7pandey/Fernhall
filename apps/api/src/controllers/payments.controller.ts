/**
 * Razorpay payment flow
 * ─────────────────────
 *  1. POST /payments/orders/:id   → create (or reuse) a Razorpay order for our order
 *  2. Browser opens Razorpay Checkout with that order id; customer pays
 *  3. POST /payments/verify       → browser sends Razorpay's signed result; we verify + mark PAID
 *  4. POST /payments/webhook      → Razorpay tells us server-to-server (backup for step 3,
 *                                   e.g. the customer closed the tab right after paying)
 *
 * Steps 3 and 4 usually BOTH arrive, in any order, sometimes at the same moment — so marking
 * an order paid must be idempotent (see markOrderPaid in lib/razorpay.ts). Whichever one
 * actually flips the order to PAID publishes `payment.succeeded` to the queue.
 */
import { Prisma, prisma } from '@ecom/db'
import type { Request, Response } from 'express'
import { env } from '../env.js'
import { HttpError, badRequest, conflict, notFound } from '../lib/http.js'
import { ensureCaptured, isValidCheckoutSignature, isValidWebhookSignature, markOrderPaid, razorpay } from '../lib/razorpay.js'
import { z } from '../lib/validate.js'
import { currentUser } from '../middleware/auth.js'
import { publishPaymentSucceeded } from '../queues/publishers.js'

const verifyBody = z.object({
  orderId: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
})

// ─── 1. Start a payment ─────────────────────────────────────────────────────
//
// Idempotency, two layers:
//  • Idempotency-Key header (middleware on the route): a double-clicked "Pay" replays the first response.
//  • Natural idempotency: one of our orders maps to ONE Razorpay order (providerOrderId is unique).
//    Even a request with a *new* key reuses the existing Razorpay order instead of making another.

export async function startPayment(req: Request<{ id: string }>, res: Response) {
  const user = currentUser(req)
  const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: user.id } })
  if (!order) throw notFound('Order')
  if (order.paymentStatus === 'PAID') throw conflict('This order has already been paid')
  if (order.status !== 'PENDING_PAYMENT') throw conflict('This order can no longer be paid')

  let providerOrderId = order.providerOrderId
  if (!providerOrderId) {
    const created = await razorpay().orders.create({
      amount: order.totalCents, // paise
      currency: order.currency,
      receipt: `order_${order.number}`,
      notes: { orderId: order.id, orderNumber: String(order.number) },
    })
    // Conditional update: only store it if nobody else stored one first (two concurrent
    // requests with different keys could both get here). The loser's Razorpay order is
    // simply never used — unpaid Razorpay orders cost nothing.
    const { count } = await prisma.order.updateMany({
      where: { id: order.id, providerOrderId: null },
      data: { providerOrderId: created.id, paymentProvider: 'razorpay' },
    })
    providerOrderId =
      count === 1 ? created.id : (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).providerOrderId!
  }

  res.status(201).json({
    provider: 'razorpay',
    keyId: env.razorpay.keyId, // public key — safe to send to the browser (never the secret)
    razorpayOrderId: providerOrderId,
    amount: order.totalCents,
    currency: order.currency,
    orderId: order.id,
    orderNumber: order.number,
    prefill: { name: user.name, email: user.email },
  })
}

// ─── 3. Verify the browser's payment result ─────────────────────────────────
//
// Naturally idempotent — no key needed: verifying the same signature twice gives the same
// answer, and markOrderPaid's conditional update means only the first call changes anything.

export async function verifyPayment(req: Request, res: Response) {
  const user = currentUser(req)
  const body = verifyBody.parse(req.body)

  const order = await prisma.order.findFirst({ where: { id: body.orderId, userId: user.id } })
  if (!order) throw notFound('Order')
  if (order.providerOrderId !== body.razorpay_order_id) throw badRequest('Payment does not belong to this order', 'PAYMENT_MISMATCH')
  if (!isValidCheckoutSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) {
    throw badRequest('Payment signature is invalid', 'INVALID_SIGNATURE')
  }

  if (order.paymentStatus !== 'PAID') {
    await ensureCaptured(body.razorpay_payment_id, order.totalCents, order.currency)
  }
  const { changed, order: updated } = await markOrderPaid(order.id, body.razorpay_payment_id)
  if (changed) await publishPaymentSucceeded(order.id, body.razorpay_payment_id)
  res.json({ status: updated.status, paymentStatus: updated.paymentStatus, orderId: updated.id })
}

// ─── 4. Webhook ─────────────────────────────────────────────────────────────
//
// Razorpay retries a webhook until it gets a 2xx, so the same event can arrive several times.
// Idempotency technique: EVENT DE-DUPLICATION. We record each event id in PaymentEvent (unique),
// in the SAME transaction as the work it triggers:
//   • duplicate delivery → the insert hits the unique constraint → we answer 200 and do nothing
//   • our processing fails → the transaction rolls back the insert too → Razorpay's retry
//     gets processed properly (recording "seen" without doing the work would lose the event)
//
// The route mounts this BEFORE express.json() (see app.ts): the signature is over the raw bytes.

type WebhookEvent = {
  event: string
  payload: {
    payment?: { entity: { id: string; order_id: string; amount: number; currency: string; status: string } }
    order?: { entity: { id: string } }
  }
}

export async function handleWebhook(req: Request, res: Response) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : ''
  const signature = req.get('x-razorpay-signature') ?? ''
  if (!raw || !isValidWebhookSignature(raw, signature)) {
    throw new HttpError(400, 'Invalid webhook signature', 'INVALID_SIGNATURE')
  }

  const event = JSON.parse(raw) as WebhookEvent
  // Razorpay sends a unique id per event in this header; fall back to event type + entity id
  const eventId =
    req.get('x-razorpay-event-id') ?? `${event.event}:${event.payload.payment?.entity.id ?? event.payload.order?.entity.id}`
  const payment = event.payload.payment?.entity
  const providerOrderId = payment?.order_id ?? event.payload.order?.entity.id

  let paidOrderId: string | null = null
  try {
    paidOrderId = await prisma.$transaction(async (tx) => {
      const order = providerOrderId ? await tx.order.findUnique({ where: { providerOrderId } }) : null
      await tx.paymentEvent.create({
        data: {
          provider: 'razorpay',
          eventId,
          type: event.event,
          orderId: order?.id ?? null,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      })
      if (!order || !payment) return null

      if (event.event === 'payment.captured' || event.event === 'order.paid') {
        if (payment.amount !== order.totalCents || payment.currency !== order.currency) {
          console.warn(`[webhook] amount mismatch on order ${order.id}: got ${payment.amount} ${payment.currency}`)
          return null
        }
        // Same conditional update as markOrderPaid, inside this transaction
        const { count } = await tx.order.updateMany({
          where: { id: order.id, status: 'PENDING_PAYMENT', paymentStatus: { in: ['UNPAID', 'FAILED'] } },
          data: { status: 'PAID', paymentStatus: 'PAID', paymentProvider: 'razorpay', paymentRef: payment.id, paidAt: new Date() },
        })
        return count === 1 ? order.id : null // only the call that flipped it publishes
      }
      if (event.event === 'payment.failed') {
        // Only flag it while still unpaid — a failed attempt followed by a successful retry must stay PAID
        await tx.order.updateMany({ where: { id: order.id, paymentStatus: 'UNPAID' }, data: { paymentStatus: 'FAILED' } })
      }
      return null
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.json({ ok: true, duplicate: true }) // already processed this event
      return
    }
    throw err // 5xx → Razorpay retries later
  }

  // Publish only after the transaction committed
  if (paidOrderId && payment) await publishPaymentSucceeded(paidOrderId, payment.id)
  res.json({ ok: true })
}
