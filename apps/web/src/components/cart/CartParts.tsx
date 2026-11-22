import { formatPrice, type CartDTO, type CartItemDTO, type Totals } from '@ecom/shared'
import { AlertCircle, Tag, Truck, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useApplyCoupon, useRemoveCartItem, useRemoveCoupon, useUpdateCartItem } from '../../hooks/useCart'
import { cn, errorMessage, FREE_SHIPPING_CENTS, imageUrl } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input } from '../ui/Form'
import { QuantityStepper } from '../ui/misc'

export function CartLine({ item, compact, onNavigate }: { item: CartItemDTO; compact?: boolean; onNavigate?: () => void }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const { product } = item
  const busy = update.isPending || remove.isPending

  return (
    <li className={cn('flex gap-4 py-5', busy && 'opacity-60 transition-opacity')}>
      <Link
        to={`/product/${product.slug}`}
        onClick={onNavigate}
        className={cn('shrink-0 overflow-hidden rounded-xl bg-sand', compact ? 'size-22' : 'size-24 sm:size-28')}
      >
        {product.images[0] && <img src={imageUrl(product.images[0], 240)} alt={product.name} className="size-full object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <Link
            to={`/product/${product.slug}`}
            onClick={onNavigate}
            className="text-[15px] leading-snug font-medium hover:underline hover:underline-offset-4"
          >
            {product.name}
          </Link>
          <p className="shrink-0 text-[15px] font-medium tabular-nums">{formatPrice(item.lineTotalCents)}</p>
        </div>
        <p className="mt-0.5 text-sm text-muted tabular-nums">{formatPrice(product.priceCents)} each</p>
        {!item.available && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-danger">
            <AlertCircle className="size-3.5" />
            {!product.isActive || product.stock === 0 ? 'No longer available' : `Only ${product.stock} left — reduce quantity`}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <QuantityStepper
            size="sm"
            value={item.quantity}
            max={Math.max(1, Math.min(20, product.stock))}
            disabled={busy}
            onChange={(quantity) => update.mutate({ productId: product.id, quantity })}
          />
          <button
            type="button"
            onClick={() => remove.mutate(product.id)}
            className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            disabled={busy}
          >
            Remove
          </button>
        </div>
      </div>
    </li>
  )
}

export function FreeShippingBar({ subtotalCents }: { subtotalCents: number }) {
  const remaining = FREE_SHIPPING_CENTS - subtotalCents
  const pct = Math.min(100, (subtotalCents / FREE_SHIPPING_CENTS) * 100)
  return (
    <div className="rounded-xl bg-sand/70 px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-ink-2">
        <Truck className="size-4 shrink-0" />
        {remaining > 0 ? (
          <span>
            You're <strong className="font-semibold text-ink">{formatPrice(remaining)}</strong> away from free standard shipping
          </span>
        ) : (
          <span className="font-medium text-success">You've unlocked free standard shipping</span>
        )}
      </p>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-sand-2" aria-hidden>
        <div className={cn('h-full rounded-full transition-all duration-500', remaining > 0 ? 'bg-ink' : 'bg-success')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function CouponForm({ cart }: { cart: CartDTO }) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const [open, setOpen] = useState(false)

  if (cart.coupon) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm',
          cart.coupon.valid ? 'border-success/30 bg-success-soft' : 'border-warning/30 bg-warning-soft',
        )}
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <Tag className="size-4" /> {cart.coupon.code}
          </p>
          <p className={cn('mt-0.5 text-xs', cart.coupon.valid ? 'text-success' : 'text-warning')}>
            {cart.coupon.valid ? cart.coupon.description : cart.coupon.message}
          </p>
        </div>
        <button
          type="button"
          onClick={() => remove.mutate()}
          className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-black/5"
          aria-label={`Remove code ${cart.coupon.code}`}
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-ink-2 underline-offset-4 hover:underline">
        <Tag className="size-4" /> Have a promo code?
      </button>
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (code.trim()) apply.mutate(code.trim(), { onSuccess: () => setCode('') })
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <label htmlFor="coupon" className="sr-only">
          Promo code
        </label>
        <Input
          id="coupon"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            apply.reset()
          }}
          placeholder="Promo code"
          className="h-11 uppercase placeholder:normal-case"
          autoFocus
          aria-invalid={apply.isError || undefined}
        />
        <Button type="submit" variant="outline" className="h-11" loading={apply.isPending}>
          Apply
        </Button>
      </div>
      {apply.isError && <p className="text-xs text-danger">{errorMessage(apply.error)}</p>}
    </form>
  )
}

export function TotalsList({
  totals,
  shippingLabel = 'Shipping',
  shippingPending,
  className,
}: {
  totals: Totals
  shippingLabel?: string
  shippingPending?: boolean
  className?: string
}) {
  return (
    <dl className={cn('space-y-3 text-sm', className)}>
      <Row label="Subtotal" value={formatPrice(totals.subtotalCents)} />
      {totals.discountCents > 0 && <Row label="Discount" value={`−${formatPrice(totals.discountCents)}`} className="text-success" />}
      <Row
        label={shippingLabel}
        value={shippingPending ? 'Calculated at checkout' : totals.shippingCents === 0 ? 'Free' : formatPrice(totals.shippingCents)}
        muted={shippingPending}
      />
      <Row label="Estimated tax" value={formatPrice(totals.taxCents)} />
      <div className="flex items-baseline justify-between border-t border-line pt-4">
        <dt className="text-base font-medium">Total</dt>
        <dd className="font-display text-2xl tabular-nums">
          {formatPrice(shippingPending ? totals.totalCents - totals.shippingCents : totals.totalCents)}
        </dd>
      </div>
    </dl>
  )
}

function Row({ label, value, className, muted }: { label: string; value: string; className?: string; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-4', className)}>
      <dt className="text-ink-2">{label}</dt>
      <dd className={cn('tabular-nums', muted && 'text-muted')}>{value}</dd>
    </div>
  )
}
