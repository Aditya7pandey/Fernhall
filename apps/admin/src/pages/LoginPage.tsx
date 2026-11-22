import { ArrowRight, Check, ShoppingBag } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { Button } from '../components/ui/button'
import { Field, Input } from '../components/ui/input'
import { useLogin, useSession } from '../hooks/useAuth'
import { errorMessage } from '../lib/utils'

export default function LoginPage() {
  const { data: user } = useSession()
  const login = useLogin()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const next = params.get('next') || '/'

  if (user?.role === 'ADMIN') return <Navigate to={next} replace />

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate({ email, password }, { onSuccess: () => navigate(next, { replace: true }) })
  }

  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[1fr_1.1fr]">
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-[oklch(0.5_0.2_300)] text-white shadow-xs">
              <ShoppingBag className="size-[18px]" strokeWidth={2.4} />
            </div>
            <span className="text-base font-semibold">Fernhall Admin</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted">Sign in to manage your store.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@ecom.dev"
                className="h-10"
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10"
              />
            </Field>
            {login.isError && (
              <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-[13px] text-danger-soft-fg">
                {errorMessage(login.error)}
              </p>
            )}
            <Button type="submit" className="h-10 w-full" loading={login.isPending}>
              Sign in <ArrowRight />
            </Button>
          </form>

          <p className="mt-8 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-muted">
            Demo: <span className="font-mono text-fg">admin@ecom.dev</span> / <span className="font-mono text-fg">admin1234</span>
          </p>
        </div>
      </div>

      <div className="relative hidden overflow-hidden lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,oklch(0.55_0.21_277)_0%,oklch(0.35_0.15_290)_45%,oklch(0.18_0.04_280)_100%)]" />
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <div className="mb-10 grid max-w-md gap-3">
            {[
              ['Live dashboard', 'Revenue, orders and stock at a glance'],
              ['Fulfilment flow', 'Move orders from paid to delivered'],
              ['Catalog & promotions', 'Products, categories and coupons'],
            ].map(([title, sub]) => (
              <div key={title} className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/10 px-5 py-3.5 backdrop-blur-md">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <Check className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-white/60">{sub}</p>
                </div>
              </div>
            ))}
          </div>
          <h2 className="max-w-md text-3xl font-semibold tracking-tight">Everything your store needs, in one calm place.</h2>
          <p className="mt-3 max-w-md text-white/70">Orders, catalog, customers and promotions — with live numbers that tell you what to do next.</p>
        </div>
      </div>
    </div>
  )
}
