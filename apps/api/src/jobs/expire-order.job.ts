import { prisma } from '@ecom/db'
import { env } from '../env.js'
import { orderExpiredEmail } from '../lib/emails.js'
import { HttpError } from '../lib/http.js'
import { notifyOnce } from '../lib/notifications.js'
import { cancelUnpaidOrder } from '../lib/orders.js'
import { ensureCaptured, markOrderPaid, razorpay } from '../lib/razorpay.js'
import { publishPaymentSucceeded } from '../queues/publishers.js'
import type { ExpireOrderData } from '../queues/queues.js'

const paymentsConfigured = () => Boolean(env.razorpay.keyId && env.razorpay.keySecret)

/**
 * `order.expire` (delayed by ORDER_PAYMENT_TIMEOUT_MINUTES) → cancel an order that was never
 * paid, so its reserved stock goes back on sale.
 *
 * Race to think about: the customer pays at minute 29:59, but the verify call and the webhook
 * haven't arrived yet. Cancelling now would cancel a PAID order. So before cancelling we ask
 * Razorpay directly whether a payment exists for this order and, if so, mark it paid instead.
 * And cancelUnpaidOrder itself is a conditional update, so if verify/webhook wins the race
 * a moment later, exactly one of "PAID" or "CANCELLED" happens, never both.
 */
export async function handleExpireOrder({ orderId }: ExpireOrderData) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return 'order-missing'
  if (order.status !== 'PENDING_PAYMENT') return 'already-settled'

  if (order.providerOrderId && paymentsConfigured()) {
    const { items } = await razorpay().orders.fetchPayments(order.providerOrderId)
    const payment = items.find((p) => p.status === 'captured' || p.status === 'authorized')
    if (payment) {
      await ensureCaptured(payment.id, order.totalCents, order.currency)
      const { changed } = await markOrderPaid(order.id, payment.id)
      if (changed) await publishPaymentSucceeded(order.id, payment.id)
      return 'recovered-payment'
    }
  }

  let cancelled
  try {
    cancelled = await cancelUnpaidOrder(order.id)
  } catch (err) {
    // Paid or cancelled between our read and the update — the conditional update refused.
    if (err instanceof HttpError && err.code === 'INVALID_STATUS') return 'already-settled'
    throw err
  }
  // If this email fails, the retry sees CANCELLED above and stops: we accept a missed
  // "expired" email rather than risk emailing someone who cancelled the order themselves.
  await notifyOnce(cancelled, 'ORDER_EXPIRED', orderExpiredEmail(cancelled))
  return 'cancelled'
}
