import { Loader2, LogOut, ShieldAlert } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useLogout, useSession } from '../../hooks/useAuth'
import { Button } from '../ui/button'
import { FullPageCenter } from './AppShell'

/** Only lets ADMIN users through; everyone else goes to sign-in or sees a no-access screen. */
export function AuthGate() {
  const { data: user, isPending, isError, refetch } = useSession()
  const logout = useLogout()
  const location = useLocation()

  if (isPending) {
    return (
      <FullPageCenter>
        <Loader2 className="size-5 animate-spin text-muted" />
      </FullPageCenter>
    )
  }

  if (isError) {
    return (
      <FullPageCenter>
        <div className="text-center">
          <p className="text-sm font-semibold">Can't reach the API</p>
          <p className="mt-1 text-[13px] text-muted">Make sure the API server is running on port 4000.</p>
          <Button className="mt-4" variant="secondary" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </FullPageCenter>
    )
  }

  if (!user) {
    const next = location.pathname + location.search
    return <Navigate to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} replace />
  }

  if (user.role !== 'ADMIN') {
    return (
      <FullPageCenter>
        <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning-soft-fg">
            <ShieldAlert className="size-6" />
          </div>
          <h1 className="text-lg font-semibold">No admin access</h1>
          <p className="mt-1.5 text-sm text-muted">
            You're signed in as <span className="font-medium text-fg">{user.email}</span>, which isn't an admin account.
          </p>
          <Button className="mt-6 w-full" variant="secondary" icon={<LogOut />} loading={logout.isPending} onClick={() => logout.mutate()}>
            Sign out and switch account
          </Button>
        </div>
      </FullPageCenter>
    )
  }

  return <Outlet />
}
