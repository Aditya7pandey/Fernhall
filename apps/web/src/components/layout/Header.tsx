import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import { cartDrawer, useCart } from '../../hooks/useCart'
import { useSession } from '../../hooks/useSession'
import { useCategories } from '../../hooks/useCategories'
import { cn, STORE_NAME } from '../../lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('font-display text-[26px] leading-none font-medium tracking-tight', className)} aria-label={`${STORE_NAME} home`}>
      {STORE_NAME}
      <span className="text-hot">.</span>
    </Link>
  )
}

const iconBtn = 'relative grid size-10 place-items-center rounded-full text-ink transition hover:bg-sand'

export function Header() {
  const { data: categories } = useCategories()
  const { data: cart } = useCart()
  const { user } = useSession()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  // Close overlays when the route changes (state adjusted during render, not in an effect)
  const routeKey = location.pathname + location.search
  const [lastRoute, setLastRoute] = useState(routeKey)
  if (routeKey !== lastRoute) {
    setLastRoute(routeKey)
    setMenuOpen(false)
    setSearchOpen(false)
  }

  const count = cart?.itemCount ?? 0
  const navLink = ({ isActive }: { isActive: boolean }) =>
    cn('relative py-2 text-sm whitespace-nowrap text-ink-2 transition hover:text-ink', isActive && 'text-accent after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent')

  return (
    <>
      <div className="bg-brand-gradient px-4 py-2 text-center text-xs font-medium tracking-wide text-white">
        Free standard shipping on orders over $75 · Free 30-day returns
      </div>
      <header
        className={cn(
          'sticky top-0 z-40 border-b transition-all duration-300',
          scrolled ? 'border-line bg-canvas/85 backdrop-blur-xl' : 'border-transparent bg-canvas',
        )}
      >
        <div className="container-page flex h-16 items-center gap-4 lg:h-20">
          <div className="flex flex-1 items-center gap-8">
            <button type="button" className={cn(iconBtn, '-ml-2 lg:hidden')} onClick={() => setMenuOpen(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <nav className="hidden items-center gap-6 lg:flex xl:gap-7" aria-label="Main">
              <NavLink to="/shop" end className={navLink}>
                Shop all
              </NavLink>
              {categories?.map((c, i) => (
                <NavLink key={c.id} to={`/category/${c.slug}`} className={(s) => cn(navLink(s), i >= 4 && 'hidden 2xl:block')}>
                  {c.name}
                </NavLink>
              ))}
              <NavLink to="/shop?onSale=true" className="py-2 text-sm text-accent transition hover:text-accent-hover">
                Sale
              </NavLink>
            </nav>
          </div>

          <Logo />

          <div className="flex flex-1 items-center justify-end gap-0.5 sm:gap-1">
            <button type="button" className={iconBtn} onClick={() => setSearchOpen(true)} aria-label="Search">
              <Search className="size-[19px]" />
            </button>
            <Link to={user ? '/account' : '/signin'} className={cn(iconBtn, 'hidden sm:grid')} aria-label={user ? 'Your account' : 'Sign in'}>
              <User className="size-[19px]" />
            </Link>
            <Link to="/account/wishlist" className={cn(iconBtn, 'hidden sm:grid')} aria-label="Wishlist">
              <Heart className="size-[19px]" />
            </Link>
            <button type="button" className={iconBtn} onClick={() => cartDrawer.set(true)} aria-label={`Shopping bag, ${count} items`}>
              <ShoppingBag className="size-[19px]" />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute top-0.5 right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}

function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: categories } = useCategories()

  useEffect(() => {
    if (!open) return
    setTimeout(() => inputRef.current?.focus(), 50)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!q.trim()) return
    navigate(`/shop?q=${encodeURIComponent(q.trim())}`)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Search">
          <motion.div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="relative bg-canvas shadow-lift"
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 340 }}
          >
            <div className="container-page py-8 lg:py-12">
              <form onSubmit={submit} className="flex items-center gap-4 border-b-2 border-ink pb-3">
                <Search className="size-6 shrink-0 text-muted" />
                <label htmlFor="site-search" className="sr-only">
                  Search products
                </label>
                <input
                  ref={inputRef}
                  id="site-search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search for jackets, lamps, headphones…"
                  className="min-w-0 flex-1 bg-transparent font-display text-2xl placeholder:text-subtle focus:outline-none sm:text-4xl"
                />
                <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-sand" aria-label="Close search">
                  <X className="size-5" />
                </button>
              </form>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="eyebrow mr-2">Popular</span>
                {['Leather', 'Headphones', 'Sneakers', 'Lamp', 'Watch'].map((term) => (
                  <Link key={term} to={`/shop?q=${term.toLowerCase()}`} onClick={onClose} className="rounded-full border border-line px-4 py-1.5 text-sm hover:border-ink/40">
                    {term}
                  </Link>
                ))}
                {categories?.slice(0, 3).map((c) => (
                  <Link key={c.id} to={`/category/${c.slug}`} onClick={onClose} className="rounded-full bg-sand px-4 py-1.5 text-sm hover:bg-sand-2">
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: categories } = useCategories()
  const { user } = useSession()
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <motion.div className="absolute inset-0 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.nav
            className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col bg-canvas"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Logo />
              <button type="button" onClick={onClose} className={iconBtn} aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <p className="eyebrow mb-3">Shop</p>
              <ul className="space-y-1">
                <li>
                  <Link to="/shop" className="block py-2 font-display text-2xl">
                    Shop all
                  </Link>
                </li>
                {categories?.map((c) => (
                  <li key={c.id}>
                    <Link to={`/category/${c.slug}`} className="block py-2 font-display text-2xl">
                      {c.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link to="/shop?onSale=true" className="block py-2 font-display text-2xl text-accent">
                    Sale
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-1 border-t border-line px-5 py-5 text-sm">
              <Link to={user ? '/account' : '/signin'} className="flex items-center gap-3 py-2">
                <User className="size-4" /> {user ? `Hi, ${user.name.split(' ')[0]}` : 'Sign in / Register'}
              </Link>
              <Link to="/account/wishlist" className="flex items-center gap-3 py-2">
                <Heart className="size-4" /> Wishlist
              </Link>
            </div>
          </motion.nav>
        </div>
      )}
    </AnimatePresence>
  )
}
