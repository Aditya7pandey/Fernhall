import type { NotificationKind, OrderDTO, OrderStatus, PaymentStatus } from './types.ts'

export const STORE_CURRENCY = 'INR'
export const STORE_LOCALE = 'en-IN'
export const CURRENCY_SYMBOL = '₹'
/** Free standard shipping at or above this subtotal (paise). Keep in sync with apps/api/src/lib/pricing.ts */
export const FREE_SHIPPING_THRESHOLD = 299900

/** Visual tone for status badges; each app maps tones to its own colours. */
export type StatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger'

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: StatusTone; description: string }> = {
  PENDING_PAYMENT: { label: 'Awaiting payment', tone: 'warning', description: 'Order placed — waiting for payment' },
  PAID: { label: 'Paid', tone: 'info', description: 'Payment received — preparing your order' },
  PROCESSING: { label: 'Processing', tone: 'info', description: 'Your order is being packed' },
  SHIPPED: { label: 'Shipped', tone: 'info', description: 'On its way to you' },
  DELIVERED: { label: 'Delivered', tone: 'success', description: 'Delivered' },
  CANCELLED: { label: 'Cancelled', tone: 'danger', description: 'This order was cancelled' },
  REFUNDED: { label: 'Refunded', tone: 'neutral', description: 'This order was refunded' },
}

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: StatusTone }> = {
  UNPAID: { label: 'Unpaid', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  REFUNDED: { label: 'Refunded', tone: 'neutral' },
}

/** Fulfilment steps shown as a progress tracker (cancelled/refunded are shown separately). */
export const ORDER_PROGRESS: OrderStatus[] = ['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED']

/** Notifications the background workers send (see apps/api/src/jobs). */
export const NOTIFICATION_KIND: Record<NotificationKind, { label: string; description: string }> = {
  ORDER_RECEIVED: { label: 'Order received', description: 'Items reserved — complete payment to confirm' },
  PAYMENT_CONFIRMED: { label: 'Payment confirmed', description: 'Receipt and order confirmation' },
  ORDER_EXPIRED: { label: 'Order expired', description: 'Not paid in time — items released' },
}

/**
 * True while a notification the workers should send for this order hasn't shown up yet,
 * so the UI can poll briefly instead of asking the user to refresh.
 */
export function awaitingNotification(order: Pick<OrderDTO, 'status' | 'paymentStatus' | 'updatedAt' | 'notifications'>) {
  if (Date.now() - new Date(order.updatedAt).getTime() > 2 * 60_000) return false // older orders: don't poll
  const sent = new Set(order.notifications.map((n) => n.kind))
  if (order.paymentStatus === 'PAID') return !sent.has('PAYMENT_CONFIRMED')
  if (order.status === 'PENDING_PAYMENT') return !sent.has('ORDER_RECEIVED')
  return false
}

export const formatOrderNumber = (n: number) => `#${String(n).padStart(5, '0')}`
