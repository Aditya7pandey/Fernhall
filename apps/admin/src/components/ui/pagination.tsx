import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
  noun = 'results',
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPage: (p: number) => void
  noun?: string
}) {
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-3">
      <p className="tabular text-[13px] text-muted">
        <span className="font-medium text-fg">{from}</span>–<span className="font-medium text-fg">{to}</span> of{' '}
        <span className="font-medium text-fg">{total}</span> {noun}
      </p>
      <div className="flex items-center gap-1.5">
        <span className="tabular mr-2 hidden text-[13px] text-muted sm:inline">
          Page {page} of {totalPages}
        </span>
        <Button variant="secondary" size="icon-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <Button variant="secondary" size="icon-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  )
}
