import { ArrowRight, Lock, ShoppingBag } from 'lucide-react'
import { CartLine, CouponForm, FreeShippingBar, TotalsList } from '../components/cart/CartParts'
import { ButtonLink } from '../components/ui/Button'
import { Card, EmptyState, Skeleton } from '../components/ui/misc'
import { useCart } from '../hooks/useCart'

export function CartPage() {
  const { data: cart, isLoading } = useCart()
  const blocked = cart?.items.some((i) => !i.available)

  return (
    <div className="container-page py-10 lg:py-16">
      <h1 className="text-4xl font-bold sm:text-5xl">
        Your bag {cart && cart.itemCount > 0 && <span className="font-sans text-lg text-muted">({cart.itemCount} items)</span>}
      </h1>

      {isLoading ? (
        <div className="mt-10 grid gap-10 lg:grid-cols-12">
          <Skeleton className="h-80 lg:col-span-8" />
          <Skeleton className="h-80 lg:col-span-4" />
        </div>
      ) : !cart || cart.items.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<ShoppingBag className="size-7" />}
          title="Your bag is empty"
          action={<ButtonLink to="/shop">Start shopping</ButtonLink>}
        >
          Looks like you haven't added anything yet. Let's change that.
        </EmptyState>
      ) : (
        <div className="mt-10 grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7 xl:col-span-8">
            <FreeShippingBar subtotalCents={cart.totals.subtotalCents} />
            <ul className="mt-2 divide-y divide-line border-b border-line">
              {cart.items.map((item) => (
                <CartLine key={item.id} item={item} />
              ))}
            </ul>
          </div>

          <Card className="p-6 lg:sticky lg:top-28 lg:col-span-5 xl:col-span-4">
            <h2 className="text-2xl">Order summary</h2>
            <div className="mt-6">
              <CouponForm cart={cart} />
            </div>
            <TotalsList totals={cart.totals} shippingLabel="Shipping (standard)" className="mt-6" />
            {blocked && (
              <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
                Some items are unavailable. Update your bag to continue.
              </p>
            )}
            <ButtonLink
              to="/checkout"
              size="lg"
              className="mt-6 w-full"
              aria-disabled={blocked}
              onClick={(e) => blocked && e.preventDefault()}
            >
              Checkout <ArrowRight className="size-4" />
            </ButtonLink>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
              <Lock className="size-3.5" /> Secure checkout · Free 30-day returns
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
