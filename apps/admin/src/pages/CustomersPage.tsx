import { formatDate, formatPrice } from '@ecom/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { SearchInput } from '../components/ui/input'
import { Avatar, Card, EmptyState, ErrorState, PageHeader } from '../components/ui/misc'
import { Pagination } from '../components/ui/pagination'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '../components/ui/table'
import { useDebounce } from '../hooks/useDebounce'
import { useSearchState } from '../hooks/useSearchState'
import { api } from '../lib/api'
import { cn, errorMessage, relativeTime } from '../lib/utils'

const DEFAULTS = { q: '', page: '1' }
const PAGE_SIZE = 15

export default function CustomersPage() {
  const { get, set } = useSearchState(DEFAULTS)
  const [search, setSearch] = useState(get('q'))
  const q = useDebounce(search, 300)
  const navigate = useNavigate()
  const page = Number(get('page')) || 1

  useEffect(() => {
    if (q !== get('q')) set({ q })
  }, [q, get, set])

  const customers = useQuery({
    queryKey: ['admin', 'customers', { q: get('q'), page }],
    queryFn: () => api.admin.customers.list({ q: get('q') || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has created an account in your store." />
      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email" className="w-full max-w-sm" />
        </div>
        {customers.isError ? (
          <ErrorState message={errorMessage(customers.error)} onRetry={() => customers.refetch()} />
        ) : !customers.data ? (
          <TableSkeleton cols={5} />
        ) : customers.data.items.length === 0 ? (
          <EmptyState icon={<Users />} title="No customers found" description={get('q') ? 'Try a different search.' : 'Customers appear here when they sign up.'} />
        ) : (
          <div className={cn(customers.isPlaceholderData && 'opacity-60 transition-opacity')}>
            <Table>
              <THead>
                <tr>
                  <Th>Customer</Th>
                  <Th className="text-right">Orders</Th>
                  <Th className="text-right">Total spent</Th>
                  <Th className="hidden md:table-cell">Last order</Th>
                  <Th className="hidden sm:table-cell">Joined</Th>
                </tr>
              </THead>
              <tbody>
                {customers.data.items.map((c) => (
                  <Tr key={c.id} onClick={() => navigate(`/customers/${c.id}`)}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} size={32} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">{c.name}</p>
                          <p className="truncate text-xs text-muted">{c.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="tabular text-right">{c.orderCount}</Td>
                    <Td className="tabular text-right font-medium">{formatPrice(c.totalSpentCents)}</Td>
                    <Td className="hidden text-[13px] text-muted md:table-cell">{c.lastOrderAt ? relativeTime(c.lastOrderAt) : '—'}</Td>
                    <Td className="hidden text-[13px] text-muted sm:table-cell">{formatDate(c.createdAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={customers.data.page}
              totalPages={customers.data.totalPages}
              total={customers.data.total}
              pageSize={customers.data.pageSize}
              onPage={(p) => set({ page: String(p) })}
              noun="customers"
            />
          </div>
        )}
      </Card>
    </>
  )
}
