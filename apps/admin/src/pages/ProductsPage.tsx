import { discountPercent, formatPrice, type AdminProductQuery, type AdminProductStatus, type ProductDTO } from '@ecom/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Package, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button, ButtonLink } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/dialog'
import { Dropdown, DropdownItem, DropdownSeparator } from '../components/ui/dropdown'
import { SearchInput, Select } from '../components/ui/input'
import { Badge, Card, EmptyState, ErrorState, PageHeader, StockBadge, Thumb } from '../components/ui/misc'
import { Pagination } from '../components/ui/pagination'
import { Switch } from '../components/ui/switch'
import { Table, TableSkeleton, Td, Th, THead, Tr } from '../components/ui/table'
import { useDebounce } from '../hooks/useDebounce'
import { useSearchState } from '../hooks/useSearchState'
import { api } from '../lib/api'
import { cn, errorMessage } from '../lib/utils'

const DEFAULTS = { q: '', categoryId: '', status: 'all', sort: 'newest', page: '1' }
const PAGE_SIZE = 15

export default function ProductsPage() {
  const { get, set } = useSearchState(DEFAULTS)
  const [search, setSearch] = useState(get('q'))
  const q = useDebounce(search, 300)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [toDelete, setToDelete] = useState<ProductDTO | null>(null)

  useEffect(() => {
    if (q !== get('q')) set({ q })
  }, [q, get, set])

  const query: AdminProductQuery = {
    q: get('q') || undefined,
    categoryId: get('categoryId') || undefined,
    status: get('status') as AdminProductStatus,
    sort: get('sort') as AdminProductQuery['sort'],
    page: Number(get('page')) || 1,
    pageSize: PAGE_SIZE,
  }

  const categories = useQuery({ queryKey: ['admin', 'categories'], queryFn: api.admin.categories.list })
  const products = useQuery({
    queryKey: ['admin', 'products', query],
    queryFn: () => api.admin.products.list(query),
    placeholderData: keepPreviousData,
  })

  const toggleActive = useMutation({
    mutationFn: (p: ProductDTO) => api.admin.products.update(p.id, { isActive: !p.isActive }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] })
      toast.success(`${p.name} is now ${p.isActive ? 'active' : 'hidden from the store'}`)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const remove = useMutation({
    mutationFn: (p: ProductDTO) => api.admin.products.remove(p.id),
    onSuccess: (_, p) => {
      qc.invalidateQueries({ queryKey: ['admin'] })
      toast.success(`Deleted ${p.name}`)
      setToDelete(null)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const filtered = !!(get('q') || get('categoryId') || get('status') !== 'all')

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage your catalog, pricing and inventory."
        actions={
          <ButtonLink to="/products/new" icon={<Plus />}>
            Add product
          </ButtonLink>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-3 lg:flex-row lg:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name or SKU" className="w-full lg:max-w-xs" />
          <div className="grid grid-cols-3 gap-2 lg:ml-auto lg:flex">
            <Select value={get('categoryId')} onChange={(e) => set({ categoryId: e.target.value })} className="lg:w-44" aria-label="Category">
              <option value="">All categories</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={get('status')} onChange={(e) => set({ status: e.target.value })} className="lg:w-40" aria-label="Status">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
            </Select>
            <Select value={get('sort')} onChange={(e) => set({ sort: e.target.value })} className="lg:w-40" aria-label="Sort">
              <option value="newest">Newest</option>
              <option value="name">Name A–Z</option>
              <option value="price_desc">Price: high–low</option>
              <option value="price_asc">Price: low–high</option>
              <option value="stock_asc">Stock: low first</option>
            </Select>
          </div>
        </div>

        {products.isError ? (
          <ErrorState message={errorMessage(products.error)} onRetry={() => products.refetch()} />
        ) : !products.data ? (
          <TableSkeleton cols={6} />
        ) : products.data.items.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title={filtered ? 'No products match' : 'No products yet'}
            description={filtered ? 'Try adjusting your search or filters.' : 'Add your first product to start selling.'}
            action={
              filtered ? (
                <Button variant="secondary" onClick={() => (setSearch(''), set({ q: '', categoryId: '', status: 'all' }))}>
                  Clear filters
                </Button>
              ) : (
                <ButtonLink to="/products/new" icon={<Plus />}>
                  Add product
                </ButtonLink>
              )
            }
          />
        ) : (
          <div className={cn(products.isPlaceholderData && 'opacity-60 transition-opacity')}>
            <Table>
              <THead>
                <tr>
                  <Th>Product</Th>
                  <Th className="hidden md:table-cell">Category</Th>
                  <Th className="text-right">Price</Th>
                  <Th>Stock</Th>
                  <Th className="hidden lg:table-cell">Rating</Th>
                  <Th className="hidden sm:table-cell">Active</Th>
                  <Th className="w-10" />
                </tr>
              </THead>
              <tbody>
                {products.data.items.map((p) => {
                  const off = discountPercent(p.priceCents, p.compareAtPriceCents)
                  return (
                    <Tr key={p.id} onClick={() => navigate(`/products/${p.id}`)}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Thumb src={p.images[0]} alt={p.name} size={40} className={cn(!p.isActive && 'opacity-50')} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate text-[13px] font-medium">
                              {p.name}
                              {p.featured && <Badge tone="accent" className="px-1.5 py-0 text-[10px]">Featured</Badge>}
                            </p>
                            <p className="font-mono text-[11px] text-muted">{p.sku ?? '—'}</p>
                          </div>
                        </div>
                      </Td>
                      <Td className="hidden text-[13px] text-muted md:table-cell">{p.category?.name ?? 'Uncategorised'}</Td>
                      <Td className="text-right">
                        <p className="tabular text-[13px] font-medium">{formatPrice(p.priceCents)}</p>
                        {off && (
                          <p className="tabular text-[11px] text-muted">
                            <span className="line-through">{formatPrice(p.compareAtPriceCents!)}</span>{' '}
                            <span className="text-success-soft-fg">−{off}%</span>
                          </p>
                        )}
                      </Td>
                      <Td>
                        <StockBadge stock={p.stock} />
                      </Td>
                      <Td className="hidden lg:table-cell">
                        {p.ratingCount > 0 ? (
                          <span className="tabular inline-flex items-center gap-1 text-[13px]">
                            <Star className="size-3.5 fill-amber-400 text-amber-400" />
                            {p.ratingAvg.toFixed(1)}
                            <span className="text-muted">({p.ratingCount})</span>
                          </span>
                        ) : (
                          <span className="text-xs text-subtle">No reviews</span>
                        )}
                      </Td>
                      <Td className="hidden sm:table-cell" onClick={(e) => e.stopPropagation()}>
                        <Switch checked={p.isActive} onChange={() => toggleActive.mutate(p)} label={`Toggle ${p.name} active`} />
                      </Td>
                      <Td onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          trigger={({ toggle }) => (
                            <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Actions">
                              <MoreHorizontal />
                            </Button>
                          )}
                        >
                          {(close) => (
                            <>
                              <DropdownItem icon={<Pencil />} onClick={() => (close(), navigate(`/products/${p.id}`))}>
                                Edit
                              </DropdownItem>
                              <DropdownItem icon={<Package />} onClick={() => (close(), toggleActive.mutate(p))}>
                                {p.isActive ? 'Deactivate' : 'Activate'}
                              </DropdownItem>
                              <DropdownSeparator />
                              <DropdownItem danger icon={<Trash2 />} onClick={() => (close(), setToDelete(p))}>
                                Delete
                              </DropdownItem>
                            </>
                          )}
                        </Dropdown>
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
            <Pagination
              page={products.data.page}
              totalPages={products.data.totalPages}
              total={products.data.total}
              pageSize={products.data.pageSize}
              onPage={(pg) => set({ page: String(pg) })}
              noun="products"
            />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        title={`Delete ${toDelete?.name ?? 'product'}?`}
        description="It will be removed from the store and any carts. Past orders keep their line items."
        confirmLabel="Delete product"
        danger
        loading={remove.isPending}
      />
    </>
  )
}
