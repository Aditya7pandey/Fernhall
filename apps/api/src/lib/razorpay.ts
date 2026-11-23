import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@ecom/db'
import Razorpay from 'razorpay'
import { env } from '../env.js'
import { HttpError } from './http.js'

let client: Razorpay | null = null

/** Lazily-created Razorpay SDK client. Throws 503 until keys are configured in apps/api/.env. */
export function razorpay(): Razorpay {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw new HttpError(503, 'Payments are not configured yet', 'PAYMENTS_NOT_CONFIGURED')
  }
  client ??= new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret })
  return client
}

// ─── Signatures ─────────────────────────────────────────────────────────────
//
// Razorpay proves a message came from them by sending an HMAC-SHA256 of the message,
// keyed with a secret only Razorpay and our server know. We recompute it and compare.
// timingSafeEqual avoids leaking how many characters matched through response timing.

function hmacMatches(message: string, signature: string, secret: string) {
  const expected = createHmac('sha256', secret).update(message).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Checkout handler signature: HMAC(order_id + "|" + payment_id, key_secret) */
export function isValidCheckoutSignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string) {
  return hmacMatches(`${razorpayOrderId}|${razorpayPaymentId}`, signature, env.razorpay.keySecret)
}

/** Webhook signature: HMAC(raw request body, webhook_secret). Must use the RAW body — re-serialised JSON won't match. */
export function isValidWebhookSignature(rawBody: string, signature: string) {
  if (!env.razorpay.webhookSecret) return false
  return hmacMatches(rawBody, signature, env.razorpay.webhookSecret)
}

// ─── Marking an order paid (idempotent) ─────────────────────────────────────

/**
 * Moves an order to PAID. Safe to call any number of times, from any number of places
 * at once (the browser's /verify call and the webhook usually race each other).
 *
 * Idempotency technique: a CONDITIONAL UPDATE. The WHERE clause only matches an order
 * that is still unpaid, so the database lets exactly one caller win; everyone else
 * updates 0 rows and simply reads the current state. No locks, no "check then write"
 * race (two requests can't both see UNPAID and both write).
 *
 * Returns { changed: true } only for the caller that actually made the transition —
 * that's where you'd put one-time side effects like sending the confirmation email.
 */
export async function markOrderPaid(orderId: string, razorpayPaymentId: string) {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: 'PENDING_PAYMENT', paymentStatus: { in: ['UNPAID', 'FAILED'] } },
    data: {
      status: 'PAID',
      paymentStatus: 'PAID',
      paymentProvider: 'razorpay',
      paymentRef: razorpayPaymentId,
      paidAt: new Date(),
    },
  })
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
  // Side effects (confirmation email…) are NOT done here: the caller publishes `payment.succeeded`
  // to the queue when `changed` is true (see queues/publishers.ts).
  return { changed: count === 1, order }
}

/**
 * Makes sure the money is actually captured (not just authorised) before we mark the order paid.
 * Most accounts auto-capture, in which case this is a no-op. Capturing is naturally idempotent on
 * Razorpay's side — a second capture fails with "already captured", which we treat as success.
 */
export async function ensureCaptured(paymentId: string, expectedAmount: number, currency: string) {
  const payment = await razorpay().payments.fetch(paymentId)
  if (Number(payment.amount) !== expectedAmount || payment.currency !== currency) {
    throw new HttpError(400, 'Payment amount does not match the order', 'PAYMENT_MISMATCH')
  }
  if (payment.status === 'captured') return payment
  if (payment.status === 'authorized') {
    try {
      return await razorpay().payments.capture(paymentId, expectedAmount, currency)
    } catch (err) {
      const msg = (err as { error?: { description?: string } }).error?.description ?? ''
      if (/already been captured/i.test(msg)) return payment
      throw err
    }
  }
  throw new HttpError(402, `Payment is ${payment.status}`, 'PAYMENT_NOT_CAPTURED')
}
