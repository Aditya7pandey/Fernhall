import { discountPercent, formatPrice, type StatusTone } from '@ecom/shared'
import { Minus, Plus, Star } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../../lib/utils'

// ─── Badge ──────────────────────────────────────────────────────────────────

const tones: Record<StatusTone | 'accent' | 'dark', string> = {
  neutral: 'bg-sand text-ink-2',
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  accent: 'bg-hot text-white',
  dark: 'bg-ink text-canvas',
}

export function Badge({ tone = 'neutral', className, ...props }: ComponentProps<'span'> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', tones[tone], className)}
      {...props}
    />
  )
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-xl bg-[linear-gradient(90deg,var(--color-sand)_0%,var(--color-sand-2)_50%,var(--color-sand)_100%)] bg-[length:800px_100%]',
        className,
      )}
    />
  )
}

// ─── Stars ──────────────────────────────────────────────────────────────────

export function Stars({ rating, size = 14, className }: { rating: number; size?: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} role="img" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - (i - 1)))
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-sand-2" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-ink" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
            </span>
          </span>
        )
      })}
    </span>
  )
}

// ─── Price ──────────────────────────────────────────────────────────────────

export function Price({
  cents,
  compareAt,
  className,
  size = 'md',
}: {
  cents: number
  compareAt?: number | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const onSale = discountPercent(cents, compareAt) != null
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span
        className={cn(
          'font-medium tabular-nums',
          onSale && 'text-hot',
          size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-[15px]',
        )}
      >
        {formatPrice(cents)}
      </span>
      {onSale && (
        <s className={cn('text-muted tabular-nums', size === 'lg' ? 'text-base' : 'text-sm')}>
          <span className="sr-only">Was </span>
          {formatPrice(compareAt!)}
        </s>
      )}
    </span>
  )
}

// ─── Quantity stepper ───────────────────────────────────────────────────────

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
  size = 'md',
  disabled,
  label = 'Quantity',
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md'
  disabled?: boolean
  label?: string
}) {
  const btn = cn(
    'grid place-items-center text-ink-2 transition-colors hover:text-ink disabled:opacity-30',
    size === 'sm' ? 'size-8' : 'size-11',
  )
  return (
    <div
      className={cn('inline-flex items-center rounded-full border border-line bg-surface', disabled && 'opacity-60')}
      role="group"
      aria-label={label}
    >
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Decrease quantity">
        <Minus className="size-3.5" />
      </button>
      <span className={cn('min-w-6 text-center tabular-nums font-medium', size === 'sm' ? 'text-sm' : 'text-[15px]')} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}

// ─── Empty state ────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-16 text-center', className)}>
      {icon && <div className="mb-5 grid size-16 place-items-center rounded-full bg-sand text-ink-2">{icon}</div>}
      <h3 className="text-2xl">{title}</h3>
      {children && <p className="mt-2 max-w-sm text-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

// ─── Card ───────────────────────────────────────────────────────────────────

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-2xl border border-line bg-surface', className)} {...props} />
}
