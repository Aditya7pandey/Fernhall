import { prisma } from '@ecom/db'
import { env } from '../env.js'
import { orderReceivedEmail } from '../lib/emails.js'
import { notifyOnce } from '../lib/notifications.js'
import type { OrderPlacedData } from '../queues/queues.js'

/** `order.placed` → "we've reserved your items" email. Safe to run more than once. */
export async function handleOrderPlaced({ orderId }: OrderPlacedData) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
  if (!order) return 'order-missing'
  // Paid (or cancelled) before the worker got to it → this email would be misleading.
  if (order.status !== 'PENDING_PAYMENT') return 'skipped-not-pending'
  return notifyOnce(order, 'ORDER_RECEIVED', orderReceivedEmail(order, env.orderPaymentTimeoutMinutes))
}
