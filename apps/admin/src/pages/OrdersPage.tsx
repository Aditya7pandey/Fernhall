import { formatDate, formatOrderNumber, formatPrice, ORDER_STATUS, type OrderStatus } from '@ecom/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { SearchInput } from '../components/ui/input'
import { Avatar, Card, EmptyState, ErrorState, OrderStatusBadge, PageHeader, PaymentStatusBadge, Tabs } from '../components/ui/misc'
import { Pagination } from '../components/ui/pagination'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '../components/ui/table'
import { useDebounce } from '../hooks/useDebounce'
import { useSearchState } from '../hooks/useSearchState'
import { api } from '../lib/api'
import { cn, errorMessage, relativeTime } from '../lib/utils'

const DEFAULTS = { status: 'ALL', q: '', page: '1' }
const PAGE_SIZE = 15

const STATUS_TABS: { value: OrderStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...(['PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as OrderStatus[]).map((s) => ({
    value: s,
    label: ORDER_STATUS[s].label,
  })),
]

export default function OrdersPage() {
  const { get, set } = useSearchState(DEFAULTS)
  const status = get('status') as OrderStatus | 'ALL'
  const page = Number(get('page')) || 1
  const [search, setSearch] = useState(get('q'))
  const q = useDebounce(search, 300)
  const navigate = useNavigate()

  useEffect(() => {
    if (q !== get('q')) set({ q })
  }, [q, get, set])

  const counts = useQuery({ queryKey: ['admin', 'stats', 30], queryFn: () => api.admin.stats(30) })
  const orders = useQuery({
    queryKey: ['admin', 'orders', { status, q: get('q'), page }],
    queryFn: () =>
      api.admin.orders.list({ status: status === 'ALL' ? undefined : status, q: get('q') || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const byStatus = counts.data?.ordersByStatus
  const total = byStatus ? Object.values(byStatus).reduce((a, b) => a + b, 0) : undefined

  return (
    <>
      <PageHeader title="Orders" description="Track, fulfil and manage customer orders." />
      <Card className="overflow-hidden">
        <div className="border-b border-border px-3 sm:px-4">
          <Tabs
            value={status}
            onChange={(v) => set({ status: v })}
            options={STATUS_TABS.map((t) => ({ ...t, count: t.value === 'ALL' ? total : byStatus?.[t.value as OrderStatus] }))}
          />
        </div>
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by order #, email or name" className="w-full max-w-sm" />
        </div>

        {orders.isError ? (
          <ErrorState message={errorMessage(orders.error)} onRetry={() => orders.refetch()} />
        ) : !orders.data ? (
          <TableSkeleton cols={6} />
        ) : orders.data.items.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag />}
            title="No orders found"
            description={get('q') || status !== 'ALL' ? 'Try a different search or status filter.' : 'Orders will appear here once customers check out.'}
          />
        ) : (
          <div className={cn(orders.isPlaceholderData && 'opacity-60 transition-opacity')}>
            <Table>
              <THead>
                <tr>
                  <Th>Order</Th>
                  <Th>Customer</Th>
                  <Th className="hidden md:table-cell">Date</Th>
                  <Th>Status</Th>
                  <Th className="hidden sm:table-cell">Payment</Th>
                  <Th className="hidden lg:table-cell text-right">Items</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </THead>
              <tbody>
                {orders.data.items.map((o) => (
                  <Tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                    <Td className="font-mono text-[13px] font-medium">{formatOrderNumber(o.number)}</Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={o.user.name} size={28} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">{o.user.name}</p>
                          <p className="truncate text-xs text-muted">{o.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <p className="text-[13px]">{formatDate(o.createdAt)}</p>
                      <p className="text-xs text-muted">{relativeTime(o.createdAt)}</p>
                    </Td>
                    <Td>
                      <OrderStatusBadge status={o.status} />
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <PaymentStatusBadge status={o.paymentStatus} />
                    </Td>
                    <Td className="tabular hidden text-right text-muted lg:table-cell">
                      {o.items.reduce((n, i) => n + i.quantity, 0)}
                    </Td>
                    <Td className="tabular text-right font-medium">{formatPrice(o.totalCents)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={orders.data.page}
              totalPages={orders.data.totalPages}
              total={orders.data.total}
              pageSize={orders.data.pageSize}
              onPage={(p) => set({ page: String(p) })}
              noun="orders"
            />
          </div>
        )}
      </Card>
    </>
  )
}
