import { formatPrice, type AddressInput, type ShippingMethodId } from '@ecom/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Check, Lock, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { CouponForm, TotalsList } from '../components/cart/CartParts'
import { AddressForm } from '../components/order/AddressForm'
import { Button } from '../components/ui/Button'
import { Card, Skeleton } from '../components/ui/misc'
import { useSession } from '../hooks/useSession'
import { api } from '../lib/api'
import { qk } from '../lib/query'
import { cn, errorMessage, fieldErrors, imageUrl } from '../lib/utils'

export function CheckoutPage() {
  const { user, isLoading: sessionLoading } = useSession()
  if (sessionLoading) return <CheckoutSkeleton />
  if (!user) return <Navigate to="/signin" state={{ from: '/checkout' }} replace />
  return <Checkout />
}

function Checkout() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [method, setMethod] = useState<ShippingMethodId>('standard')
  const [chosenAddress, setChosenAddress] = useState<string | null>(null)
  const [addingAddress, setAddingAddress] = useState(false)

  const addresses = useQuery({ queryKey: qk.addresses, queryFn: api.addresses.list })
  const methods = useQuery({ queryKey: qk.shippingMethods, queryFn: api.checkout.shippingMethods, staleTime: Infinity })
  const quote = useQuery({
    queryKey: qk.quote(method),
    queryFn: () => api.checkout.quote(method),
    placeholderData: keepPreviousData,
  })

  const addressId = chosenAddress ?? addresses.data?.find((a) => a.isDefault)?.id ?? addresses.data?.[0]?.id ?? null
  const showForm = addingAddress || (addresses.isSuccess && addresses.data.length === 0)

  const createAddress = useMutation({
    mutationFn: (input: AddressInput) => api.addresses.create(input),
    onSuccess: (address) => {
      qc.invalidateQueries({ queryKey: qk.addresses })
      setChosenAddress(address.id)
      setAddingAddress(false)
    },
  })

  const placeOrder = useMutation({
    mutationFn: () => api.orders.place({ addressId: addressId!, shippingMethod: method }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: qk.cart })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['product'] })
      navigate(`/checkout/payment/${order.id}`, { replace: true })
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const cart = quote.data
  if (quote.isLoading) return <CheckoutSkeleton />
  if (cart && cart.items.length === 0 && !placeOrder.isPending && !placeOrder.isSuccess) return <Navigate to="/cart" replace />
  const blocked = cart?.items.some((i) => !i.available)

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">Checkout</p>
          <h1 className="text-4xl font-bold sm:text-5xl">Almost yours</h1>
        </div>
        <Steps current={1} />
      </div>

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="space-y-6 lg:col-span-7">
          {/* Address */}
          <Section number={1} title="Shipping address">
            {addresses.isLoading ? (
              <Skeleton className="h-28" />
            ) : (
              <>
                {!showForm && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {addresses.data?.map((a) => (
                      <ChoiceCard key={a.id} selected={addressId === a.id} onSelect={() => setChosenAddress(a.id)} name="address">
                        <p className="font-medium">
                          {a.fullName} {a.isDefault && <span className="ml-1 text-xs font-normal text-muted">· Default</span>}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                          {a.line1}
                          {a.line2 && `, ${a.line2}`}
                          <br />
                          {a.city}, {a.state} {a.postalCode}
                          <br />
                          {a.country}
                        </p>
                      </ChoiceCard>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAddingAddress(true)}
                      className="flex min-h-28 items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/20 text-sm text-ink-2 transition hover:border-ink/50 hover:text-ink"
                    >
                      <Plus className="size-4" /> Add a new address
                    </button>
                  </div>
                )}
                {showForm && (
                  <AddressForm
                    onSubmit={(input) => createAddress.mutate(input)}
                    onCancel={addresses.data?.length ? () => setAddingAddress(false) : undefined}
                    submitting={createAddress.isPending}
                    errors={fieldErrors(createAddress.error)}
                    submitLabel="Use this address"
                  />
                )}
              </>
            )}
          </Section>

          {/* Delivery */}
          <Section number={2} title="Delivery method">
            <div className="grid gap-3 sm:grid-cols-2">
              {methods.data?.map((m) => {
                const free = m.freeOverCents != null && (cart?.totals.subtotalCents ?? 0) >= m.freeOverCents
                return (
                  <ChoiceCard key={m.id} selected={method === m.id} onSelect={() => setMethod(m.id)} name="shipping">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{m.label}</p>
                        <p className="mt-0.5 text-sm text-muted">{m.description}</p>
                      </div>
                      <p className={cn('text-sm font-medium tabular-nums', free && 'text-success')}>{free ? 'Free' : formatPrice(m.priceCents)}</p>
                    </div>
                  </ChoiceCard>
                )
              }) ?? <Skeleton className="h-20 sm:col-span-2" />}
            </div>
          </Section>

          {/* Payment (next step) */}
          <Section number={3} title="Payment" muted>
            <p className="text-sm text-muted">You'll complete payment on the next step, after your order is placed.</p>
          </Section>
        </div>

        {/* Summary */}
        <Card className="p-6 lg:sticky lg:top-28 lg:col-span-5">
          <h2 className="text-2xl">Order summary</h2>
          <ul className="mt-5 max-h-72 space-y-4 overflow-y-auto pr-1">
            {cart?.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-sand">
                  {item.product.images[0] && <img src={imageUrl(item.product.images[0], 160)} alt="" className="size-full object-cover" />}
                  <span className="absolute top-0 right-0 grid size-5 place-items-center rounded-bl-lg bg-ink text-[10px] font-semibold text-canvas">
                    {item.quantity}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.product.name}</p>
                  {!item.available && <p className="text-xs text-danger">Unavailable</p>}
                </div>
                <p className="text-sm tabular-nums">{formatPrice(item.lineTotalCents)}</p>
              </li>
            ))}
          </ul>
          <div className="my-6 border-t border-line pt-6">{cart && <CouponForm cart={cart} />}</div>
          {cart && <TotalsList totals={cart.totals} shippingLabel={`Shipping (${cart.shippingMethod.label})`} />}
          {blocked && (
            <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              Some items are unavailable. <Link to="/cart" className="underline">Update your bag</Link> to continue.
            </p>
          )}
          <Button
            size="lg"
            className="mt-6 w-full"
            disabled={!addressId || showForm || blocked || !cart}
            loading={placeOrder.isPending}
            onClick={() => placeOrder.mutate()}
          >
            Place order & continue to payment <ArrowRight className="size-4" />
          </Button>
          {!addressId && !addresses.isLoading && <p className="mt-3 text-center text-xs text-muted">Add a shipping address to continue.</p>}
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
            <Lock className="size-3.5" /> Your items are reserved once the order is placed
          </p>
        </Card>
      </div>
    </div>
  )
}

