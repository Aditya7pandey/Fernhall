import { ShoppingBag, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { cartDrawer, useCart } from '../../hooks/useCart'
import { CartLine, CouponForm, FreeShippingBar, TotalsList } from '../cart/CartParts'
import { ButtonLink } from '../ui/Button'
import { EmptyState, Skeleton } from '../ui/misc'

export function CartDrawer() {
  const open = cartDrawer.use()
  const close = () => cartDrawer.set(false)
  const { data: cart, isLoading } = useCart()
  const location = useLocation()

  // Close on navigation and on Escape
  useEffect(close, [location.pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shopping bag">
          <motion.div
            className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.aside
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-canvas shadow-lift"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
          >
            <header className="flex items-center justify-between border-b border-line px-6 py-5">
              <h2 className="text-2xl">
                Your bag {cart && cart.itemCount > 0 && <span className="font-sans text-base text-muted">({cart.itemCount})</span>}
              </h2>
              <button type="button" onClick={close} className="grid size-10 place-items-center rounded-full hover:bg-sand" aria-label="Close bag">
                <X className="size-5" />
              </button>
            </header>

            {isLoading ? (
              <div className="space-y-4 p-6">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : !cart || cart.items.length === 0 ? (
              <EmptyState
                className="my-auto"
                icon={<ShoppingBag className="size-7" />}
                title="Your bag is empty"
                action={
                  <ButtonLink to="/shop" onClick={close}>
                    Start shopping
                  </ButtonLink>
                }
              >
                Discover pieces made to be lived with.
              </EmptyState>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-6">
                  <div className="pt-5">
                    <FreeShippingBar subtotalCents={cart.totals.subtotalCents} />
                  </div>
                  <ul className="divide-y divide-line">
                    {cart.items.map((item) => (
                      <CartLine key={item.id} item={item} compact onNavigate={close} />
                    ))}
                  </ul>
                </div>
                <footer className="space-y-4 border-t border-line bg-surface px-6 pt-5 pb-6">
                  <CouponForm cart={cart} />
                  <TotalsList totals={cart.totals} shippingPending />
                  <div className="grid grid-cols-2 gap-3">
                    <ButtonLink to="/cart" variant="outline" onClick={close}>
                      View bag
                    </ButtonLink>
                    <ButtonLink to="/checkout" onClick={close}>
                      Checkout
                    </ButtonLink>
                  </div>
                </footer>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
