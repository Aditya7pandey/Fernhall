import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { STORE_NAME } from '../../lib/utils'
import { useCategories } from '../../hooks/useCategories'
import { Logo } from './Header'

const YEAR = new Date().getFullYear()

export function Footer() {
  const { data: categories } = useCategories()
  const [email, setEmail] = useState('')

  // UI-only newsletter signup (no backend yet)
  const subscribe = (e: FormEvent) => {
    e.preventDefault()
    toast.success("You're on the list — welcome!")
    setEmail('')
  }

  return (
    <footer className="mt-24 bg-ink text-canvas">
      <div className="container-page grid gap-12 py-16 lg:grid-cols-12 lg:py-20">
        <div className="lg:col-span-5">
          <h2 className="max-w-md text-3xl leading-tight font-bold sm:text-4xl">
            Get first dibs on new drops and <span className="text-pop">secret sales</span>.
          </h2>
          <form onSubmit={subscribe} className="mt-8 flex max-w-md items-center border-b border-canvas/30 pb-2 focus-within:border-canvas">
            <label htmlFor="newsletter" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px] placeholder:text-canvas/50 focus:outline-none"
            />
            <button type="submit" className="grid size-10 place-items-center rounded-full transition hover:bg-canvas/10" aria-label="Subscribe">
              <ArrowRight className="size-5" />
            </button>
          </form>
          <p className="mt-3 text-xs text-canvas/50">No spam. Unsubscribe any time.</p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-6 lg:col-start-7">
          <FooterCol title="Shop">
            <FooterLink to="/shop">Shop all</FooterLink>
            {categories?.map((c) => (
              <FooterLink key={c.id} to={`/category/${c.slug}`}>
                {c.name}
              </FooterLink>
            ))}
          </FooterCol>
          <FooterCol title="Account">
            <FooterLink to="/account">My account</FooterLink>
            <FooterLink to="/account/orders">Orders</FooterLink>
            <FooterLink to="/account/wishlist">Wishlist</FooterLink>
            <FooterLink to="/cart">Bag</FooterLink>
          </FooterCol>
          <FooterCol title="Help">
            <li className="text-canvas/60">Shipping & delivery</li>
            <li className="text-canvas/60">Returns & exchanges</li>
            <li className="text-canvas/60">Care guides</li>
            <li className="text-canvas/60">Contact us</li>
          </FooterCol>
        </div>
      </div>
      <div className="border-t border-canvas/10">
        <div className="container-page flex flex-col items-center justify-between gap-4 py-6 sm:flex-row">
          <Logo className="text-xl text-canvas" />
          <p className="text-xs text-canvas/50">
            © {YEAR} {STORE_NAME}. Considered goods for everyday living.
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-4 font-sans text-[11px] font-medium tracking-[0.18em] text-canvas/50 uppercase">{title}</h3>
      <ul className="space-y-2.5 text-sm">{children}</ul>
    </div>
  )
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="text-canvas/80 transition hover:text-canvas">
        {children}
      </Link>
    </li>
  )
}
