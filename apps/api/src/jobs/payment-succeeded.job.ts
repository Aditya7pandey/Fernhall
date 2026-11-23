import { prisma } from '@ecom/db'
import { UnrecoverableError } from 'bullmq'
import { paymentConfirmedEmail } from '../lib/emails.js'
import { notifyOnce } from '../lib/notifications.js'
import { getOrdersQueue, jobIds, type PaymentSucceededData } from '../queues/queues.js'

/** `payment.succeeded` → confirmation email, and the order's expiry job is no longer needed. */
export async function handlePaymentSucceeded({ orderId }: PaymentSucceededData) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
  // Retrying can't fix these, so fail the job permanently instead of burning 5 attempts.
  if (!order) throw new UnrecoverableError(`Order ${orderId} not found`)
  if (order.paymentStatus !== 'PAID') throw new UnrecoverableError(`Order ${orderId} is not paid (${order.paymentStatus})`)

  const result = await notifyOnce(order, 'PAYMENT_CONFIRMED', paymentConfirmedEmail(order))

  // Tidy-up only: the expiry job re-checks the order and would do nothing for a paid order.
  // remove() returns 0 (doesn't throw) if the job is gone or currently running.
  await getOrdersQueue()
    .remove(jobIds.expireOrder(orderId))
    .catch(() => 0)

  return result
}
