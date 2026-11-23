import {
  formatDateTime,
  formatOrderNumber,
  formatPrice,
  awaitingNotification,
  NOTIFICATION_KIND,
  ORDER_STATUS,
  type AdminOrderDTO,
  type OrderStatus,
} from '@ecom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, Bell, Check, IndianRupee, Copy, Mail, MapPin, PackageCheck, ShoppingBag, Truck } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/dialog'
import { Avatar, Card, CardHeader, ErrorState, OrderStatusBadge, PageHeader, PaymentStatusBadge, Skeleton, Thumb } from '../components/ui/misc'
import { api } from '../lib/api'
import { cn, errorMessage } from '../lib/utils'

const ACTIONS: Partial<Record<OrderStatus, { label: string; icon: ReactNode; description: string; danger?: boolean }>> = {
  PROCESSING: { label: 'Start processing', icon: <PackageCheck />, description: 'Mark this order as being packed.' },
  SHIPPED: { label: 'Mark as shipped', icon: <Truck />, description: 'The customer will see the order as on its way.' },
  DELIVERED: { label: 'Mark as delivered', icon: <Check />, description: 'Confirm the order has reached the customer.' },
  CANCELLED: {
    label: 'Cancel order',
    icon: <Ban />,
    description: 'Reserved stock and coupon usage will be returned. This cannot be undone.',
    danger: true,
  },
}

export default function OrderDetailPage() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const order = useQuery({
    queryKey: ['admin', 'order', id],
    queryFn: () => api.admin.orders.get(id),
    // The queue worker sends notifications a moment after the order changes — poll until they land
    refetchInterval: (q) => (q.state.data && awaitingNotification(q.state.data) ? 2000 : false),
  })
  const [pending, setPending] = useState<OrderStatus | null>(null)

  const setStatus = useMutation({
    mutationFn: (status: OrderStatus) => api.admin.orders.setStatus(id, status),
    onSuccess: (updated) => {
      qc.setQueryData(['admin', 'order', id], updated)
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] })
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] })
      qc.invalidateQueries({ queryKey: ['admin', 'products'] })
      toast.success(`Order ${formatOrderNumber(updated.number)} is now ${ORDER_STATUS[updated.status].label.toLowerCase()}`)
      setPending(null)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const back = (
    <Link to="/orders" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-fg">
      <ArrowLeft className="size-4" /> Orders
    </Link>
  )

  if (order.isError) {
    return (
      <>
        <PageHeader title="Order" back={back} />
        <Card>
          <ErrorState message={errorMessage(order.error)} onRetry={() => order.refetch()} />
        </Card>
      </>
    )
  }

  if (!order.data) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-7 w-48" />} back={back} />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </>
    )
  }

  const o = order.data
  const action = pending ? ACTIONS[pending] : null

  return (
    <>
      <PageHeader
        back={back}
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{formatOrderNumber(o.number)}</span>
            <OrderStatusBadge status={o.status} />
            <PaymentStatusBadge status={o.paymentStatus} />
          </span>
        }
        description={`Placed ${formatDateTime(o.createdAt)} · ${o.items.reduce((n, i) => n + i.quantity, 0)} items`}
        actions={o.allowedTransitions.map((s) => {
          const a = ACTIONS[s]
          if (!a) return null
          return (
            <Button key={s} variant={a.danger ? 'secondary' : 'primary'} icon={a.icon} onClick={() => setPending(s)} className={cn(a.danger && 'text-danger')}>
              {a.label}
            </Button>
          )
        })}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Items" />
            <ul className="divide-y divide-border">
              {o.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-3.5">
                  <Thumb src={item.imageUrl} alt={item.name} size={48} />
                  <div className="min-w-0 flex-1">
                    {item.productId ? (
                      <Link to={`/products/${item.productId}`} className="truncate text-[13px] font-medium hover:text-accent">
                        {item.name}
                      </Link>
                    ) : (
                      <p className="truncate text-[13px] font-medium">{item.name}</p>
                    )}
                    <p className="tabular text-xs text-muted">
                      {formatPrice(item.priceCents)} × {item.quantity}
                    </p>
                  </div>
                  <p className="tabular text-[13px] font-medium">{formatPrice(item.priceCents * item.quantity)}</p>
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t border-border bg-surface-2/50 px-5 py-4 text-[13px]">
              <Row label="Subtotal" value={formatPrice(o.subtotalCents)} />
              {o.discountCents > 0 && (
                <Row
                  label={
                    <>
                      Discount{' '}
                      {o.couponCode && <span className="ml-1 rounded bg-accent-soft px-1.5 py-0.5 font-mono text-[11px] text-accent-soft-fg">{o.couponCode}</span>}
                    </>
                  }
                  value={`−${formatPrice(o.discountCents)}`}
                  className="text-success-soft-fg"
                />
              )}
              <Row label={`Shipping · ${o.shippingMethod === 'express' ? 'Express' : 'Standard'}`} value={o.shippingCents ? formatPrice(o.shippingCents) : 'Free'} />
              <Row label="Includes GST" value={formatPrice(o.taxCents)} />
              <div className="flex justify-between border-t border-border pt-2.5 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular">{formatPrice(o.totalCents)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Payment" />
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-surface-3 text-muted">
                  <IndianRupee className="size-[18px]" />
                </span>
                <div>
                  <p className="text-[13px] font-medium">
                    {formatPrice(o.totalCents)} · <PaymentStatusBadge status={o.paymentStatus} />
                  </p>
                  <p className="text-xs text-muted">
                    {o.paymentProvider ? `via ${o.paymentProvider}` : 'No payment recorded yet'}
                  </p>
                  {(o.providerOrderId || o.paymentRef) && (
                    <p className="mt-0.5 font-mono text-[11px] text-subtle">
                      {o.providerOrderId}
                      {o.paymentRef && o.paymentRef !== o.providerOrderId ? ` · ${o.paymentRef}` : ''}
                    </p>
                  )}
                </div>
              </div>
              {/* TODO(refunds): Razorpay refunds API — also allow cancelling PAID orders in ADMIN_TRANSITIONS once built. */}
              <p className="rounded-md border border-dashed border-border px-2.5 py-1 text-xs text-subtle">Refunds — not built yet</p>
            </div>
          </Card>

          <Timeline o={o} />
          <Notifications o={o} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Customer" />
            <div className="space-y-4 px-5 py-4">
              <Link to={`/customers/${o.user.id}`} className="group flex items-center gap-3">
                <Avatar name={o.user.name} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium group-hover:text-accent">{o.user.name}</p>
                  <p className="text-xs text-muted">View profile</p>
                </div>
              </Link>
              <InfoLine icon={<Mail />}>
                <span className="truncate">{o.email}</span>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(o.email)
                    toast.success('Email copied')
                  }}
                  className="ml-auto cursor-pointer text-subtle hover:text-fg"
                  aria-label="Copy email"
                >
                  <Copy className="size-3.5" />
                </button>
              </InfoLine>
            </div>
          </Card>

          <Card>
            <CardHeader title="Shipping address" />
            <div className="px-5 py-4">
              <InfoLine icon={<MapPin />}>
                <address className="text-[13px] leading-relaxed not-italic">
                  <span className="font-medium">{o.shippingAddress.fullName}</span>
                  <br />
                  {o.shippingAddress.line1}
                  {o.shippingAddress.line2 && (
                    <>
                      <br />
                      {o.shippingAddress.line2}
                    </>
                  )}
                  <br />
                  {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.postalCode}
                  <br />
                  {o.shippingAddress.country}
                  {o.shippingAddress.phone && (
                    <>
                      <br />
                      <span className="text-muted">{o.shippingAddress.phone}</span>
                    </>
                  )}
                </address>
              </InfoLine>
            </div>
          </Card>

          {o.allowedTransitions.length === 0 && (
            <p className="px-1 text-xs text-muted">
              No further actions — this order is {ORDER_STATUS[o.status].label.toLowerCase()}.
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={() => pending && setStatus.mutate(pending)}
        title={action ? `${action.label}?` : ''}
        description={action?.description}
        confirmLabel={action?.label ?? 'Confirm'}
        danger={action?.danger}
        loading={setStatus.isPending}
      />
    </>
  )
}

