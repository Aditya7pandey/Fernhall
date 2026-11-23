import { formatDate, formatOrderNumber, formatPrice, formatPriceCompact, ORDER_STATUS, type AdminStats, type OrderStatus } from '@ecom/shared'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, IndianRupee, PackageCheck, Receipt, ShoppingBag, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ButtonLink } from '../components/ui/button'
import { Avatar, Card, CardHeader, EmptyState, ErrorState, OrderStatusBadge, PageHeader, Segmented, Skeleton, Thumb } from '../components/ui/misc'
import { Table, Td, Th, THead, Tr } from '../components/ui/table'
import { useSession } from '../hooks/useAuth'
import { api } from '../lib/api'
import { cn, errorMessage, formatPct, relativeTime } from '../lib/utils'

const RANGES = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function DashboardPage() {
  const [days, setDays] = useState(30)
  const { data: user } = useSession()
  const stats = useQuery({ queryKey: ['admin', 'stats', days], queryFn: () => api.admin.stats(days), placeholderData: (p) => p })

  return (
    <>
      <PageHeader
        title={user && !/^store\b/i.test(user.name) ? `${greeting()}, ${user.name.split(' ')[0]}` : greeting()}
        description="Here's what's happening with your store."
        actions={<Segmented value={days} onChange={setDays} options={RANGES} />}
      />

      {stats.isError ? (
        <Card>
          <ErrorState message={errorMessage(stats.error)} onRetry={() => stats.refetch()} />
        </Card>
      ) : !stats.data ? (
        <DashboardSkeleton />
      ) : (
        <div className={cn('space-y-6 transition-opacity', stats.isPlaceholderData && 'opacity-60')}>
          <Kpis s={stats.data} />
          <div className="grid gap-6 xl:grid-cols-3">
            <RevenueChart s={stats.data} />
            <StatusBreakdown s={stats.data} />
          </div>
          <div className="grid items-start gap-6 xl:grid-cols-3">
            <RecentOrders s={stats.data} />
            <TopProducts s={stats.data} />
          </div>
          <LowStock s={stats.data} />
        </div>
      )}
    </>
  )
}

// ─── KPIs ───────────────────────────────────────────────────────────────────

function Kpi({
  label,
  value,
  change,
  sub,
  icon,
}: {
  label: string
  value: string
  change?: number | null
  sub?: ReactNode
  icon: ReactNode
}) {
  const up = (change ?? 0) >= 0
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-fg [&_svg]:size-4">{icon}</span>
      </div>
      <p className="tabular mt-3 text-xl font-semibold tracking-tight text-fg sm:text-2xl">{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {change !== undefined && (
          <span
            className={cn(
              'tabular inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium',
              change == null ? 'bg-surface-3 text-muted' : up ? 'bg-success-soft text-success-soft-fg' : 'bg-danger-soft text-danger-soft-fg',
            )}
          >
            {change != null && (up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />)}
            {formatPct(change)}
          </span>
        )}
        {sub && <span className="text-muted">{sub}</span>}
      </div>
    </Card>
  )
}

function Kpis({ s }: { s: AdminStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <Kpi label="Revenue" value={formatPrice(s.revenueCents)} change={s.revenueChangePct} sub="vs previous period" icon={<IndianRupee />} />
      <Kpi label="Orders" value={s.orders.toLocaleString()} change={s.ordersChangePct} sub="vs previous period" icon={<ShoppingBag />} />
      <Kpi label="Average order" value={formatPrice(s.averageOrderCents)} sub="paid orders" icon={<Receipt />} />
      <Kpi
        label="Customers"
        value={s.customers.toLocaleString()}
        sub={
          <>
            <span className="font-medium text-fg">+{s.newCustomers}</span> new in {s.rangeDays} days
          </>
        }
        icon={<Users />}
      />
    </div>
  )
}

// ─── Revenue chart ──────────────────────────────────────────────────────────

