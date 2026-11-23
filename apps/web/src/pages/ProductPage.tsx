import { discountPercent, formatDate, type ProductDetail } from '@ecom/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Heart, RotateCcw, ShieldCheck, Star, Truck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { toast } from 'sonner'
import { ProductGrid } from '../components/product/ProductCard'
import { Reveal, SectionHeading } from '../components/Reveal'
import { Button, ButtonLink } from '../components/ui/Button'
import { Field, Input, Textarea } from '../components/ui/Form'
import { Badge, EmptyState, Price, QuantityStepper, Skeleton, Stars } from '../components/ui/misc'
import { cartDrawer, useAddToCart } from '../hooks/useCart'
import { useSession } from '../hooks/useSession'
import { useToggleWishlist, useWishlistIds } from '../hooks/useWishlist'
import { api } from '../lib/api'
import { qk } from '../lib/query'
import { cn, errorMessage, imageUrl } from '../lib/utils'
import { NotFoundPage } from './NotFoundPage'

export function ProductPage() {
  const { slug = '' } = useParams()
  const { data: product, isLoading, error } = useQuery({ queryKey: qk.product(slug), queryFn: () => api.products.get(slug) })

  if (isLoading) return <ProductSkeleton />
  if (error || !product) return <NotFoundPage title="Product not found" />
  return <ProductView key={product.id} product={product} />
}

