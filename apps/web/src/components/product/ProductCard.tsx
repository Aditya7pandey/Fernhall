import { discountPercent, type ProductDTO } from '@ecom/shared'
import { Heart, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { cartDrawer, useAddToCart } from '../../hooks/useCart'
import { useToggleWishlist, useWishlistIds } from '../../hooks/useWishlist'
import { cn, imageUrl } from '../../lib/utils'
import { Badge, Price, Skeleton, Stars } from '../ui/misc'

export function ProductCard({ product, className }: { product: ProductDTO; className?: string }) {
  const wishlist = useWishlistIds()
  const toggleWishlist = useToggleWishlist()
  const addToCart = useAddToCart()
  const saved = wishlist.has(product.id)
  const off = discountPercent(product.priceCents, product.compareAtPriceCents)
  const soldOut = product.stock === 0
  const [primary, secondary] = product.images

  return (
    <article className={cn('group relative flex flex-col', className)}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
        <Link to={`/product/${product.slug}`} className="absolute inset-0" aria-label={product.name}>
          {primary && (
            <img
              src={imageUrl(primary, 640)}
              alt={product.name}
              loading="lazy"
              className={cn(
                'size-full object-cover transition-all duration-700 ease-out group-hover:scale-[1.04]',
                secondary && 'group-hover:opacity-0',
                soldOut && 'opacity-70 grayscale-[30%]',
              )}
            />
          )}
          {secondary && (
            <img
              src={imageUrl(secondary, 640)}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            />
          )}
        </Link>

        <div className="pointer-events-none absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {soldOut ? (
            <Badge tone="dark">Sold out</Badge>
          ) : off ? (
            <Badge tone="accent">−{off}%</Badge>
          ) : product.stock <= 5 ? (
            <Badge className="bg-surface/90 backdrop-blur">Only {product.stock} left</Badge>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => toggleWishlist(product.id, saved)}
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
          aria-pressed={saved}
          className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-surface/90 text-ink shadow-sm backdrop-blur transition hover:scale-105"
        >
          <Heart className={cn('size-4 transition', saved && 'fill-hot text-hot')} />
        </button>

        {!soldOut && (
          <button
            type="button"
            onClick={() =>
              addToCart.mutate({ productId: product.id }, { onSuccess: () => cartDrawer.set(true) })
            }
            disabled={addToCart.isPending}
            className="absolute inset-x-3 bottom-3 flex h-11 translate-y-2 items-center justify-center gap-2 rounded-full bg-surface/95 text-sm font-medium text-ink opacity-0 shadow-soft backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 hover:bg-ink hover:text-canvas focus-visible:translate-y-0 focus-visible:opacity-100 max-md:hidden"
          >
            <Plus className="size-4" /> {addToCart.isPending ? 'Adding…' : 'Quick add'}
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-1">
        {product.category && <p className="eyebrow">{product.category.name}</p>}
        <h3 className="font-sans text-[15px] leading-snug font-medium tracking-normal">
          <Link to={`/product/${product.slug}`} className="hover:underline hover:underline-offset-4">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1">
          <Price cents={product.priceCents} compareAt={product.compareAtPriceCents} />
          {product.ratingCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Stars rating={product.ratingAvg} size={12} />
              <span>({product.ratingCount})</span>
            </span>
          )}
        </div>
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[4/5] rounded-2xl" />
      <Skeleton className="mt-4 h-3 w-16" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-3 h-4 w-20" />
    </div>
  )
}

export function ProductGrid({
  products,
  loading,
  skeletons = 8,
  className,
}: {
  products?: ProductDTO[]
  loading?: boolean
  skeletons?: number
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4', className)}>
      {loading
        ? Array.from({ length: skeletons }, (_, i) => <ProductCardSkeleton key={i} />)
        : products?.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  )
}
