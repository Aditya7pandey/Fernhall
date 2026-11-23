import { formatOrderNumber, NOTIFICATION_KIND, type NotificationItemDTO, type NotificationKind } from '@ecom/shared'
import { Bell, CircleCheck, CircleX, PackageCheck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { useMarkNotificationsRead, useNotifications } from '../../hooks/useNotifications'
import { cn } from '../../lib/utils'

const KIND_STYLE: Record<NotificationKind, { icon: ReactNode; tone: string }> = {
  ORDER_RECEIVED: { icon: <PackageCheck className="size-4" />, tone: 'bg-accent-soft text-accent' },
  PAYMENT_CONFIRMED: { icon: <CircleCheck className="size-4" />, tone: 'bg-success-soft text-success' },
  ORDER_EXPIRED: { icon: <CircleX className="size-4" />, tone: 'bg-danger-soft text-danger' },
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
function timeAgo(iso: string) {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
  if (s > -45) return 'just now'
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
  ]
  let unit: Intl.RelativeTimeFormatUnit = 'minute'
  let size = 60
  for (const [u, sec] of steps) if (Math.abs(s) >= sec) [unit, size] = [u, sec]
  return rtf.format(Math.round(s / size), unit)
}

/** Header bell: unread badge + dropdown of the notifications the queue workers sent. */
export function NotificationBell({ className }: { className: string }) {
  const { data } = useNotifications()
  const markRead = useMarkNotificationsRead()
  const [open, setOpen] = useState(false)
  // Which items were unread when the panel opened — they stay highlighted even after marking read
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()

  const unread = data?.unreadCount ?? 0
  const items = data?.items ?? []

  const toggle = () => {
    if (!open) {
      setFreshIds(new Set(items.filter((n) => !n.readAt).map((n) => n.id)))
      if (unread > 0) markRead.mutate()
    }
    setOpen((o) => !o)
  }

  // Close on route change (state adjusted during render), outside click and Escape
  const [lastPath, setLastPath] = useState(location.pathname)
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname)
    setOpen(false)
  }
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={className}
        onClick={toggle}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="size-[19px]" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key={unread}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              className="absolute top-0.5 right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-hot px-1 text-[10px] font-semibold text-white"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-12 -right-24 z-50 w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-2xl border border-line bg-canvas shadow-lift sm:right-0"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-medium">Notifications</p>
              {freshIds.size > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent">{freshIds.size} new</span>}
            </div>

            {items.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-sand text-muted">
                  <Bell className="size-5" />
                </span>
                <p className="mt-3 text-sm font-medium">No notifications yet</p>
                <p className="mt-1 text-xs text-muted">Order and payment updates will show up here.</p>
              </div>
            ) : (
              <ul className="max-h-[22rem] divide-y divide-line overflow-y-auto">
                {items.map((n) => (
                  <NotificationRow key={n.id} n={n} fresh={freshIds.has(n.id)} />
                ))}
              </ul>
            )}

            <Link to="/account/orders" className="block border-t border-line px-4 py-3 text-center text-sm font-medium text-accent hover:bg-sand/60">
              View all orders
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function NotificationRow({ n, fresh }: { n: NotificationItemDTO; fresh: boolean }) {
  const style = KIND_STYLE[n.kind]
  return (
    <li>
      <Link to={`/account/orders/${n.order.id}`} className={cn('flex gap-3 px-4 py-3 transition hover:bg-sand/60', fresh && 'bg-accent-soft/40')}>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', style.tone)}>{style.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {NOTIFICATION_KIND[n.kind].label}
            {fresh && <span className="size-1.5 rounded-full bg-hot" aria-label="new" />}
          </p>
          <p className="truncate text-xs text-muted">
            Order {formatOrderNumber(n.order.number)} · {NOTIFICATION_KIND[n.kind].description}
          </p>
          <p className="mt-0.5 text-[11px] text-subtle">{timeAgo(n.sentAt)}</p>
        </div>
      </Link>
    </li>
  )
}