function RevenueChart({ s }: { s: AdminStats }) {
  const data = s.revenueByDay.map((d) => ({ ...d, revenue: d.revenueCents / 100 }))
  const tickEvery = Math.ceil(data.length / 7)
  return (
    <Card className="xl:col-span-2">
      <CardHeader
        title="Revenue"
        description={`Paid orders, last ${s.rangeDays} days`}
        action={<p className="tabular text-lg font-semibold">{formatPrice(s.revenueCents)}</p>}
      />
      <div className="h-72 px-2 pt-4 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              interval={tickEvery - 1}
              tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
              tickFormatter={(d: string) => formatDate(d + 'T12:00:00', { month: 'short', day: 'numeric' })}
              dy={6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={56}
              tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
              tickFormatter={(v: number) => formatPriceCompact(v * 100).replace(/,000$/, 'k')}
            />
            <Tooltip
              cursor={{ stroke: 'var(--border-strong)', strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0]!.payload as (typeof data)[number]
                return (
                  <div className="rounded-lg border border-border bg-surface px-3 py-2 shadow-pop">
                    <p className="text-[11px] text-muted">{formatDate(p.date + 'T12:00:00', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                    <p className="tabular mt-0.5 text-sm font-semibold">{formatPrice(p.revenueCents)}</p>
                    <p className="text-[11px] text-muted">
                      {p.orders} order{p.orders === 1 ? '' : 's'}
                    </p>
                  </div>
                )
              }}
            />
            <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} fill="url(#rev)" activeDot={{ r: 4, strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// ─── Status breakdown ───────────────────────────────────────────────────────

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-warning',
  PAID: 'bg-[oklch(0.65_0.15_240)]',
  PROCESSING: 'bg-accent',
  SHIPPED: 'bg-[oklch(0.7_0.12_200)]',
  DELIVERED: 'bg-success',
  CANCELLED: 'bg-danger',
  REFUNDED: 'bg-border-strong',
}

function StatusBreakdown({ s }: { s: AdminStats }) {
  const entries = (Object.entries(s.ordersByStatus) as [OrderStatus, number][]).filter(([, n]) => n > 0)
  const total = entries.reduce((n, [, c]) => n + c, 0)
  return (
    <Card>
      <CardHeader title="Orders by status" description="All time" />
      <div className="p-5">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-3">
          {entries.map(([status, n]) => (
            <div key={status} className={STATUS_COLORS[status]} style={{ width: `${(n / total) * 100}%` }} title={ORDER_STATUS[status].label} />
          ))}
        </div>
        <ul className="mt-5 space-y-1">
          {(Object.keys(s.ordersByStatus) as OrderStatus[]).map((status) => (
            <li key={status}>
              <Link
                to={`/orders?status=${status}`}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-surface-2"
              >
                <span className="flex items-center gap-2.5 text-muted">
                  <span className={cn('size-2 rounded-full', STATUS_COLORS[status])} />
                  {ORDER_STATUS[status].label}
                </span>
                <span className="tabular font-medium text-fg">{s.ordersByStatus[status]}</span>
              </Link>
            </li>
          ))}
        </ul>
        {s.pendingFulfilment > 0 && (
          <Link
            to="/orders?status=PAID"
            className="mt-4 flex items-center justify-between rounded-lg border border-accent/20 bg-accent-soft px-3 py-2.5 text-[13px] font-medium text-accent-soft-fg"
          >
            <span className="flex items-center gap-2">
              <PackageCheck className="size-4" />
              {s.pendingFulfilment} order{s.pendingFulfilment === 1 ? '' : 's'} to fulfil
            </span>
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    </Card>
  )
}

// ─── Recent orders ──────────────────────────────────────────────────────────

function RecentOrders({ s }: { s: AdminStats }) {
  const navigate = useNavigate()
  return (
    <Card className="overflow-hidden xl:col-span-2">
      <CardHeader
        title="Recent orders"
        description="Latest activity across the store"
        action={
          <ButtonLink to="/orders" variant="ghost" size="sm">
            View all <ArrowRight />
          </ButtonLink>
        }
      />
      {s.recentOrders.length === 0 ? (
        <EmptyState icon={<ShoppingBag />} title="No orders yet" />
      ) : (
        <Table>
          <THead>
            <tr>
              <Th>Order</Th>
              <Th className="hidden sm:table-cell">Customer</Th>
              <Th>Status</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </THead>
          <tbody>
            {s.recentOrders.map((o) => (
              <Tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                <Td>
                  <p className="font-mono text-[13px] font-medium">{formatOrderNumber(o.number)}</p>
                  <p className="text-xs text-muted">
                    <span className="sm:hidden">{o.user.name} · </span>
                    {relativeTime(o.createdAt)}
                  </p>
                </Td>
                <Td className="hidden sm:table-cell">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={o.user.name} size={26} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{o.user.name}</p>
                      <p className="truncate text-xs text-muted">{o.items.length} item{o.items.length === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  <OrderStatusBadge status={o.status} />
                </Td>
                <Td className="tabular text-right font-medium">{formatPrice(o.totalCents)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

// ─── Top products / low stock ───────────────────────────────────────────────

function TopProducts({ s }: { s: AdminStats }) {
  const max = Math.max(1, ...s.topProducts.map((p) => p.unitsSold))
  return (
    <Card>
      <CardHeader title="Top products" description={`By units sold, last ${s.rangeDays} days`} />
      {s.topProducts.length === 0 ? (
        <EmptyState title="No sales in this period" className="py-8" />
      ) : (
        <ul className="divide-y divide-border">
          {s.topProducts.map((p, i) => (
            <li key={p.productId}>
              <Link to={`/products/${p.productId}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
                <span className="tabular w-4 text-xs font-medium text-subtle">{i + 1}</span>
                <Thumb src={p.imageUrl} alt={p.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{p.name}</p>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(p.unitsSold / max) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="tabular text-[13px] font-medium">{formatPrice(p.revenueCents)}</p>
                  <p className="tabular text-xs text-muted">{p.unitsSold} sold</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function LowStock({ s }: { s: AdminStats }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" /> Low stock
          </span>
        }
        description="Active products with 5 or fewer left"
        action={
          <ButtonLink to="/products?status=low_stock" variant="ghost" size="sm">
            View
          </ButtonLink>
        }
      />
      {s.lowStock.length === 0 ? (
        <EmptyState title="Everything's well stocked" className="py-8" />
      ) : (
        <ul className="-mt-px grid sm:grid-cols-2 xl:grid-cols-4 [&>li]:border-t [&>li]:border-border">
          {s.lowStock.map((p) => (
            <li key={p.id}>
              <Link to={`/products/${p.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2">
                <Thumb src={p.images[0]} alt={p.name} size={32} />
                <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{p.name}</p>
                <span
                  className={cn(
                    'tabular rounded-md px-2 py-0.5 text-xs font-medium',
                    p.stock === 0 ? 'bg-danger-soft text-danger-soft-fg' : 'bg-warning-soft text-warning-soft-fg',
                  )}
                >
                  {p.stock === 0 ? 'Out' : `${p.stock} left`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="space-y-4 p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-3 w-40" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="h-[370px] p-5 xl:col-span-2">
          <Skeleton className="h-full w-full" />
        </Card>
        <Card className="h-[370px] p-5">
          <Skeleton className="h-full w-full" />
        </Card>
      </div>
    </div>
  )
}
