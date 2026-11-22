import { Heart, LayoutGrid, LogOut, MapPin, Package, UserRound } from 'lucide-react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Skeleton } from '../../components/ui/misc'
import { useLogout, useSession } from '../../hooks/useSession'
import { cn } from '../../lib/utils'

const links = [
  { to: '/account', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/account/orders', label: 'Orders', icon: Package },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin },
  { to: '/account/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/account/profile', label: 'Profile', icon: UserRound },
]

export function AccountLayout() {
  const { user, isLoading } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const logout = useLogout()

  if (isLoading) {
    return (
      <div className="container-page py-14">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="mt-10 h-80" />
      </div>
    )
  }
  if (!user) return <Navigate to="/signin" state={{ from: location.pathname }} replace />

  const signOut = () =>
    logout.mutate(undefined, {
      onSuccess: () => {
        toast.success("You've been signed out")
        navigate('/')
      },
    })

  return (
    <div className="container-page py-10 lg:py-14">
      <div className="mb-10">
        <p className="eyebrow mb-2">My account</p>
        <h1 className="text-4xl font-bold sm:text-5xl">Hello, {user.name.split(' ')[0]}</h1>
      </div>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr] lg:gap-14">
        <nav aria-label="Account" className="scrollbar-none -mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex gap-2 lg:sticky lg:top-28 lg:flex-col lg:gap-1">
            {links.map(({ to, label, icon: Icon, end }) => (
              <li key={to} className="shrink-0">
                <NavLink
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition lg:rounded-xl',
                      isActive ? 'bg-ink text-canvas' : 'text-ink-2 hover:bg-sand hover:text-ink max-lg:bg-surface max-lg:border max-lg:border-line',
                    )
                  }
                >
                  <Icon className="size-4" /> {label}
                </NavLink>
              </li>
            ))}
            <li className="shrink-0 lg:mt-4 lg:border-t lg:border-line lg:pt-4">
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm text-ink-2 transition hover:bg-sand hover:text-ink max-lg:border max-lg:border-line max-lg:bg-surface lg:rounded-xl"
              >
                <LogOut className="size-4" /> Sign out
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
