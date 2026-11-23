import { prisma, type OrderStatus, type Prisma } from '@ecom/db'
import { badRequest } from './http.js'

export const orderInclude = {
  items: true,
  user: { select: { id: true, name: true, email: true } },
  // Written by the queue workers (jobs/*) — shown as a timeline on the order pages
  notifications: {
    select: { id: true, kind: true, channel: true, recipient: true, sentAt: true, readAt: true },
    orderBy: { sentAt: 'asc' },
  },
} as const satisfies Prisma.OrderInclude

/**
 * Fulfilment transitions an admin may make.
 *
 * PAID and REFUNDED are intentionally absent: those states are owned by the payment
 * integration (see routes/payments.ts). Cancelling an order that has already been paid
 * also needs a refund, so it's not allowed here until payments are implemented.
 */
export const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PROCESSING'],
  PROCESSING: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
}

/**
 * Cancels an unpaid order and returns its reserved stock (and coupon use).
 *
 * The status change is a CONDITIONAL UPDATE (WHERE status = PENDING_PAYMENT AND not paid).
 * The expiry job, the customer's Cancel button and a late payment can all race for the same
 * order; Postgres row-locks the UPDATE, so exactly one of "PAID" / "CANCELLED" wins and the
 * loser updates 0 rows. A plain read-check-then-update would let both through.
 */
export async function cancelUnpaidOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: 'PENDING_PAYMENT', paymentStatus: { not: 'PAID' } },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })
    if (count === 0) {
      throw badRequest('Only orders awaiting payment can be cancelled', 'INVALID_STATUS')
    }
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
    for (const item of order.items) {
      if (item.productId) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } })
      }
    }
    if (order.couponCode) {
      await tx.coupon.updateMany({
        where: { code: order.couponCode, usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      })
    }
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude })
  })
}
