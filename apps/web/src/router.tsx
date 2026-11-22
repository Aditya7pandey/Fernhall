import { createBrowserRouter } from 'react-router'
import { Layout } from './components/layout/Layout'
import { CartPage } from './pages/CartPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProductPage } from './pages/ProductPage'
import { ShopPage } from './pages/ShopPage'

// Browsing pages are bundled eagerly; checkout, auth and account load on demand.
const account = () => import('./pages/account/AccountPages')

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'shop', element: <ShopPage /> },
      { path: 'category/:slug', element: <ShopPage /> },
      { path: 'product/:slug', element: <ProductPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', lazy: () => import('./pages/CheckoutPage').then((m) => ({ Component: m.CheckoutPage })) },
      { path: 'checkout/payment/:orderId', lazy: () => import('./pages/PaymentPage').then((m) => ({ Component: m.PaymentPage })) },
      { path: 'signin', lazy: () => import('./pages/AuthPages').then((m) => ({ Component: m.SignInPage })) },
      { path: 'register', lazy: () => import('./pages/AuthPages').then((m) => ({ Component: m.RegisterPage })) },
      {
        path: 'account',
        lazy: () => import('./pages/account/AccountLayout').then((m) => ({ Component: m.AccountLayout })),
        children: [
          { index: true, lazy: () => account().then((m) => ({ Component: m.AccountOverview })) },
          { path: 'orders', lazy: () => account().then((m) => ({ Component: m.OrdersPage })) },
          { path: 'orders/:orderId', lazy: () => account().then((m) => ({ Component: m.OrderDetailPage })) },
          { path: 'addresses', lazy: () => account().then((m) => ({ Component: m.AddressesPage })) },
          { path: 'wishlist', lazy: () => account().then((m) => ({ Component: m.WishlistPage })) },
          { path: 'profile', lazy: () => account().then((m) => ({ Component: m.ProfilePage })) },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
