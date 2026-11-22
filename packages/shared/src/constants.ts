import type { OrderStatus, PaymentStatus } from './types.ts'

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

export const formatOrderNumber = (n: number) => `#${String(n).padStart(5, '0')}`
