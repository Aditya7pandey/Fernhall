import type { Order, OrderItem } from '@ecom/db'

type OrderWithItems = Order & { items: OrderItem[] }

const rupees = (paise: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(paise / 100)
const orderNo = (n: number) => `#${String(n).padStart(5, '0')}`
const itemLines = (o: OrderWithItems) =>
  o.items.map((i) => `  • ${i.name} × ${i.quantity} — ${rupees(i.priceCents * i.quantity, o.currency)}`).join('\n')

export function orderReceivedEmail(o: OrderWithItems, paymentWindowMinutes: number) {
  return {
    subject: `We've reserved your items — order ${orderNo(o.number)}`,
    text: [
      `Thanks for your order ${orderNo(o.number)}!`,
      '',
      itemLines(o),
      '',
      `Total: ${rupees(o.totalCents, o.currency)}`,
      '',
      `Your items are reserved for ${paymentWindowMinutes} minutes. Complete the payment to confirm the order.`,
    ].join('\n'),
  }
}

export function paymentConfirmedEmail(o: OrderWithItems) {
  return {
    subject: `Payment received — order ${orderNo(o.number)} is confirmed`,
    text: [
      `We've received ${rupees(o.totalCents, o.currency)} for order ${orderNo(o.number)}.`,
      `Payment reference: ${o.paymentRef ?? '—'}`,
      '',
      itemLines(o),
      '',
      `We're getting it ready and will let you know when it ships.`,
    ].join('\n'),
  }
}

export function orderExpiredEmail(o: OrderWithItems) {
  return {
    subject: `Order ${orderNo(o.number)} was cancelled`,
    text: [
      `We didn't receive payment for order ${orderNo(o.number)} in time, so it has been cancelled`,
      `and the items were released back to the shop. No money was taken.`,
      '',
      `You can place a new order any time.`,
    ].join('\n'),
  }
}
