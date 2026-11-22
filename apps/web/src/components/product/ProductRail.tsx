import type { ProductDTO } from '@ecom/shared'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useRef } from 'react'
import { ProductCard, ProductCardSkeleton } from './ProductCard'

/** Horizontally scrolling product row with arrow controls. */
export function ProductRail({ products, loading, label }: { products?: ProductDTO[]; loading?: boolean; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <div className="relative">
      <div className="absolute -top-16 right-0 hidden gap-2 md:flex">
        <button
          type="button"
          onClick={() => scroll(-1)}
          className="grid size-10 place-items-center rounded-full border border-line bg-surface transition hover:border-ink/40"
          aria-label={`Scroll ${label} left`}
        >
          <ArrowLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => scroll(1)}
          className="grid size-10 place-items-center rounded-full border border-line bg-surface transition hover:border-ink/40"
          aria-label={`Scroll ${label} right`}
        >
          <ArrowRight className="size-4" />
        </button>
      </div>
      <div
        ref={ref}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 sm:-mx-6 sm:gap-6 sm:px-6 lg:mx-0 lg:px-0"
        aria-label={label}
      >
        {(loading ? Array.from({ length: 5 }) : (products ?? [])).map((p, i) => (
          <div key={p ? (p as ProductDTO).id : i} className="w-[68%] shrink-0 snap-start sm:w-[40%] lg:w-[calc((100%-4.5rem)/4)]">
            {p ? <ProductCard product={p as ProductDTO} /> : <ProductCardSkeleton />}
          </div>
        ))}
      </div>
    </div>
  )
}
