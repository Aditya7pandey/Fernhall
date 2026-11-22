import { formatDate, type AdminReview } from '@ecom/shared'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageSquareText, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/dialog'
import { SearchInput, Select } from '../components/ui/input'
import { Avatar, Card, EmptyState, ErrorState, PageHeader, Skeleton, Stars, Thumb } from '../components/ui/misc'
import { Pagination } from '../components/ui/pagination'
import { useDebounce } from '../hooks/useDebounce'
import { useSearchState } from '../hooks/useSearchState'
import { api } from '../lib/api'
import { cn, errorMessage, relativeTime } from '../lib/utils'

const DEFAULTS = { q: '', rating: '', page: '1' }
const PAGE_SIZE = 10

export default function ReviewsPage() {
  const { get, set } = useSearchState(DEFAULTS)
  const [search, setSearch] = useState(get('q'))
  const q = useDebounce(search, 300)
  const page = Number(get('page')) || 1
  const qc = useQueryClient()
  const [toDelete, setToDelete] = useState<AdminReview | null>(null)

  useEffect(() => {
    if (q !== get('q')) set({ q })
  }, [q, get, set])

  const reviews = useQuery({
    queryKey: ['admin', 'reviews', { q: get('q'), rating: get('rating'), page }],
    queryFn: () =>
      api.admin.reviews.list({ q: get('q') || undefined, rating: get('rating') ? Number(get('rating')) : undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: (r: AdminReview) => api.admin.reviews.remove(r.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'reviews'] })
      qc.invalidateQueries({ queryKey: ['admin', 'products'] })
      toast.success('Review deleted')
      setToDelete(null)
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  return (
    <>
      <PageHeader title="Reviews" description="Moderate what customers are saying about your products." />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search review text or product" className="w-full sm:max-w-sm" />
          <Select value={get('rating')} onChange={(e) => set({ rating: e.target.value })} className="sm:ml-auto sm:w-40" aria-label="Rating">
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} star{r === 1 ? '' : 's'}
              </option>
            ))}
          </Select>
        </div>

        {reviews.isError ? (
          <ErrorState message={errorMessage(reviews.error)} onRetry={() => reviews.refetch()} />
        ) : !reviews.data ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-3 px-5 py-5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full max-w-xl" />
                <Skeleton className="h-3 w-2/3 max-w-md" />
              </div>
            ))}
          </div>
        ) : reviews.data.items.length === 0 ? (
          <EmptyState icon={<MessageSquareText />} title="No reviews found" description="Try a different search or rating filter." />
        ) : (
          <div className={cn(reviews.isPlaceholderData && 'opacity-60 transition-opacity')}>
            <ul className="divide-y divide-border">
              {reviews.data.items.map((r) => (
                <li key={r.id} className="group flex gap-4 px-5 py-5">
                  <Avatar name={r.user.name} size={36} className="hidden sm:flex" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars rating={r.rating} />
                      {r.title && <p className="text-[13px] font-semibold">{r.title}</p>}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-fg/90">{r.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
                      <span>
                        <span className="font-medium text-fg">{r.user.name}</span> · {r.user.email}
                      </span>
                      <span title={formatDate(r.createdAt)}>{relativeTime(r.createdAt)}</span>
                      <Link to={`/products/${r.product.id}`} className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 py-0.5 pr-2 pl-0.5 hover:text-fg">
                        <Thumb src={r.product.images[0]} alt="" size={18} className="rounded" />
                        {r.product.name}
                      </Link>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0 opacity-60 group-hover:opacity-100 hover:text-danger"
                    onClick={() => setToDelete(r)}
                    aria-label="Delete review"
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
            <Pagination
              page={reviews.data.page}
              totalPages={reviews.data.totalPages}
              total={reviews.data.total}
              pageSize={reviews.data.pageSize}
              onPage={(p) => set({ page: String(p) })}
              noun="reviews"
            />
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        title="Delete this review?"
        description={`${toDelete?.user.name ?? 'The customer'}'s review of ${toDelete?.product.name ?? 'this product'} will be removed and the product rating recalculated.`}
        confirmLabel="Delete review"
        danger
        loading={remove.isPending}
      />
    </>
  )
}