export function Steps({ current }: { current: 1 | 2 }) {
  const steps = ['Details', 'Payment', 'Done']
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Checkout progress">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          {i > 0 && <span className="h-px w-6 bg-line" aria-hidden />}
          <span
            className={cn(
              'grid size-6 place-items-center rounded-full text-xs font-medium',
              i + 1 < current ? 'bg-ink text-canvas' : i + 1 === current ? 'bg-ink text-canvas ring-4 ring-ink/10' : 'bg-sand text-muted',
            )}
          >
            {i + 1 < current ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className={cn(i + 1 > current && 'text-muted')} aria-current={i + 1 === current ? 'step' : undefined}>
            {s}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Section({ number, title, children, muted }: { number: number; title: string; children: ReactNode; muted?: boolean }) {
  return (
    <section className={cn('rounded-2xl border border-line bg-surface p-6', muted && 'bg-surface/50')}>
      <h2 className="mb-5 flex items-center gap-3 font-sans text-lg font-medium tracking-normal">
        <span className={cn('grid size-7 place-items-center rounded-full text-xs', muted ? 'bg-sand text-muted' : 'bg-ink text-canvas')}>{number}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function ChoiceCard({ selected, onSelect, name, children }: { selected: boolean; onSelect: () => void; name: string; children: ReactNode }) {
  return (
    <label
      className={cn(
        'relative block cursor-pointer rounded-2xl border p-4 pr-10 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink',
        selected ? 'border-ink bg-sand/40 shadow-[inset_0_0_0_1px_var(--color-ink)]' : 'border-line hover:border-ink/30',
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="sr-only" />
      <span
        className={cn(
          'absolute top-4 right-4 grid size-5 place-items-center rounded-full border transition',
          selected ? 'border-ink bg-ink text-canvas' : 'border-ink/20',
        )}
        aria-hidden
      >
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
      {children}
    </label>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="container-page py-14">
      <Skeleton className="h-12 w-72" />
      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Skeleton className="h-48" />
          <Skeleton className="h-36" />
        </div>
        <Skeleton className="h-96 lg:col-span-5" />
      </div>
    </div>
  )
}
