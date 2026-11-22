import {
  formatDate,
  formatPrice,
  ORDER_PROGRESS,
  ORDER_STATUS,
  type OrderDTO,
  type OrderStatus,
  type ShippingAddress,
} from '@ecom/shared'
import { Check } from 'lucide-react'
import { Link } from 'react-router'
import { cn, imageUrl } from '../../lib/utils'
import { TotalsList } from '../cart/CartParts'
import { Badge } from '../ui/misc'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function AddressBlock({ address, className }: { address: ShippingAddress; className?: string }) {
  return (
    <address className={cn('text-sm leading-relaxed text-ink-2 not-italic', className)}>
      <span className="font-medium text-ink">{address.fullName}</span>
      <br />
      {address.line1}
      {address.line2 && (
        <>
          <br />
          {address.line2}
        </>
      )}
      <br />
      {address.city}, {address.state} {address.postalCode}
      <br />
      {address.country}
      {address.phone && (
        <>
          <br />
          {address.phone}
        </>
      )}
    </address>
  )
}

export function OrderItems({ order }: { order: OrderDTO }) {
  return (
    <ul className="divide-y divide-line">
      {order.items.map((item) => (
        <li key={item.id} className="flex items-center gap-4 py-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-sand">
            {item.imageUrl && <img src={imageUrl(item.imageUrl, 160)} alt="" className="size-full object-cover" />}
            <span className="absolute -top-0 -right-0 grid size-5 place-items-center rounded-bl-lg bg-ink text-[10px] font-semibold text-canvas">
              {item.quantity}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{item.name}</p>
            <p className="text-sm text-muted tabular-nums">
              {item.quantity} × {formatPrice(item.priceCents)}
            </p>
          </div>
          <p className="text-sm font-medium tabular-nums">{formatPrice(item.priceCents * item.quantity)}</p>
        </li>
      ))}
    </ul>
  )
}

export function OrderTotals({ order }: { order: OrderDTO }) {
  return (
    <TotalsList
      totals={order}
      shippingLabel={`Shipping (${order.shippingMethod === 'express' ? 'Express' : 'Standard'})`}
    />
  )
}

/** Step tracker: Placed → Paid → Processing → Shipped → Delivered */
export function OrderTracker({ order }: { order: OrderDTO }) {
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    return (
      <div className="rounded-2xl bg-danger-soft px-5 py-4 text-sm text-danger">
        <p className="font-medium">{ORDER_STATUS[order.status].label}</p>
        <p className="mt-0.5 opacity-80">
          {ORDER_STATUS[order.status].description}
          {order.cancelledAt && ` on ${formatDate(order.cancelledAt)}`}.
        </p>
      </div>
    )
  }
  const current = ORDER_PROGRESS.indexOf(order.status)
  const labels: Record<string, string> = {
    PENDING_PAYMENT: 'Placed',
    PAID: 'Paid',
    PROCESSING: 'Processing',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
  }
  const dates: Record<string, string | null> = {
    PENDING_PAYMENT: order.createdAt,
    PAID: order.paidAt,
    PROCESSING: null,
    SHIPPED: order.shippedAt,
    DELIVERED: order.deliveredAt,
  }

  return (
    <ol className="grid grid-cols-5" aria-label="Order progress">
      {ORDER_PROGRESS.map((step, i) => {
        const done = i <= current
        return (
          <li key={step} className="relative flex flex-col items-center text-center" aria-current={i === current ? 'step' : undefined}>
            {i > 0 && (
              <span
                className={cn('absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2', i <= current ? 'bg-ink' : 'bg-sand-2')}
                aria-hidden
              />
            )}
            <span
              className={cn(
                'relative z-10 grid size-8 place-items-center rounded-full border-2 text-xs font-medium transition',
                done ? 'border-ink bg-ink text-canvas' : 'border-sand-2 bg-surface text-muted',
                i === current && 'ring-4 ring-ink/10',
              )}
            >
              {done ? <Check className="size-4" strokeWidth={2.5} /> : i + 1}
            </span>
            <span className={cn('mt-2 text-xs font-medium sm:text-sm', !done && 'text-muted')}>{labels[step]}</span>
            {dates[step] && done && <span className="hidden text-xs text-muted sm:block">{formatDate(dates[step]!, { month: 'short', day: 'numeric' })}</span>}
          </li>
        )
      })}
    </ol>
  )
}

export function OrderRow({ order }: { order: OrderDTO }) {
  return (
    <Link
      to={`/account/orders/${order.id}`}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 transition hover:border-ink/30 hover:shadow-soft sm:flex-row sm:items-center"
    >
      <div className="flex -space-x-3">
        {order.items.slice(0, 3).map((item) => (
          <div key={item.id} className="size-14 overflow-hidden rounded-xl border-2 border-surface bg-sand">
            {item.imageUrl && <img src={imageUrl(item.imageUrl, 120)} alt="" className="size-full object-cover" />}
          </div>
        ))}
        {order.items.length > 3 && (
          <div className="grid size-14 place-items-center rounded-xl border-2 border-surface bg-sand text-xs font-medium">+{order.items.length - 3}</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">Order #{String(order.number).padStart(5, '0')}</p>
        <p className="text-sm text-muted">
          {formatDate(order.createdAt)} · {order.items.reduce((n, i) => n + i.quantity, 0)} items
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-1.5">
        <OrderStatusBadge status={order.status} />
        <p className="font-medium tabular-nums">{formatPrice(order.totalCents)}</p>
      </div>
    </Link>
  )
}