function ProductView({ product }: { product: ProductDetail }) {
  const [active, setActive] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const addToCart = useAddToCart()
  const wishlist = useWishlistIds()
  const toggleWishlist = useToggleWishlist()
  const saved = wishlist.has(product.id)
  const off = discountPercent(product.priceCents, product.compareAtPriceCents)
  const soldOut = product.stock === 0
  const images = product.images.length ? product.images : [null]

  const add = () =>
    addToCart.mutate(
      { productId: product.id, quantity },
      {
        onSuccess: () => {
          cartDrawer.set(true)
          setQuantity(1)
        },
      },
    )

  return (
    <>
      <div className="container-page pt-6 pb-20 lg:pt-10">
        <nav aria-label="Breadcrumb" className="mb-6 truncate text-sm text-muted">
          <Link to="/" className="hover:text-ink">Home</Link>
          <span className="mx-2">/</span>
          {product.category && (
            <>
              <Link to={`/category/${product.category.slug}`} className="hover:text-ink">
                {product.category.name}
              </Link>
              <span className="mx-2">/</span>
            </>
          )}
          <span className="text-ink">{product.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          {/* Gallery */}
          <div className="lg:col-span-7">
            <div className="flex flex-col-reverse gap-4 sm:flex-row">
              {images.length > 1 && (
                <div className="scrollbar-none flex gap-3 overflow-x-auto sm:flex-col">
                  {images.map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setActive(i)}
                      className={cn(
                        'size-20 shrink-0 overflow-hidden rounded-xl bg-sand ring-offset-2 ring-offset-canvas transition',
                        active === i ? 'ring-2 ring-ink' : 'opacity-70 hover:opacity-100',
                      )}
                      aria-label={`View image ${i + 1}`}
                    >
                      {src && <img src={imageUrl(src, 200)} alt="" className="size-full object-cover" />}
                    </button>
                  ))}
                </div>
              )}
              <div className="group relative aspect-[4/5] flex-1 overflow-hidden rounded-3xl bg-sand">
                <AnimatePresence mode="wait">
                  {images[active] && (
                    <motion.img
                      key={active}
                      src={imageUrl(images[active], 1400)}
                      alt={product.name}
                      className="size-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </AnimatePresence>
                <div className="absolute top-4 left-4 flex gap-2">
                  {off && <Badge tone="accent">−{off}%</Badge>}
                  {product.featured && <Badge className="bg-surface/90 backdrop-blur">Editor's pick</Badge>}
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              {product.category && <p className="eyebrow mb-3">{product.category.name}</p>}
              <h1 className="text-4xl leading-tight font-bold sm:text-5xl">{product.name}</h1>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                <Price cents={product.priceCents} compareAt={product.compareAtPriceCents} size="lg" />
                {product.ratingCount > 0 && (
                  <a href="#reviews" className="flex items-center gap-2 text-sm text-muted hover:text-ink">
                    <Stars rating={product.ratingAvg} />
                    <span>
                      {product.ratingAvg.toFixed(1)} · {product.ratingCount} {product.ratingCount === 1 ? 'review' : 'reviews'}
                    </span>
                  </a>
                )}
              </div>

              <p className="mt-6 leading-relaxed text-ink-2">{product.description}</p>

              <div className="mt-6">
                {soldOut ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-danger">
                    <span className="size-2 rounded-full bg-danger" /> Out of stock
                  </p>
                ) : product.stock <= 5 ? (
                  <p className="flex items-center gap-2 text-sm font-medium text-warning">
                    <span className="size-2 animate-pulse rounded-full bg-warning" /> Only {product.stock} left — order soon
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-sm font-medium text-success">
                    <span className="size-2 rounded-full bg-success" /> In stock, ready to ship
                  </p>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                {!soldOut && <QuantityStepper value={quantity} onChange={setQuantity} max={Math.min(20, product.stock)} />}
                <Button size="lg" className="h-[46px] flex-1" onClick={add} loading={addToCart.isPending} disabled={soldOut}>
                  {soldOut ? 'Sold out' : 'Add to bag'}
                </Button>
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.id, saved)}
                  className="grid size-[46px] shrink-0 place-items-center rounded-full border border-line bg-surface transition hover:border-ink/40"
                  aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                  aria-pressed={saved}
                >
                  <Heart className={cn('size-5', saved && 'fill-hot text-hot')} />
                </button>
              </div>

              <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface text-sm">
                {[
                  { icon: Truck, title: 'Free standard shipping', text: 'On orders over ₹2,999 · Express available at checkout' },
                  { icon: RotateCcw, title: 'Free 30-day returns', text: 'Changed your mind? Send it back, on us.' },
                  { icon: ShieldCheck, title: 'Secure checkout', text: 'Your details are always protected.' },
                ].map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-4 px-5 py-4">
                    <Icon className="mt-0.5 size-5 shrink-0" strokeWidth={1.6} />
                    <div>
                      <p className="font-medium">{title}</p>
                      <p className="text-muted">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {product.sku && <p className="mt-4 text-xs text-subtle">SKU {product.sku}</p>}
            </div>
          </div>
        </div>
      </div>

      <Reviews product={product} />

      {product.related.length > 0 && (
        <section className="container-page pt-20">
          <Reveal>
            <SectionHeading eyebrow="You may also like" title="Pairs well with" />
          </Reveal>
          <ProductGrid products={product.related} />
        </section>
      )}
    </>
  )
}

function Reviews({ product }: { product: ProductDetail }) {
  const { user } = useSession()
  const location = useLocation()
  const [writing, setWriting] = useState(false)
  const total = product.ratingCount
  const alreadyReviewed = user && product.reviews.some((r) => r.userId === user.id)

  return (
    <section id="reviews" className="scroll-mt-28 border-t border-line bg-surface/60">
      <div className="container-page grid gap-12 py-16 lg:grid-cols-12 lg:py-24">
        <div className="lg:col-span-4">
          <p className="eyebrow mb-3">Reviews</p>
          <h2 className="text-4xl">What people say</h2>
          {total > 0 ? (
            <>
              <div className="mt-6 flex items-end gap-4">
                <p className="font-display text-6xl leading-none">{product.ratingAvg.toFixed(1)}</p>
                <div className="pb-1">
                  <Stars rating={product.ratingAvg} size={18} />
                  <p className="mt-1 text-sm text-muted">Based on {total} reviews</p>
                </div>
              </div>
              <ul className="mt-6 space-y-2">
                {[5, 4, 3, 2, 1].map((r) => {
                  const count = product.ratingBreakdown[r] ?? 0
                  return (
                    <li key={r} className="flex items-center gap-3 text-sm">
                      <span className="w-3 text-ink-2 tabular-nums">{r}</span>
                      <Star className="size-3.5 fill-ink text-ink" />
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand-2">
                        <div className="h-full rounded-full bg-ink" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
                      </div>
                      <span className="w-6 text-right text-muted tabular-nums">{count}</span>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <p className="mt-4 text-muted">No reviews yet — be the first to share your thoughts.</p>
          )}

          <div className="mt-8">
            {user ? (
              <Button variant="outline" onClick={() => setWriting((w) => !w)}>
                {alreadyReviewed ? 'Edit your review' : 'Write a review'}
              </Button>
            ) : (
              <ButtonLink to="/signin" state={{ from: location.pathname }} variant="outline">
                Sign in to write a review
              </ButtonLink>
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          <AnimatePresence>
            {writing && user && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <ReviewForm product={product} onDone={() => setWriting(false)} />
              </motion.div>
            )}
          </AnimatePresence>
          {product.reviews.length === 0 ? (
            !writing && <EmptyState icon={<Star className="size-7" />} title="No reviews yet" className="rounded-2xl border border-dashed border-line" />
          ) : (
            <ul className="divide-y divide-line">
              {product.reviews.map((r) => (
                <li key={r.id} className="py-7 first:pt-0">
                  <div className="flex items-center justify-between gap-4">
                    <Stars rating={r.rating} />
                    <time className="text-xs text-muted" dateTime={r.createdAt}>
                      {formatDate(r.createdAt)}
                    </time>
                  </div>
                  {r.title && <h3 className="mt-3 font-sans text-base font-medium tracking-normal">{r.title}</h3>}
                  <p className="mt-2 leading-relaxed text-ink-2">{r.body}</p>
                  <p className="mt-3 flex items-center gap-2 text-sm text-muted">
                    <span className="grid size-7 place-items-center rounded-full bg-sand text-xs font-medium text-ink">{r.user.name.charAt(0)}</span>
                    {r.user.name}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

function ReviewForm({ product, onDone }: { product: ProductDetail; onDone: () => void }) {
  const { user } = useSession()
  const existing = product.reviews.find((r) => r.userId === user?.id)
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [body, setBody] = useState(existing?.body ?? '')
  const qc = useQueryClient()

  const submit = useMutation({
    mutationFn: () => api.products.review(product.id, { rating, title: title || undefined, body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.product(product.slug) })
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Thanks for your review!')
      onDone()
    },
    onError: (err) => toast.error(errorMessage(err)),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!rating) return toast.error('Please choose a star rating')
    submit.mutate()
  }

  return (
    <form onSubmit={onSubmit} className="mb-10 space-y-5 rounded-2xl border border-line bg-surface p-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-2">Your rating</legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setRating(i)}
              onMouseEnter={() => setHover(i)}
              aria-label={`${i} star${i > 1 ? 's' : ''}`}
              aria-pressed={rating === i}
              className="p-0.5"
            >
              <Star className={cn('size-7 transition', (hover || rating) >= i ? 'fill-ink text-ink' : 'text-sand-2')} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Title (optional)">{(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Sum it up" />}</Field>
      <Field label="Review">
        {(p) => <Textarea {...p} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={2000} placeholder="What did you like or dislike?" />}
      </Field>
      <div className="flex gap-3">
        <Button type="submit" loading={submit.isPending}>
          {existing ? 'Update review' : 'Post review'}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function ProductSkeleton() {
  return (
    <div className="container-page pt-16 pb-20">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <Skeleton className="aspect-[4/5] rounded-3xl lg:col-span-7" />
        <div className="space-y-4 lg:col-span-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-4/5" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-24" />
          <Skeleton className="h-12 rounded-full" />
        </div>
      </div>
    </div>
  )
}

