import {
  ChevronsLeft,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Moon,
  Package,
  ShoppingBag,
  Sun,
  Tag,
  Tags,
  Users,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useLogout, useSession } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Dropdown, DropdownItem, DropdownSeparator } from '../ui/dropdown'
import { Avatar } from '../ui/misc'
import { CommandSearch } from './CommandSearch'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/coupons', label: 'Coupons', icon: Tag },
  { to: '/reviews', label: 'Reviews', icon: MessageSquareText },
]

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5173'
const COLLAPSE_KEY = 'ecom-admin-sidebar-collapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-[oklch(0.5_0.2_300)] text-white shadow-xs">
        <ShoppingBag className="size-4" strokeWidth={2.4} />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-sm font-semibold text-fg">Fernhall</p>
          <p className="text-[11px] text-muted">Admin console</p>
        </div>
      )}
    </div>
  )
}

function NavItems({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <nav className="space-y-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              'group flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium transition-colors',
              collapsed && 'justify-center px-0',
              isActive ? 'bg-surface text-fg shadow-xs ring-1 ring-border' : 'text-muted hover:bg-surface-3 hover:text-fg',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={cn('size-[18px] shrink-0', isActive ? 'text-accent' : 'text-subtle group-hover:text-muted')} />
              {!collapsed && label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarFooter({ collapsed }: { collapsed?: boolean }) {
  return (
    <a
      href={STOREFRONT_URL}
      target="_blank"
      rel="noreferrer"
      title={collapsed ? 'View storefront' : undefined}
      className={cn(
        'flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-3 hover:text-fg',
        collapsed && 'justify-center px-0',
      )}
    >
      <ExternalLink className="size-[18px] shrink-0 text-subtle" />
      {!collapsed && 'View storefront'}
    </a>
  )
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        // ignore
      }
      return !c
    })
  }

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-surface-2 transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[68px]' : 'w-60',
        )}
      >
        <div className={cn('flex h-14 items-center border-b border-border', collapsed ? 'justify-center' : 'px-4')}>
          <Logo collapsed={collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {!collapsed && <p className="mb-2 px-2.5 text-[11px] font-semibold tracking-wider text-subtle uppercase">Store</p>}
          <NavItems collapsed={collapsed} />
        </div>
        <div className="space-y-0.5 border-t border-border p-3">
          <SidebarFooter collapsed={collapsed} />
          <button
            onClick={toggleCollapsed}
            className={cn(
              'flex h-9 w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-3 hover:text-fg',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronsLeft className={cn('size-[18px] shrink-0 text-subtle transition-transform', collapsed && 'rotate-180')} />
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 animate-slide-in-left flex-col border-r border-border bg-surface-2 shadow-pop">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <Logo />
              <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="border-t border-border p-3">
              <SidebarFooter />
            </div>
          </aside>
        </div>
      )}

      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-[68px]' : 'lg:pl-60')}>
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { data: user } = useSession()
  const logout = useLogout()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu />
      </Button>
      <CommandSearch />
      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        {user && (
          <Dropdown
            trigger={({ toggle: t }) => (
              <button
                onClick={t}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 transition-colors hover:bg-surface-3"
              >
                <Avatar name={user.name} size={28} />
                <span className="hidden text-left leading-tight sm:block">
                  <span className="block text-[13px] font-medium text-fg">{user.name}</span>
                  <span className="block text-[11px] text-muted">{user.email}</span>
                </span>
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2.5 py-2 sm:hidden">
                  <p className="text-[13px] font-medium">{user.name}</p>
                  <p className="text-xs text-muted">{user.email}</p>
                </div>
                <DropdownItem icon={<ExternalLink />} onClick={() => (close(), window.open(STOREFRONT_URL, '_blank'))}>
                  View storefront
                </DropdownItem>
                <DropdownItem icon={theme === 'dark' ? <Sun /> : <Moon />} onClick={() => (close(), toggle())}>
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem
                  danger
                  icon={<LogOut />}
                  onClick={() => {
                    close()
                    logout.mutate(undefined, { onSuccess: () => navigate('/login') })
                  }}
                >
                  Sign out
                </DropdownItem>
              </>
            )}
          </Dropdown>
        )}
      </div>
    </header>
  )
}

export function FullPageCenter({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center bg-bg p-4">{children}</div>
}
