import { formatOrderNumber, formatPrice } from '@ecom/shared'
import { useQuery } from '@tanstack/react-query'
import { Search, ShoppingBag, User } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useDebounce } from '../../hooks/useDebounce'
import { api } from '../../lib/api'
import { cn } from '../../lib/utils'
import { Thumb } from '../ui/misc'

type Result = { key: string; to: string; icon: ReactNode; title: string; subtitle: string }

/** Global quick search across products, orders and customers (⌘K / Ctrl+K). */
export function CommandSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const query = useDebounce(q.trim(), 200)
  const navigate = useNavigate()
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [])

  const enabled = query.length >= 2
  const products = useQuery({
    queryKey: ['search', 'products', query],
    queryFn: () => api.admin.products.list({ q: query, pageSize: 4 }),
    enabled,
  })
  const orders = useQuery({
    queryKey: ['search', 'orders', query],
    queryFn: () => api.admin.orders.list({ q: query, pageSize: 4 }),
    enabled,
  })
  const customers = useQuery({
    queryKey: ['search', 'customers', query],
    queryFn: () => api.admin.customers.list({ q: query, pageSize: 4 }),
    enabled,
  })

  const results: Result[] = enabled
    ? [
        ...(orders.data?.items ?? []).map((o) => ({
          key: `o-${o.id}`,
          to: `/orders/${o.id}`,
          icon: <ShoppingBag className="size-4" />,
          title: `Order ${formatOrderNumber(o.number)}`,
          subtitle: `${o.user.name} · ${formatPrice(o.totalCents)}`,
        })),
        ...(products.data?.items ?? []).map((p) => ({
          key: `p-${p.id}`,
          to: `/products/${p.id}`,
          icon: <Thumb src={p.images[0]} alt="" size={24} className="rounded-md" />,
          title: p.name,
          subtitle: `${p.category?.name ?? 'Uncategorised'} · ${formatPrice(p.priceCents)}`,
        })),
        ...(customers.data?.items ?? []).map((c) => ({
          key: `c-${c.id}`,
          to: `/customers/${c.id}`,
          icon: <User className="size-4" />,
          title: c.name,
          subtitle: c.email,
        })),
      ]
    : []
  const loading = enabled && (products.isFetching || orders.isFetching || customers.isFetching)

  const go = (r: Result) => {
    navigate(r.to)
    setOpen(false)
    setQ('')
    inputRef.current?.blur()
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(a + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && results[active]) {
            go(results[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
            inputRef.current?.blur()
          }
        }}
        placeholder="Search orders, products, customers…"
        className="h-9 w-full rounded-lg border border-border bg-surface pr-14 pl-9 text-sm text-fg shadow-xs placeholder:text-subtle focus:border-accent focus:ring-4 focus:ring-ring focus:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-border bg-surface-2 px-1.5 font-mono text-[10px] text-muted sm:block">
        Ctrl K
      </kbd>

      {open && enabled && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1.5 max-h-[60vh] animate-pop-in overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-pop">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-muted">{loading ? 'Searching…' : `No results for “${query}”`}</p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.key}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r)}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left',
                  i === active && 'bg-surface-3',
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted">{r.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-fg">{r.title}</span>
                  <span className="block truncate text-xs text-muted">{r.subtitle}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

