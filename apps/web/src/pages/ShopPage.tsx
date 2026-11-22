import type { ProductQuery, ProductSort } from '@ecom/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useCategories } from '../hooks/useCategories'
import { ProductGrid } from '../components/product/ProductCard'
import { Button, ButtonLink } from '../components/ui/Button'
import { Checkbox, Select } from '../components/ui/Form'
import { EmptyState } from '../components/ui/misc'
import { api } from '../lib/api'
import { qk } from '../lib/query'
import { cn } from '../lib/utils'

const SORTS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most reviewed' },
  { value: 'rating', label: 'Top rated' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name', label: 'Name A–Z' },
]

/** Price presets in dollars (URL keeps dollars; API takes cents) */
const PRICE_RANGES = [
  { label: 'Under $50', min: undefined, max: 50 },
  { label: '$50 – $150', min: 50, max: 150 },
  { label: '$150 – $500', min: 150, max: 500 },
  { label: '$500 & above', min: 500, max: undefined },
] as const

const PAGE_SIZE = 12

export function ShopPage() {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const { data: categories } = useCategories()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const q = params.get('q') ?? undefined
  const sort = (params.get('sort') as ProductSort) || 'newest'
  const page = Math.max(1, Number(params.get('page')) || 1)
  const minPrice = params.get('minPrice') ? Number(params.get('minPrice')) : undefined
  const maxPrice = params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined
  const inStock = params.get('inStock') === 'true'
  const onSale = params.get('onSale') === 'true'
  const featured = params.get('featured') === 'true'

  const query: ProductQuery = {
    page,
    pageSize: PAGE_SIZE,
    q,
    category: slug,
    sort,
    minPrice: minPrice != null ? minPrice * 100 : undefined,
    maxPrice: maxPrice != null ? maxPrice * 100 : undefined,
    inStock: inStock || undefined,
    onSale: onSale || undefined,
    featured: featured || undefined,
  }
  const { data, isLoading, isFetching } = useQuery({
    queryKey: qk.products(query),
    queryFn: () => api.products.list(query),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  const category = categories?.find((c) => c.slug === slug)

  /** Updates params; any filter change resets to page 1. */
  const update = (changes: Record<string, string | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === '') next.delete(k)
      else next.set(k, v)
    }
    if (resetPage) next.delete('page')
    setParams(next, { preventScrollReset: true })
  }

  const activeChips: { label: string; clear: () => void }[] = [
    ...(q ? [{ label: `“${q}”`, clear: () => update({ q: undefined }) }] : []),
    ...(minPrice != null || maxPrice != null
      ? [{
          label: maxPrice == null ? `$${minPrice}+` : minPrice == null ? `Under $${maxPrice}` : `$${minPrice} – $${maxPrice}`,
          clear: () => update({ minPrice: undefined, maxPrice: undefined }),
        }]
      : []),
    ...(inStock ? [{ label: 'In stock', clear: () => update({ inStock: undefined }) }] : []),
    ...(onSale ? [{ label: 'On sale', clear: () => update({ onSale: undefined }) }] : []),
    ...(featured ? [{ label: "Editor's picks", clear: () => update({ featured: undefined }) }] : []),
  ]

  const title = q ? `Results for “${q}”` : category?.name ?? (onSale ? 'The sale' : featured ? "Editor's picks" : 'Shop all')
  const filters = (
    <div className="space-y-8">
      <FilterGroup title="Category">
        <ul className="space-y-1 text-sm">
          <li>
            <CategoryLink to={`/shop${keepParams(params)}`} active={!slug}>
              All products
            </CategoryLink>
          </li>
          {categories?.map((c) => (
            <li key={c.id}>
              <CategoryLink to={`/category/${c.slug}${keepParams(params)}`} active={slug === c.slug} count={c.productCount}>
                {c.name}
              </CategoryLink>
            </li>
          ))}
        </ul>
      </FilterGroup>
      <FilterGroup title="Price">
        <div className="space-y-3">
          {PRICE_RANGES.map((r) => {
            const active = minPrice === r.min && maxPrice === r.max
            return (
              <Checkbox
                key={r.label}
                checked={active}
                label={r.label}
                onChange={(on) =>
                  update(on ? { minPrice: r.min?.toString(), maxPrice: r.max?.toString() } : { minPrice: undefined, maxPrice: undefined })
                }
              />
            )
          })}
        </div>
      </FilterGroup>
      <FilterGroup title="Availability">
        <div className="space-y-3">
          <Checkbox checked={inStock} onChange={(v) => update({ inStock: v ? 'true' : undefined })} label="In stock only" />
          <Checkbox checked={onSale} onChange={(v) => update({ onSale: v ? 'true' : undefined })} label="On sale" />
        </div>
      </FilterGroup>
    </div>
  )

  return (
    <div>
      {/* Header — kept compact so products are visible immediately */}
      <div className="container-page pt-5 lg:pt-6">
        <nav aria-label="Breadcrumb" className="mb-2 text-xs text-muted">
          <Link to="/" className="hover:text-ink">Home</Link>
          <span className="mx-1.5">/</span>
          {category ? (
            <>
              <Link to="/shop" className="hover:text-ink">Shop</Link>
              <span className="mx-1.5">/</span>
              <span className="text-ink">{category.name}</span>
            </>
          ) : (
            <span className="text-ink">Shop</span>
          )}
        </nav>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl leading-tight sm:text-3xl">{title}</h1>
          {data && (
            <span className="text-sm text-muted" aria-live="polite">
              {data.total} {data.total === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>
      </div>

      <div className="container-page pt-5 pb-10 lg:pt-6 lg:pb-14">
        <div className="grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-14">
          {/* Desktop filters */}
          <aside className="hidden lg:block" aria-label="Filters">
            <div className="sticky top-28">{filters}</div>
          </aside>

          <div>
            {/* Toolbar */}
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)} icon={<SlidersHorizontal className="size-4" />}>
                  Filters{activeChips.length > 0 && ` (${activeChips.length})`}
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="sort" className="hidden text-sm text-muted sm:block">
                  Sort by
                </label>
                <Select id="sort" value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? undefined : e.target.value })} className="h-10 w-auto rounded-full text-sm">
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {activeChips.length > 0 && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={chip.clear}
                    className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-medium text-canvas transition hover:bg-ink-2"
                    aria-label={`Remove filter ${chip.label}`}
                  >
                    {chip.label} <X className="size-3" />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setParams(sort !== 'newest' ? { sort } : {})}
                  className="ml-1 text-xs text-muted underline underline-offset-4 hover:text-ink"
                >
                  Clear all
                </button>
              </div>
            )}

            {isLoading ? (
              <ProductGrid loading skeletons={9} className="lg:grid-cols-3" />
            ) : data && data.items.length > 0 ? (
              <div className={cn('transition-opacity', isFetching && 'opacity-60')}>
                <ProductGrid products={data.items} className="lg:grid-cols-3" />
                {data.totalPages > 1 && (
                  <Pagination page={page} totalPages={data.totalPages} onChange={(p) => update({ page: p === 1 ? undefined : String(p) }, false)} />
                )}
              </div>
            ) : (
              <EmptyState
                icon={<SearchX className="size-7" />}
                title="Nothing matches — yet"
                action={
                  <ButtonLink to="/shop" variant="outline">
                    Browse everything
                  </ButtonLink>
                }
              >
                Try removing a filter or searching for something a little different.
              </EmptyState>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      <AnimatePresence>
        {filtersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
            <motion.div className="absolute inset-0 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFiltersOpen(false)} />
            <motion.div
              className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-canvas px-6 pt-6 pb-8"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            >
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl">Filters</h2>
                <button type="button" onClick={() => setFiltersOpen(false)} className="grid size-10 place-items-center rounded-full hover:bg-sand" aria-label="Close filters">
                  <X className="size-5" />
                </button>
              </div>
              {filters}
              <Button className="mt-8 w-full" onClick={() => setFiltersOpen(false)}>
                Show {data?.total ?? ''} results
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Keep non-category params when switching category (but reset paging). */
function keepParams(params: URLSearchParams) {
  const next = new URLSearchParams(params)
  next.delete('page')
  const s = next.toString()
  return s ? `?${s}` : ''
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="eyebrow mb-4 font-sans">{title}</h3>
      {children}
    </div>
  )
}

function CategoryLink({ to, active, count, children }: { to: string; active: boolean; count?: number; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex items-center justify-between rounded-lg px-3 py-2 transition',
        active ? 'bg-ink text-canvas' : 'text-ink-2 hover:bg-sand hover:text-ink',
      )}
      aria-current={active ? 'page' : undefined}
    >
      {children}
      {count != null && <span className={cn('text-xs', active ? 'text-canvas/70' : 'text-subtle')}>{count}</span>}
    </Link>
  )
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
  )
  return (
    <nav className="mt-16 flex items-center justify-center gap-1.5" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="grid size-10 place-items-center rounded-full border border-line transition hover:border-ink/40 disabled:opacity-30"
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && pages[i - 1]! < p - 1 && <span className="px-1 text-muted">…</span>}
          <button
            type="button"
            onClick={() => onChange(p)}
            className={cn('size-10 rounded-full text-sm tabular-nums transition', p === page ? 'bg-ink text-canvas' : 'hover:bg-sand')}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className="grid size-10 place-items-center rounded-full border border-line transition hover:border-ink/40 disabled:opacity-30"
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </button>
    </nav>
  )
}
