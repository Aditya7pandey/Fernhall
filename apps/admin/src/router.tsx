import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { AppShell } from './components/layout/AppShell'
import { AuthGate } from './components/layout/AuthGate'
import { InitialLoader } from './components/layout/InitialLoader'
import LoginPage from './pages/LoginPage'

/** Route-level code splitting: each page (and heavy deps like recharts) loads on demand. */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default })

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <AuthGate />,
    HydrateFallback: InitialLoader,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, lazy: page(() => import('./pages/DashboardPage')) },
          { path: 'orders', lazy: page(() => import('./pages/OrdersPage')) },
          { path: 'orders/:id', lazy: page(() => import('./pages/OrderDetailPage')) },
          { path: 'products', lazy: page(() => import('./pages/ProductsPage')) },
          { path: 'products/new', lazy: page(() => import('./pages/ProductEditPage')) },
          { path: 'products/:id', lazy: page(() => import('./pages/ProductEditPage')) },
          { path: 'categories', lazy: page(() => import('./pages/CategoriesPage')) },
          { path: 'customers', lazy: page(() => import('./pages/CustomersPage')) },
          { path: 'customers/:id', lazy: page(() => import('./pages/CustomerDetailPage')) },
          { path: 'coupons', lazy: page(() => import('./pages/CouponsPage')) },
          { path: 'reviews', lazy: page(() => import('./pages/ReviewsPage')) },
          { path: '*', lazy: page(() => import('./pages/NotFoundPage')) },
        ],
      },
    ],
  },
])
