import { ApiError, formatOrderNumber, formatPrice } from '@ecom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, CreditCard, PackageCheck } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { AddressBlock, OrderItems, OrderStatusBadge, OrderTotals } from '../components/order/OrderParts'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card, Skeleton } from '../components/ui/misc'
import { api } from '../lib/api'
import { qk } from '../lib/query'
import { errorMessage } from '../lib/utils'
import { Steps } from './CheckoutPage'
import { NotFoundPage } from './NotFoundPage'

/**
 * Payment step for a placed order.
 *
 * The order already exists as PENDING_PAYMENT with its stock reserved. Online payment
 * is not built yet — the API answers 501 / PAYMENT_NOT_IMPLEMENTED — so this page shows
 * an intentional "coming soon" state instead of a payment form.
 */
export function PaymentPage() {
  const { orderId = '' } = useParams()
  const qc = useQueryClient()
  const order = useQuery({ queryKey: qk.order(orderId), queryFn: () => api.orders.get(orderId) })

  const awaitingPayment = order.data?.status === 'PENDING_PAYMENT'

  // TODO(payments): this is where the integration plugs in. `api.payments.start(orderId)`
  // should return the provider session (e.g. a client secret or redirect URL); render the
  // provider's payment UI with it, then confirm and refetch the order on success.
  const payment = useQuery({
    queryKey: ['payment', orderId],
    queryFn: () => api.payments.start(orderId),
    enabled: awaitingPayment,
    retry: false,
    staleTime: Infinity,
  })
  const notImplemented = payment.error instanceof ApiError && payment.error.code === 'PAYMENT_NOT_IMPLEMENTED'

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

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Order {formatOrderNumber(o.number)}</p>
          <h1 className="text-4xl font-bold sm:text-5xl">{awaitingPayment ? 'Complete your payment' : 'Your order'}</h1>
        </div>
        <Steps current={2} />
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
                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-sand">
                  <CreditCard className="size-7" strokeWidth={1.5} />
                </div>
                {payment.isLoading ? (
                  <Skeleton className="mx-auto mt-6 h-8 w-64" />
                ) : notImplemented ? (
                  <>
                    <h2 className="mt-6 text-3xl">Online payment is coming soon</h2>
                    <p className="mx-auto mt-3 max-w-md text-muted">
                      We're putting the finishing touches on secure checkout. Your order is saved as
                      <span className="font-medium text-ink"> awaiting payment</span>, and you'll be able to pay for it from your account as soon as payments go live.
                    </p>
                  </>
                ) : payment.isError ? (
                  <>
                    <h2 className="mt-6 text-3xl">We couldn't start payment</h2>
                    <p className="mx-auto mt-3 max-w-md text-muted">{errorMessage(payment.error)}</p>
                    <Button variant="outline" className="mt-6" onClick={() => payment.refetch()}>
                      Try again
                    </Button>
                  </>
                ) : (
                  // TODO(payments): render the provider's payment element here using `payment.data`.
                  <p className="mt-6 text-muted">Preparing secure payment…</p>
                )}
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <ButtonLink to={`/account/orders/${o.id}`}>View order</ButtonLink>
                  <ButtonLink to="/shop" variant="outline">
                    Continue shopping
                  </ButtonLink>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 text-sm">
                <p className="flex items-center gap-2 text-muted">
                  <Clock className="size-4" /> Changed your mind? You can cancel while it's awaiting payment.
                </p>
                <button
                  type="button"
                  onClick={() => cancel.mutate()}
                  disabled={cancel.isPending}
                  className="font-medium text-danger underline-offset-4 hover:underline disabled:opacity-50"
                >
                  {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
                </button>
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
