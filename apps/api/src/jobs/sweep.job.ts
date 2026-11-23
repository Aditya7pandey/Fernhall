import { prisma } from '@ecom/db'
import { env } from '../env.js'
import { handleExpireOrder } from './expire-order.job.js'
import { handlePaymentSucceeded } from './payment-succeeded.job.js'

const GRACE_MS = 5 * 60_000
const BATCH = 100

/**
 * `orders.sweep` — a repeatable job (every 10 minutes, see workers/index.ts).
 *
 * The safety net for "the DB committed but publishing to Redis failed" (see queues/publishers.ts).
 * It looks at the DATABASE — the source of truth — and does the work directly:
 *   • unpaid orders past their payment window   → expire them
 *   • paid orders with no confirmation email     → send it
 * Both handlers are idempotent, so overlapping with the normal jobs is harmless.
 */
export async function handleSweep() {
  const now = Date.now()
  const stale = await prisma.order.findMany({
    where: {
      status: 'PENDING_PAYMENT',
      createdAt: { lt: new Date(now - env.orderPaymentTimeoutMinutes * 60_000 - GRACE_MS) },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
  })
  const unconfirmed = await prisma.order.findMany({
    where: {
      paymentStatus: 'PAID',
      // Only recent ones: older paid orders predate the queue (e.g. seed data).
      paidAt: { lt: new Date(now - GRACE_MS), gt: new Date(now - 24 * 3600_000) },
      notifications: { none: { kind: 'PAYMENT_CONFIRMED' } },
    },
    select: { id: true, paymentRef: true },
    take: BATCH,
  })

  let failed = 0
  for (const { id } of stale) {
    await handleExpireOrder({ orderId: id }).catch((err) => {
      failed++
      console.error(`[sweep] expiring order ${id} failed:`, err)
    })
  }
  for (const { id, paymentRef } of unconfirmed) {
    await handlePaymentSucceeded({ orderId: id, paymentId: paymentRef ?? '' }).catch((err) => {
      failed++
      console.error(`[sweep] confirming order ${id} failed:`, err)
    })
  }
  return { expired: stale.length, confirmed: unconfirmed.length, failed }
}
