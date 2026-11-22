import { useState, type FormEvent, type ReactNode, type ChangeEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Logo } from '../components/layout/Header'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Form'
import { useLogin, useRegister, useSession } from '../hooks/useSession'
import { errorMessage, fieldErrors } from '../lib/utils'

const AUTH_IMAGE = 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1400&q=80&auto=format&fit=crop'

/** Where to go after auth: the page the user came from, or their account. */
function useRedirectTarget() {
  const location = useLocation()
  return ((location.state as { from?: string } | null)?.from ?? '/account') as string
}

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="container-page py-10 lg:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-line bg-surface shadow-soft lg:grid-cols-2">
        <div className="relative hidden lg:block">
          <img src={AUTH_IMAGE} alt="" className="absolute inset-0 size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-10 text-canvas">
            <p className="font-display text-3xl leading-tight font-bold">“Fewer, better things — chosen with care.”</p>
          </div>
        </div>
        <div className="px-6 py-10 sm:px-12 sm:py-14">
          <Logo className="lg:hidden" />
          <h1 className="mt-6 text-4xl font-bold lg:mt-0">{title}</h1>
          <p className="mt-2 text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-sm text-muted">{footer}</p>
        </div>
      </div>
    </div>
  )
}

export function SignInPage() {
  const { user } = useSession()
  const login = useLogin()
  const navigate = useNavigate()
  const from = useRedirectTarget()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (user && !login.isSuccess) return <Navigate to={from} replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate(
      { email, password },
      {
        onSuccess: (u) => {
          toast.success(`Welcome back, ${u.name.split(' ')[0]}`)
          navigate(from, { replace: true })
        },
      },
    )
  }
  const errs = fieldErrors(login.error)

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to check out faster, track orders and see your wishlist."
      footer={
        <>
          New here?{' '}
          <Link to="/register" state={{ from }} className="font-medium text-ink underline underline-offset-4">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Email" error={errs.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />}
        </Field>
        <Field label="Password" error={errs.password}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}
        </Field>
        {login.isError && !Object.keys(errs).length && (
          <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
            {errorMessage(login.error)}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
          Sign in
        </Button>
        <p className="rounded-xl bg-sand/70 px-4 py-3 text-xs text-ink-2">
          Demo account: <span className="font-medium">demo@ecom.dev</span> / <span className="font-medium">demo1234</span>
        </p>
      </form>
    </AuthShell>
  )
}

export function RegisterPage() {
  const { user } = useSession()
  const register = useRegister()
  const navigate = useNavigate()
  const from = useRedirectTarget()
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  if (user && !register.isSuccess) return <Navigate to={from} replace />

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    register.mutate(form, {
      onSuccess: (u) => {
        toast.success(`Welcome, ${u.name.split(' ')[0]}! Your account is ready.`)
        navigate(from, { replace: true })
      },
    })
  }
  const errs = fieldErrors(register.error)

  return (
    <AuthShell
      title="Create an account"
      subtitle="Join for faster checkout, order tracking and a wishlist that follows you."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/signin" state={{ from }} className="font-medium text-ink underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Full name" error={errs.name}>
          {(p) => <Input {...p} autoComplete="name" value={form.name} onChange={set('name')} required />}
        </Field>
        <Field label="Email" error={errs.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={form.email} onChange={set('email')} required />}
        </Field>
        <Field label="Password" error={errs.password} hint="At least 8 characters">
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} required minLength={8} />}
        </Field>
        {register.isError && !Object.keys(errs).length && (
          <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
            {errorMessage(register.error)}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={register.isPending}>
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
