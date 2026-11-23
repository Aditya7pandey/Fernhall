import { formatPrice } from '@ecom/shared'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight, Leaf, RotateCcw, ShieldCheck, Truck } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { useCategories } from '../hooks/useCategories'
import { ProductCard, ProductCardSkeleton, ProductGrid } from '../components/product/ProductCard'
import { ProductRail } from '../components/product/ProductRail'
import { Reveal, SectionHeading } from '../components/Reveal'
import { ButtonLink } from '../components/ui/Button'
import { Skeleton } from '../components/ui/misc'
import { api } from '../lib/api'
import { qk } from '../lib/query'
import { imageUrl } from '../lib/utils'

const HERO_IMAGE = 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1600&q=80&auto=format&fit=crop'
const EDITORIAL_IMAGE = 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=2000&q=80&auto=format&fit=crop'
const STORY_IMAGE = 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200&q=80&auto=format&fit=crop'

const ease = [0.22, 1, 0.36, 1] as const

export function HomePage() {
  const featured = useQuery({
    queryKey: qk.products({ featured: true, pageSize: 8 }),
    queryFn: () => api.products.list({ featured: true, pageSize: 8, sort: 'rating' }),
  })
  const sale = useQuery({
    queryKey: qk.products({ onSale: true, pageSize: 10 }),
    queryFn: () => api.products.list({ onSale: true, pageSize: 10 }),
  })
  const newest = useQuery({
    queryKey: qk.products({ sort: 'newest', pageSize: 4 }),
    queryFn: () => api.products.list({ sort: 'newest', pageSize: 4 }),
  })
  const { data: categories, isLoading: catsLoading } = useCategories()
  const heroProduct = featured.data?.items[0]

  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="container-page pt-6 pb-16 lg:pt-10 lg:pb-24">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <motion.p
              className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-pop px-3.5 py-1.5 text-xs font-semibold text-ink"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <span className="size-1.5 animate-pulse rounded-full bg-ink" /> New drops every week
            </motion.p>
            <motion.h1
              className="text-[2.9rem] leading-[1.02] font-bold sm:text-6xl xl:text-[5.2rem]"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease }}
            >
              Fresh finds for <span className="text-gradient">every vibe</span>.
            </motion.h1>
            <motion.p
              className="mt-6 max-w-md text-lg leading-relaxed text-ink-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.15, ease }}
            >
              Fashion, tech, home and beauty you'll actually want — with free shipping over ₹2,999 and free 30-day returns.
            </motion.p>
            <motion.div
              className="mt-9 flex flex-wrap gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.25, ease }}
            >
              <ButtonLink to="/shop" size="lg">
                Shop now <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink to="/shop?onSale=true" size="lg" variant="outline">
                Shop the sale
              </ButtonLink>
            </motion.div>
            <div className="mt-12 flex items-center gap-8 text-sm text-muted">
              <div>
                <p className="font-display text-3xl text-ink">{categories ? categories.reduce((n, c) => n + c.productCount, 0) : '—'}</p>
                <p>Curated pieces</p>
              </div>
              <div className="h-10 w-px bg-line" />
              <div>
                <p className="font-display text-3xl text-ink">30-day</p>
                <p>Free returns</p>
              </div>
            </div>
          </div>

          <motion.div
            className="relative lg:col-span-7"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.1, ease }}
          >
            <div aria-hidden className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] bg-brand-gradient opacity-30 blur-3xl" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-sand sm:aspect-[5/4] lg:aspect-[4/4.2]">
              <img src={HERO_IMAGE} alt="Inside a bright, minimal clothing boutique" className="size-full object-cover" fetchPriority="high" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/30 via-transparent to-transparent" />
            </div>
            {heroProduct && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6, ease }}
                className="absolute bottom-5 left-5 sm:bottom-8 sm:left-8"
              >
                <Link
                  to={`/product/${heroProduct.slug}`}
                  className="flex max-w-[300px] items-center gap-3 rounded-2xl bg-surface/90 p-2.5 pr-4 shadow-lift backdrop-blur transition hover:bg-surface"
                >
                  <img src={imageUrl(heroProduct.images[0], 160)} alt="" className="size-14 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="eyebrow text-[10px]">Editor's pick</p>
                    <p className="truncate text-sm font-medium">{heroProduct.name}</p>
                    <p className="text-sm text-muted">{formatPrice(heroProduct.priceCents)}</p>
                  </div>
                  <ArrowUpRight className="size-4 shrink-0" />
                </Link>
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ─── Value props ──────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface/60">
        <div className="container-page grid grid-cols-2 gap-6 py-8 lg:grid-cols-4">
          {[
            { icon: Truck, title: 'Free shipping', text: 'On orders over ₹2,999' },
            { icon: RotateCcw, title: 'Free returns', text: '30 days, no questions' },
            { icon: ShieldCheck, title: 'Secure checkout', text: 'Your data, protected' },
            { icon: Leaf, title: 'Made to last', text: 'Responsibly sourced' },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-sand">
                <Icon className="size-5" strokeWidth={1.6} />
              </div>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-sm text-muted">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Categories ───────────────────────────────────────────────────── */}
      <section className="container-page py-20 lg:py-28">
        <Reveal>
          <SectionHeading
            eyebrow="Shop by category"
            title={
              <>
                Find your <span className="text-gradient">thing</span>
              </>
            }
            action={
              <Link to="/shop" className="hidden items-center gap-2 text-sm font-medium underline-offset-4 hover:underline sm:flex">
                View everything <ArrowRight className="size-4" />
              </Link>
            }
          />
        </Reveal>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {catsLoading
            ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />)
            : categories?.map((c, i) => (
                <Reveal key={c.id} delay={(i % 3) * 0.08}>
                  <Link
                    to={`/category/${c.slug}`}
                    className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-sand sm:aspect-[4/3]"
                  >
                    {c.imageUrl && (
                      <img
                        src={imageUrl(c.imageUrl, 900)}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-105"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-canvas sm:p-6">
                      <div>
                        <h3 className="text-xl sm:text-3xl">{c.name}</h3>
                        <p className="mt-1 text-xs text-canvas/80 sm:text-sm">{c.productCount} pieces</p>
                      </div>
                      <span className="hidden size-11 place-items-center rounded-full bg-canvas text-ink transition-transform duration-300 group-hover:rotate-45 sm:grid">
                        <ArrowUpRight className="size-5" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
        </div>
      </section>

      {/* ─── Featured ─────────────────────────────────────────────────────── */}
      <section className="container-page pb-20 lg:pb-28">
        <Reveal>
          <SectionHeading
            eyebrow="Editor's picks"
            title="Pieces we keep reaching for"
            action={
              <Link to="/shop?featured=true" className="hidden items-center gap-2 text-sm font-medium underline-offset-4 hover:underline sm:flex">
                Shop picks <ArrowRight className="size-4" />
              </Link>
            }
          />
        </Reveal>
        <ProductGrid products={featured.data?.items} loading={featured.isLoading} />
      </section>

      {/* ─── Editorial banner ─────────────────────────────────────────────── */}
      <section className="container-page">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-ink">
            <img src={EDITORIAL_IMAGE} alt="A calm living room with natural light" loading="lazy" className="absolute inset-0 size-full object-cover opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-r from-ink/80 via-ink/40 to-transparent" />
            <div className="relative max-w-xl px-6 py-20 text-canvas sm:px-12 sm:py-28 lg:px-16 lg:py-36">
              <p className="mb-4 text-[11px] font-medium tracking-[0.18em] text-canvas/70 uppercase">The home edit</p>
              <h2 className="text-4xl leading-[1.05] font-bold sm:text-6xl">
                Slow mornings, <span className="text-pop">softer</span> spaces.
              </h2>
              <p className="mt-5 max-w-sm text-canvas/80">
                Velvet, oak and warm light — furniture and objects for rooms you'll want to linger in.
              </p>
              <ButtonLink to="/category/home-living" variant="secondary" size="lg" className="mt-8 bg-canvas">
                Explore Home & Living <ArrowRight className="size-4" />
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ─── Sale rail ────────────────────────────────────────────────────── */}
      {(sale.isLoading || (sale.data?.items.length ?? 0) > 0) && (
        <section className="container-page py-20 lg:py-28">
          <Reveal>
            <SectionHeading
              eyebrow="Limited time"
              title={
                <>
                  On sale <span className="text-gradient">now</span>
                </>
              }
            />
          </Reveal>
          <ProductRail products={sale.data?.items} loading={sale.isLoading} label="Products on sale" />
        </section>
      )}

      {/* ─── New arrivals (story tile + 3 products) ───────────────────────── */}
      <section className="container-page pb-8">
        <Reveal>
          <SectionHeading
            eyebrow="New arrivals"
            title="Just in"
            action={
              <Link to="/shop?sort=newest" className="hidden items-center gap-2 text-sm font-medium underline-offset-4 hover:underline sm:flex">
                See what's new <ArrowRight className="size-4" />
              </Link>
            }
          />
        </Reveal>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-4">
          <Reveal className="col-span-2 lg:col-span-1">
            <Link to="/shop?sort=newest" className="group relative block aspect-[4/3] overflow-hidden rounded-2xl bg-ink lg:aspect-[4/5]">
              <img
                src={STORY_IMAGE}
                alt="A shopper carrying bags in a city street"
                loading="lazy"
                className="size-full object-cover opacity-90 transition-transform duration-[1.2s] group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-canvas">
                <p className="text-[11px] font-medium tracking-[0.18em] text-canvas/70 uppercase">Every week</p>
                <p className="mt-2 font-display text-3xl leading-tight font-bold">Fresh arrivals, quietly added.</p>
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium">
                  Shop new in <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </Reveal>
          {newest.isLoading
            ? Array.from({ length: 3 }, (_, i) => <ProductCardSkeleton key={i} />)
            : newest.data?.items.map((p, i) => <ProductCard key={p.id} product={p} className={i === 3 ? 'lg:hidden' : undefined} />)}
        </div>
      </section>
    </>
  )
}
