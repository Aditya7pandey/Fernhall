import { formatDate, formatOrderNumber, formatPrice } from '@ecom/shared'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Mail, MapPin, ShoppingBag } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar, Badge, Card, CardHeader, EmptyState, ErrorState, OrderStatusBadge, PageHeader, Skeleton } from '../components/ui/misc'
import { Table, Td, Th, THead, Tr } from '../components/ui/table'
import { api } from '../lib/api'
import { errorMessage } from '../lib/utils'

export default function CustomerDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const customer = useQuery({ queryKey: ['admin', 'customer', id], queryFn: () => api.admin.customers.get(id) })

  const back = (
    <Link to="/customers" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-fg">
      <ArrowLeft className="size-4" /> Customers
    </Link>
  )

  if (customer.isError) {
    return (
      <>
        <PageHeader title="Customer" back={back} />
        <Card>
          <ErrorState message={errorMessage(customer.error)} onRetry={() => customer.refetch()} />
        </Card>
      </>
    )
  }
  if (!customer.data) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-7 w-48" />} back={back} />
        <Skeleton className="h-96" />
      </>
    )
  }

  const c = customer.data
  const paidOrders = c.orders.filter((o) => o.paymentStatus === 'PAID').length

  return (
    <>
      <div className="mb-3">{back}</div>
      <Card className="mb-6 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-accent/25 via-accent/10 to-transparent" />
        <div className="-mt-9 flex flex-col gap-4 px-6 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <Avatar name={c.name} size={72} className="ring-4 ring-surface" />
            <div className="pb-1">
              <h1 className="text-xl font-semibold tracking-tight">{c.name}</h1>
              <p className="flex items-center gap-1.5 text-[13px] text-muted">
                <Mail className="size-3.5" /> {c.email} · Customer since {formatDate(c.createdAt)}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-6 text-right sm:gap-10">
            <Metric label="Orders" value={String(c.orderCount)} />
            <Metric label="Total spent" value={formatPrice(c.totalSpentCents)} />
            <Metric label="Avg. order" value={paidOrders ? formatPrice(Math.round(c.totalSpentCents / paidOrders)) : '—'} />
          </dl>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader title="Order history" description={`${c.orders.length} order${c.orders.length === 1 ? '' : 's'}`} />
          {c.orders.length === 0 ? (
            <EmptyState icon={<ShoppingBag />} title="No orders yet" />
          ) : (
            <Table>
              <THead>
                <tr>
                  <Th>Order</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </THead>
              <tbody>
                {c.orders.map((o) => (
                  <Tr key={o.id} onClick={() => navigate(`/orders/${o.id}`)}>
                    <Td>
                      <p className="font-mono text-[13px] font-medium">{formatOrderNumber(o.number)}</p>
                      <p className="text-xs text-muted">
                        {o.items.reduce((n, i) => n + i.quantity, 0)} items
                      </p>
                    </Td>
                    <Td className="text-[13px] text-muted">{formatDate(o.createdAt)}</Td>
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

        <Card>
          <CardHeader title="Addresses" />
          {c.addresses.length === 0 ? (
            <EmptyState icon={<MapPin />} title="No saved addresses" className="py-8" />
          ) : (
            <ul className="divide-y divide-border">
              {c.addresses.map((a) => (
                <li key={a.id} className="flex gap-3 px-5 py-4">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-subtle" />
                  <address className="text-[13px] leading-relaxed not-italic">
                    <span className="flex items-center gap-2 font-medium">
                      {a.fullName} {a.isDefault && <Badge tone="accent">Default</Badge>}
                    </span>
                    {a.line1}
                    {a.line2 && `, ${a.line2}`}
                    <br />
                    {a.city}, {a.state} {a.postalCode}
                    <br />
                    <span className="text-muted">{a.country}</span>
                    {a.phone && <span className="block text-muted">{a.phone}</span>}
                  </address>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular text-lg font-semibold">{value}</dd>
    </div>
  )
}
