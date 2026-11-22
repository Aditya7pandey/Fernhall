import { ApiError } from '@ecom/shared'
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
  },
})

/** Centralised query keys so invalidation stays consistent. */
export const qk = {
  session: ['session'] as const,
  cart: ['cart'] as const,
  quote: (method: string) => ['cart', 'quote', method] as const,
  categories: ['categories'] as const,
  products: (params: object) => ['products', params] as const,
  product: (slug: string) => ['product', slug] as const,
  wishlistIds: ['wishlist', 'ids'] as const,
  wishlist: ['wishlist', 'list'] as const,
  orders: (page: number) => ['orders', page] as const,
  order: (id: string) => ['order', id] as const,
  addresses: ['addresses'] as const,
  shippingMethods: ['shipping-methods'] as const,
}
