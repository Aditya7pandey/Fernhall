import { ApiError, awaitingNotification, formatOrderNumber, formatPrice, type OrderDTO } from '@ecom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock, CreditCard, Loader2, Lock, PackageCheck, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { AddressBlock, OrderItems, OrderNotifications, OrderStatusBadge, OrderTotals } from '../components/order/OrderParts'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card, Skeleton } from '../components/ui/misc'
import { useIdempotencyKey } from '../hooks/useIdempotencyKey'
import { api } from '../lib/api'
import { qk } from '../lib/query'
import { openRazorpay, type RazorpaySuccess } from '../lib/razorpay'
import { errorMessage } from '../lib/utils'
import { Steps } from './CheckoutPage'
import { NotFoundPage } from './NotFoundPage'

type Phase = 'idle' | 'opening' | 'in-checkout' | 'verifying'

/**
 * Payment step for a placed order (status PENDING_PAYMENT, stock reserved).
 *
 *  Pay → api.payments.start (Idempotency-Key) → Razorpay Checkout → api.payments.verify
 *
 * If the customer closes the tab after paying, the Razorpay webhook still marks the order
 * paid server-side, so nothing here is the only path to "paid".
 */
export function PaymentPage() {
  const { orderId = '' } = useParams()
  const qc = useQueryClient()
  const order = useQuery({
    queryKey: qk.order(orderId),
    queryFn: () => api.orders.get(orderId),
    // After paying, the confirmation email is sent by a queue worker — poll until it appears
    refetchInterval: (q) => (q.state.data && awaitingNotification(q.state.data) ? 2000 : false),
  })
  const [phase, setPhase] = useState<Phase>('idle')
  const [failure, setFailure] = useState<string | null>(null)

  // "Pay for this order" is one intent → one key, reused if the customer clicks Pay again.
  // The server replays the same Razorpay order instead of creating a new one each time.
  const payKey = useIdempotencyKey([orderId])

  const awaitingPayment = order.data?.status === 'PENDING_PAYMENT'

  const onPaid = (updated: Pick<OrderDTO, 'status' | 'paymentStatus'>) => {
    qc.setQueryData<OrderDTO>(qk.order(orderId), (prev) => (prev ? { ...prev, ...updated } : prev))
    qc.invalidateQueries({ queryKey: qk.order(orderId) })
    qc.invalidateQueries({ queryKey: ['orders'] })
    qc.invalidateQueries({ queryKey: qk.notifications })
    toast.success('Payment successful — thank you!')
  }

  const verify = useMutation({
    mutationFn: (r: RazorpaySuccess) => api.payments.verify({ orderId, ...r }),
    onSuccess: onPaid,
    onError: (err) => {
      // The payment may still have gone through — the webhook will confirm it. Refetch to see.
      toast.error(`We couldn't confirm your payment yet: ${errorMessage(err)}`)
      qc.invalidateQueries({ queryKey: qk.order(orderId) })
    },
    onSettled: () => setPhase('idle'),
  })

  const pay = useMutation({
    mutationFn: () => api.payments.start(orderId, payKey),
    onMutate: () => {
      setFailure(null)
      setPhase('opening')
    },
    onSuccess: async (session) => {
      try {
        await openRazorpay(
          {
            key: session.keyId,
            amount: session.amount,
            currency: session.currency,
            order_id: session.razorpayOrderId,
            name: 'Fernhall',
            description: `Order ${formatOrderNumber(session.orderNumber)}`,
            prefill: session.prefill,
            notes: { orderId: session.orderId },
            theme: { color: '#6c2bff' },
            handler: (response) => {
              setPhase('verifying')
              verify.mutate(response)
            },
            modal: {
              ondismiss: () => {
                setPhase((p) => (p === 'verifying' ? p : 'idle'))
              },
            },
          },
          (r) => setFailure(r.error.description || 'Payment failed. Please try again.'),
        )
        setPhase('in-checkout')
      } catch (err) {
        setPhase('idle')
        toast.error(errorMessage(err))
      }
    },
    onError: (err) => {
      setPhase('idle')
      if (err instanceof ApiError && err.status === 409) qc.invalidateQueries({ queryKey: qk.order(orderId) })
      else if (!(err instanceof ApiError && err.code === 'PAYMENTS_NOT_CONFIGURED')) toast.error(errorMessage(err)) // shown inline instead
    },
  })

  const notConfigured = pay.error instanceof ApiError && pay.error.code === 'PAYMENTS_NOT_CONFIGURED'

  const cancel = useMutation({
    mutationFn: () => api.orders.cancel(orderId),
    onSuccess: (updated) => {
      qc.setQueryData(qk.order(orderId), updated)
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Order cancelled')
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  if (order.isLoading) {
    return (
      <div className="container-page py-14">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="mt-10 h-96" />
      </div>
    )
  }
  if (!order.data) return <NotFoundPage title="Order not found" />
  const o = order.data
  const paid = o.paymentStatus === 'PAID'
  const busy = phase !== 'idle' || pay.isPending

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Order {formatOrderNumber(o.number)}</p>
          <h1 className="text-4xl font-bold sm:text-5xl">{awaitingPayment ? 'Complete your payment' : paid ? 'Order confirmed' : 'Your order'}</h1>
        </div>
        <Steps current={paid ? 3 : 2} />
      </div>

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="space-y-6 lg:col-span-7">
          {awaitingPayment ? (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line bg-success-soft/60 px-6 py-4 text-sm text-success">
                <PackageCheck className="size-5 shrink-0" />
                <p>
                  <span className="font-medium">Order placed — your items are reserved.</span> Pay {formatPrice(o.totalCents)} to confirm it.
                </p>
              </div>
              <div className="px-6 py-10 text-center sm:px-12">
                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-accent-soft text-accent">
                  {phase === 'verifying' ? <Loader2 className="size-7 animate-spin" /> : <CreditCard className="size-7" strokeWidth={1.75} />}
                </div>

                {phase === 'verifying' ? (
                  <>
                    <h2 className="mt-6 text-3xl">Confirming your payment…</h2>
                    <p className="mx-auto mt-3 max-w-md text-muted">This only takes a moment. Please don't close this page.</p>
                  </>
                ) : notConfigured ? (
                  <>
                    <h2 className="mt-6 text-3xl">Payments aren't set up yet</h2>
                    <p className="mx-auto mt-3 max-w-md text-muted">
                      Add your Razorpay test keys to <code className="rounded bg-sand px-1.5 py-0.5 text-sm">apps/api/.env</code> and try again.
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="mt-6 text-3xl">Pay securely with Razorpay</h2>
                    <p className="mx-auto mt-3 max-w-md text-muted">UPI, cards, netbanking and wallets. You'll confirm the payment in a secure Razorpay window.</p>
                  </>
                )}

                {failure && (
                  <p role="alert" className="mx-auto mt-5 max-w-md rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                    {failure} — no money was taken for this attempt. You can try again.
                  </p>
                )}

                <div className="mt-8 flex flex-col items-center gap-3">
                  <Button size="lg" className="min-w-64" onClick={() => pay.mutate()} disabled={busy} loading={phase === 'opening'}>
                    <Lock className="size-4" />
                    {failure ? 'Try again' : `Pay ${formatPrice(o.totalCents)}`}
                  </Button>
                  <p className="flex items-center gap-1.5 text-xs text-muted">
                    <ShieldCheck className="size-3.5" /> Payments are processed by Razorpay. We never see your card details.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 text-sm">
                <p className="flex items-center gap-2 text-muted">
                  <Clock className="size-4" /> Changed your mind? You can cancel while it's awaiting payment.
                </p>
                <button
                  type="button"
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending || busy}
                  className="font-medium text-danger underline-offset-4 hover:underline disabled:opacity-50"
                >
                  {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
                </button>
              </div>
            </Card>
          ) : paid ? (
            <Card className="p-8 text-center sm:p-10">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-success-soft text-success">
                <CheckCircle2 className="size-8" />
              </div>
              <h2 className="mt-5 text-3xl">Payment received</h2>
              <p className="mx-auto mt-2 max-w-md text-muted">
                Thanks{o.shippingAddress.fullName ? `, ${o.shippingAddress.fullName.split(' ')[0]}` : ''}! We've got your order and we're getting it ready.
              </p>
              <div className="mx-auto mt-6 max-w-sm text-left">
                <OrderNotifications order={o} />
              </div>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <ButtonLink to={`/account/orders/${o.id}`}>Track order</ButtonLink>
                <ButtonLink to="/shop" variant="outline">
                  Keep shopping
                </ButtonLink>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <OrderStatusBadge status={o.status} />
              <h2 className="mt-4 text-3xl">{o.status === 'CANCELLED' ? 'This order was cancelled' : 'Nothing to pay here'}</h2>
              <p className="mt-2 text-muted">
                {o.status === 'CANCELLED' ? 'Reserved items have been released back to the shop.' : 'This order has already been paid.'}
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <ButtonLink to={`/account/orders/${o.id}`} variant="outline">
                  View order
                </ButtonLink>
                <ButtonLink to="/shop">Continue shopping</ButtonLink>
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="mb-3 font-sans text-base font-medium tracking-normal">Shipping to</h2>
            <AddressBlock address={o.shippingAddress} />
          </Card>
        </div>

        <Card className="p-6 lg:sticky lg:top-28 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl">Summary</h2>
            <Link to={`/account/orders/${o.id}`} className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline">
              {formatOrderNumber(o.number)}
            </Link>
          </div>
          <div className="mt-2">
            <OrderItems order={o} />
          </div>
          {o.couponCode && <p className="mt-2 text-xs text-muted">Promo code {o.couponCode} applied</p>}
          <div className="mt-4 border-t border-line pt-5">
            <OrderTotals order={o} />
          </div>
        </Card>
      </div>
    </div>
  )
}
