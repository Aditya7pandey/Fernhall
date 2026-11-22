import { formatDate, formatOrderNumber, ORDER_STATUS, type AddressDTO, type AddressInput } from '@ecom/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Heart, MapPin, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { AddressForm } from '../../components/order/AddressForm'
import { AddressBlock, OrderItems, OrderRow, OrderStatusBadge, OrderTotals, OrderTracker } from '../../components/order/OrderParts'
import { ProductGrid } from '../../components/product/ProductCard'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Field, Input } from '../../components/ui/Form'
import { Card, EmptyState, Skeleton } from '../../components/ui/misc'
import { useSession } from '../../hooks/useSession'
import { api } from '../../lib/api'
import { qk } from '../../lib/query'
import { errorMessage, fieldErrors } from '../../lib/utils'
import { NotFoundPage } from '../NotFoundPage'

function PanelTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h2 className="text-3xl">{children}</h2>
      {action}
    </div>
  )
}

// ─── Overview ───────────────────────────────────────────────────────────────

export function AccountOverview() {
  const { user } = useSession()
  const orders = useQuery({ queryKey: qk.orders(1), queryFn: () => api.orders.list({ page: 1 }) })
  const wishlist = useQuery({ queryKey: qk.wishlistIds, queryFn: api.wishlist.ids })
  const addresses = useQuery({ queryKey: qk.addresses, queryFn: api.addresses.list })
  const defaultAddress = addresses.data?.find((a) => a.isDefault)
  const awaiting = orders.data?.items.filter((o) => o.status === 'PENDING_PAYMENT').length ?? 0

  return (
    <div className="space-y-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Orders" value={orders.data?.total} to="/account/orders" icon={<Package className="size-5" />} />
        <Stat label="Saved items" value={wishlist.data?.length} to="/account/wishlist" icon={<Heart className="size-5" />} />
        <Stat label="Addresses" value={addresses.data?.length} to="/account/addresses" icon={<MapPin className="size-5" />} />
      </div>

      {awaiting > 0 && (
        <div className="rounded-2xl border border-warning/30 bg-warning-soft px-5 py-4 text-sm text-warning">
          You have {awaiting} {awaiting === 1 ? 'order' : 'orders'} awaiting payment.
        </div>
      )}

      <section>
        <PanelTitle
          action={
            <Link to="/account/orders" className="flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
              All orders <ArrowRight className="size-4" />
            </Link>
          }
        >
          Recent orders
        </PanelTitle>
        {orders.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : orders.data?.items.length ? (
          <div className="space-y-3">
            {orders.data.items.slice(0, 3).map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<Package className="size-7" />} title="No orders yet" action={<ButtonLink to="/shop">Start shopping</ButtonLink>} className="rounded-2xl border border-dashed border-line" />
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <p className="eyebrow mb-3">Profile</p>
          <p className="font-medium">{user?.name}</p>
          <p className="text-sm text-muted">{user?.email}</p>
          {user && <p className="mt-1 text-sm text-muted">Member since {formatDate(user.createdAt, { month: 'long', year: 'numeric' })}</p>}
          <Link to="/account/profile" className="mt-4 inline-block text-sm font-medium underline underline-offset-4">
            Edit profile
          </Link>
        </Card>
        <Card className="p-6">
          <p className="eyebrow mb-3">Default address</p>
          {defaultAddress ? <AddressBlock address={defaultAddress} /> : <p className="text-sm text-muted">No address saved yet.</p>}
          <Link to="/account/addresses" className="mt-4 inline-block text-sm font-medium underline underline-offset-4">
            Manage addresses
          </Link>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, to, icon }: { label: string; value?: number; to: string; icon: ReactNode }) {
  return (
    <Link to={to} className="group rounded-2xl border border-line bg-surface p-5 transition hover:border-ink/30 hover:shadow-soft">
      <div className="flex items-center justify-between text-ink-2">
        {icon}
        <ArrowRight className="size-4 opacity-0 transition group-hover:opacity-100" />
      </div>
      <p className="mt-4 font-display text-4xl">{value ?? '–'}</p>
      <p className="text-sm text-muted">{label}</p>
    </Link>
  )
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export function OrdersPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: qk.orders(page),
    queryFn: () => api.orders.list({ page }),
    placeholderData: keepPreviousData,
  })

  return (
    <div>
      <PanelTitle>Orders</PanelTitle>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <EmptyState
          icon={<Package className="size-7" />}
          title="No orders yet"
          action={<ButtonLink to="/shop">Start shopping</ButtonLink>}
          className="rounded-2xl border border-dashed border-line"
        >
          When you place an order, it'll show up here.
        </EmptyState>
      ) : (
        <>
          <div className="space-y-3">
            {data.items.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
          {data.totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <p className="text-sm text-muted">
                Page {page} of {data.totalPages}
              </p>
              <Button variant="outline" size="sm" disabled={page === data.totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function OrderDetailPage() {
  const { orderId = '' } = useParams()
  const qc = useQueryClient()
  const { data: order, isLoading } = useQuery({ queryKey: qk.order(orderId), queryFn: () => api.orders.get(orderId) })
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

  if (isLoading) return <Skeleton className="h-96" />
  if (!order) return <NotFoundPage title="Order not found" />

  return (
    <div className="space-y-6">
      <Link to="/account/orders" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> All orders
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl">Order {formatOrderNumber(order.number)}</h2>
          <p className="mt-1 text-sm text-muted">Placed {formatDate(order.createdAt, { dateStyle: 'long' })}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <Card className="p-6 sm:p-8">
        <OrderTracker order={order} />
        <p className="mt-6 text-center text-sm text-muted">{ORDER_STATUS[order.status].description}</p>
      </Card>

      {order.status === 'PENDING_PAYMENT' && (
        <div className="flex flex-col gap-4 rounded-2xl border border-warning/30 bg-warning-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-warning">
            <span className="font-medium">Awaiting payment.</span> Your items are reserved for you.
          </p>
          <div className="flex gap-2">
            <ButtonLink to={`/checkout/payment/${order.id}`} size="sm">
              Go to payment
            </ButtonLink>
            <Button size="sm" variant="outline" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              Cancel order
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <h3 className="font-sans text-base font-medium tracking-normal">Items</h3>
          <OrderItems order={order} />
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6">
            <h3 className="mb-4 font-sans text-base font-medium tracking-normal">Summary</h3>
            <OrderTotals order={order} />
            {order.couponCode && <p className="mt-3 text-xs text-muted">Promo code {order.couponCode} applied</p>}
          </Card>
          <Card className="p-6">
            <h3 className="mb-3 font-sans text-base font-medium tracking-normal">Shipping address</h3>
            <AddressBlock address={order.shippingAddress} />
            <p className="mt-4 text-sm text-muted">
              {order.shippingMethod === 'express' ? 'Express (1–2 business days)' : 'Standard (3–5 business days)'}
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Addresses ──────────────────────────────────────────────────────────────

export function AddressesPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: qk.addresses, queryFn: api.addresses.list })
  const [editing, setEditing] = useState<AddressDTO | 'new' | null>(null)
  const invalidate = () => qc.invalidateQueries({ queryKey: qk.addresses })

  const save = useMutation({
    mutationFn: (input: AddressInput) =>
      editing && editing !== 'new' ? api.addresses.update(editing.id, input) : api.addresses.create(input),
    onSuccess: () => {
      invalidate()
      setEditing(null)
      toast.success('Address saved')
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.addresses.remove(id),
    onSuccess: () => {
      invalidate()
      toast.success('Address removed')
    },
    onError: (err) => toast.error(errorMessage(err)),
  })
  const makeDefault = useMutation({
    mutationFn: (id: string) => api.addresses.update(id, { isDefault: true }),
    onSuccess: invalidate,
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <div>
      <PanelTitle
        action={
          !editing && (
            <Button size="sm" variant="outline" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
              Add address
            </Button>
          )
        }
      >
        Addresses
      </PanelTitle>

      {editing ? (
        <Card className="p-6">
          <h3 className="mb-5 font-sans text-base font-medium tracking-normal">{editing === 'new' ? 'New address' : 'Edit address'}</h3>
          <AddressForm
            initial={editing === 'new' ? null : editing}
            onSubmit={(input) => save.mutate(input)}
            onCancel={() => setEditing(null)}
            submitting={save.isPending}
            errors={fieldErrors(save.error)}
          />
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={<MapPin className="size-7" />}
          title="No saved addresses"
          action={<Button onClick={() => setEditing('new')}>Add an address</Button>}
          className="rounded-2xl border border-dashed border-line"
        >
          Save an address for a faster checkout.
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((a) => (
            <Card key={a.id} className="flex flex-col p-6">
              <div className="mb-3 flex items-center justify-between">
                {a.isDefault ? <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-canvas">Default</span> : <span />}
                <div className="flex gap-1">
                  <button type="button" onClick={() => setEditing(a)} className="grid size-9 place-items-center rounded-full hover:bg-sand" aria-label="Edit address">
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(a.id)}
                    className="grid size-9 place-items-center rounded-full text-danger hover:bg-danger-soft"
                    aria-label="Delete address"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <AddressBlock address={a} />
              {!a.isDefault && (
                <button
                  type="button"
                  onClick={() => makeDefault.mutate(a.id)}
                  className="mt-auto self-start pt-4 text-sm font-medium underline underline-offset-4"
                >
                  Set as default
                </button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Wishlist ───────────────────────────────────────────────────────────────

export function WishlistPage() {
  const { data, isLoading } = useQuery({ queryKey: qk.wishlist, queryFn: api.wishlist.list })
  return (
    <div>
      <PanelTitle>Wishlist</PanelTitle>
      {isLoading ? (
        <ProductGrid loading skeletons={3} className="lg:grid-cols-3" />
      ) : !data?.length ? (
        <EmptyState
          icon={<Heart className="size-7" />}
          title="Nothing saved yet"
          action={<ButtonLink to="/shop">Discover products</ButtonLink>}
          className="rounded-2xl border border-dashed border-line"
        >
          Tap the heart on anything you love to keep it here.
        </EmptyState>
      ) : (
        <ProductGrid products={data} className="lg:grid-cols-3" />
      )}
    </div>
  )
}

// ─── Profile ────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { user } = useSession()
  const qc = useQueryClient()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' })

  const profile = useMutation({
    mutationFn: () => api.auth.updateProfile({ name, email }),
    onSuccess: (u) => {
      qc.setQueryData(qk.session, u)
      toast.success('Profile updated')
    },
  })
  const password = useMutation({
    mutationFn: () => api.auth.changePassword(pw),
    onSuccess: () => {
      setPw({ currentPassword: '', newPassword: '' })
      toast.success('Password changed')
    },
  })

  const submitProfile = (e: FormEvent) => {
    e.preventDefault()
    profile.mutate()
  }
  const submitPassword = (e: FormEvent) => {
    e.preventDefault()
    password.mutate()
  }
  const pErr = fieldErrors(profile.error)
  const pwErr = fieldErrors(password.error)

  return (
    <div className="space-y-6">
      <PanelTitle>Profile</PanelTitle>
      <Card className="p-6 sm:p-8">
        <h3 className="mb-5 font-sans text-base font-medium tracking-normal">Personal details</h3>
        <form onSubmit={submitProfile} className="grid max-w-lg gap-5">
          <Field label="Full name" error={pErr.name}>
            {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />}
          </Field>
          <Field label="Email" error={pErr.email}>
            {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />}
          </Field>
          {profile.isError && !Object.keys(pErr).length && <p className="text-sm text-danger">{errorMessage(profile.error)}</p>}
          <div>
            <Button type="submit" loading={profile.isPending}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-6 sm:p-8">
        <h3 className="mb-5 font-sans text-base font-medium tracking-normal">Change password</h3>
        <form onSubmit={submitPassword} className="grid max-w-lg gap-5">
          <Field label="Current password" error={pwErr.currentPassword}>
            {(p) => (
              <Input {...p} type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} required />
            )}
          </Field>
          <Field label="New password" error={pwErr.newPassword} hint="At least 8 characters">
            {(p) => (
              <Input {...p} type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} required minLength={8} />
            )}
          </Field>
          {password.isError && !Object.keys(pwErr).length && <p className="text-sm text-danger">{errorMessage(password.error)}</p>}
          <div>
            <Button type="submit" variant="outline" loading={password.isPending}>
              Update password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