function Row({ label, value, className }: { label: ReactNode; value: string; className?: string }) {
  return (
    <div className={cn('flex justify-between text-muted', className)}>
      <span>{label}</span>
      <span className="tabular text-fg">{value}</span>
    </div>
  )
}

function InfoLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-[13px]">
      <span className="mt-0.5 text-subtle [&_svg]:size-4">{icon}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  )
}

function Timeline({ o }: { o: AdminOrderDTO }) {
  const steps: { label: string; at: string | null; icon: ReactNode; tone?: 'danger' }[] = [
    { label: 'Order placed', at: o.createdAt, icon: <ShoppingBag /> },
    { label: 'Payment received', at: o.paidAt, icon: <IndianRupee /> },
    { label: 'Shipped', at: o.shippedAt, icon: <Truck /> },
    { label: 'Delivered', at: o.deliveredAt, icon: <Check /> },
  ]
  if (o.cancelledAt) steps.push({ label: 'Cancelled', at: o.cancelledAt, icon: <Ban />, tone: 'danger' })
  if (o.status === 'PROCESSING' && !o.shippedAt) {
    steps.splice(2, 0, { label: 'Processing', at: o.updatedAt, icon: <PackageCheck /> })
  }

  return (
    <Card>
      <CardHeader title="Timeline" />
      <ol className="px-5 py-4">
        {steps.map((s, i) => {
          const done = !!s.at
          return (
            <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
              {i < steps.length - 1 && (
                <span className={cn('absolute top-7 bottom-0 left-[13px] w-px', done ? 'bg-accent/40' : 'bg-border')} />
              )}
              <span
                className={cn(
                  'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border [&_svg]:size-3.5',
                  s.tone === 'danger' && done
                    ? 'border-danger/30 bg-danger-soft text-danger-soft-fg'
                    : done
                      ? 'border-accent/30 bg-accent-soft text-accent-soft-fg'
                      : 'border-border bg-surface text-subtle',
                )}
              >
                {s.icon}
              </span>
              <div className="pt-1">
                <p className={cn('text-[13px] font-medium', !done && 'text-subtle')}>{s.label}</p>
                <p className="text-xs text-muted">{s.at ? formatDateTime(s.at) : 'Pending'}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

/** Emails the background workers sent for this order (OrderNotification rows). */
function Notifications({ o }: { o: AdminOrderDTO }) {
  return (
    <Card>
      <CardHeader title="Notifications" />
      {o.notifications.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-muted">
          {awaitingNotification(o) ? 'Queued — the worker is sending it…' : 'No notifications sent for this order.'}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {o.notifications.map((n) => (
            <li key={n.id} className="flex items-start gap-3 px-5 py-3">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent-soft text-accent-soft-fg [&_svg]:size-3.5">
                <Bell />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{NOTIFICATION_KIND[n.kind].label}</p>
                <p className="truncate text-xs text-muted">
                  {n.channel} to {n.recipient}
                </p>
              </div>
              <p className="shrink-0 text-xs text-muted">{formatDateTime(n.sentAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
