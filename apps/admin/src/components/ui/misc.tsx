import { ORDER_STATUS, PAYMENT_STATUS, type OrderStatus, type PaymentStatus, type StatusTone } from '@ecom/shared'
import { Star } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cn, imageUrl } from '../../lib/utils'

// ─── Card ───────────────────────────────────────────────────────────────────

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-border bg-surface shadow-card', className)} {...props} />
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-border px-5 py-4', className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// ─── Badge ──────────────────────────────────────────────────────────────────

const tones: Record<StatusTone | 'accent', string> = {
  neutral: 'bg-neutral-soft text-neutral-soft-fg',
  info: 'bg-info-soft text-info-soft-fg',
  warning: 'bg-warning-soft text-warning-soft-fg',
  success: 'bg-success-soft text-success-soft-fg',
  danger: 'bg-danger-soft text-danger-soft-fg',
  accent: 'bg-accent-soft text-accent-soft-fg',
}

const dots: Record<StatusTone | 'accent', string> = {
  neutral: 'bg-neutral-soft-fg',
  info: 'bg-info-soft-fg',
  warning: 'bg-warning-soft-fg',
  success: 'bg-success-soft-fg',
  danger: 'bg-danger-soft-fg',
  accent: 'bg-accent-soft-fg',
}

export function Badge({
  tone = 'neutral',
  dot,
  className,
  children,
}: {
  tone?: StatusTone | 'accent'
  dot?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full', dots[tone])} />}
      {children}
    </span>
  )
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status]
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS[status]
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function StockBadge({ stock, active = true }: { stock: number; active?: boolean }) {
  if (!active) return <Badge>Inactive</Badge>
  if (stock === 0) return <Badge tone="danger">Out of stock</Badge>
  if (stock <= 5) return <Badge tone="warning">Low · {stock}</Badge>
  return <span className="tabular text-sm text-fg">{stock}</span>
}

// ─── Skeleton / Empty ───────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-surface-3', className)} />
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icon && (
        <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-surface-2 text-muted [&_svg]:size-5">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-sm font-semibold text-fg">Couldn't load this</p>
      <p className="mt-1 text-[13px] text-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 cursor-pointer text-sm font-medium text-accent hover:underline">
          Try again
        </button>
      )}
    </div>
  )
}

// ─── Misc ───────────────────────────────────────────────────────────────────

export function Thumb({ src, alt, size = 40, className }: { src?: string | null; alt: string; size?: number; className?: string }) {
  const url = imageUrl(src, size * 3)
  return (
    <div
      className={cn('shrink-0 overflow-hidden rounded-lg border border-border bg-surface-3', className)}
      style={{ width: size, height: size }}
    >
      {url && <img src={url} alt={alt} loading="lazy" className="size-full object-cover" />}
    </div>
  )
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  // Stable hue per name
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center rounded-full font-semibold text-white', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, oklch(0.68 0.13 ${h}), oklch(0.55 0.15 ${(h + 40) % 360}))`,
      }}
    >
      {letters}
    </div>
  )
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-border-strong'}
        />
      ))}
    </span>
  )
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: ReactNode
}) {
  return (
    <div className="mb-6">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-fg sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/** Segmented tabs used for status filters */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode; count?: number }[]
  className?: string
}) {
  return (
    <div className={cn('-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors',
              active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            {o.label}
            {o.count != null && (
              <span
                className={cn(
                  'tabular rounded-full px-1.5 py-px text-[11px]',
                  active ? 'bg-accent-soft text-accent-soft-fg' : 'bg-surface-3 text-muted',
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'cursor-pointer rounded-md px-3 py-1 text-[13px] font-medium transition-colors',
            o.value === value ? 'bg-surface text-fg shadow-xs' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
