import type {
  AddressDTO,
  AddressInput,
  AdminCustomer,
  AdminCustomerDetail,
  AdminOrderDTO,
  AdminOrderQuery,
  AdminProductDetail,
  AdminProductQuery,
  AdminReview,
  AdminReviewQuery,
  AdminStats,
  CartDTO,
  CategoryDTO,
  CategoryInput,
  ChangePasswordInput,
  CouponDTO,
  CouponInput,
  LoginInput,
  OrderDTO,
  OrderStatus,
  Paginated,
  PaymentSession,
  PlaceOrderInput,
  ProductDetail,
  ProductDTO,
  ProductInput,
  ProductQuery,
  RegisterInput,
  ReviewDTO,
  ReviewInput,
  SessionUser,
  ShippingMethod,
  ShippingMethodId,
  UpdateProfileInput,
  VerifyPaymentInput,
  VerifyPaymentResult,
  WishlistProduct,
  NotificationsDTO,
} from './types.ts'

export class ApiError extends Error {
  readonly status: number
  /** Machine-readable code from the API, e.g. OUT_OF_STOCK, INVALID_COUPON, PAYMENT_NOT_IMPLEMENTED */
  readonly code: string | undefined
  /** Per-field validation messages, keyed by field path */
  readonly fieldErrors: Record<string, string>

  constructor(status: number, message: string, code?: string, issues?: { path: string; message: string }[]) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = Object.fromEntries((issues ?? []).map((i) => [i.path, i.message]))
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

function toQueryString(query?: Query) {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

/**
 * Typed client for the Express API.
 * Pass `/api` in dev (Vite proxies it to the API) or the deployed API URL in production.
 */
export function createApiClient(baseUrl: string) {
  async function request<T>(
    method: string,
    path: string,
    opts: { body?: unknown; query?: Query; headers?: Record<string, string> } = {},
  ): Promise<T> {
    const isForm = typeof FormData !== 'undefined' && opts.body instanceof FormData
    const res = await fetch(`${baseUrl}${path}${toQueryString(opts.query)}`, {
      method,
      credentials: 'include',
      headers: {
        ...(opts.body !== undefined && !isForm && { 'Content-Type': 'application/json' }),
        ...opts.headers,
      },
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as
        | { error?: string; code?: string; issues?: { path: string; message: string }[] }
        | null
      throw new ApiError(res.status, data?.error ?? `${res.status} ${res.statusText}`, data?.code, data?.issues)
    }
    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  const get = <T>(path: string, query?: Query) => request<T>('GET', path, { query })
  const post = <T>(path: string, body?: unknown) => request<T>('POST', path, { body })
  /** POST with an Idempotency-Key: retrying with the same key never repeats the operation */
  const postOnce = <T>(path: string, idempotencyKey: string, body?: unknown) =>
    request<T>('POST', path, { body, headers: { 'Idempotency-Key': idempotencyKey } })
  const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body })
  const del = <T = void>(path: string) => request<T>('DELETE', path)
  const id = encodeURIComponent

  return {
    request,

    /** Resolves image paths from the API (e.g. /uploads/x.jpg) to loadable URLs; absolute URLs pass through. */
    assetUrl(url: string | null | undefined): string | undefined {
      if (!url) return undefined
      return url.startsWith('/uploads/') ? `${baseUrl}${url}` : url
    },

    auth: {
      me: () => get<SessionUser | null>('/auth/me'),
      login: (input: LoginInput) => post<SessionUser>('/auth/login', input),
      register: (input: RegisterInput) => post<SessionUser>('/auth/register', input),
      logout: () => post<void>('/auth/logout'),
      updateProfile: (input: UpdateProfileInput) => patch<SessionUser>('/auth/me', input),
      changePassword: (input: ChangePasswordInput) => post<void>('/auth/password', input),
    },

    categories: {
      list: () => get<CategoryDTO[]>('/categories'),
      get: (slug: string) => get<CategoryDTO>(`/categories/${id(slug)}`),
    },

    products: {
      list: (query?: ProductQuery) => get<Paginated<ProductDTO>>('/products', query),
      get: (slug: string) => get<ProductDetail>(`/products/${id(slug)}`),
      review: (productId: string, input: ReviewInput) => post<ReviewDTO>(`/products/${id(productId)}/reviews`, input),
    },

    cart: {
      get: () => get<CartDTO>('/cart'),
      add: (productId: string, quantity = 1) => post<CartDTO>('/cart/items', { productId, quantity }),
      /** quantity 0 removes the item */
      update: (productId: string, quantity: number) => patch<CartDTO>(`/cart/items/${id(productId)}`, { quantity }),
      remove: (productId: string) => del<CartDTO>(`/cart/items/${id(productId)}`),
      clear: () => del<CartDTO>('/cart'),
      applyCoupon: (code: string) => post<CartDTO>('/cart/coupon', { code }),
      removeCoupon: () => del<CartDTO>('/cart/coupon'),
    },

    checkout: {
      shippingMethods: () => get<ShippingMethod[]>('/checkout/shipping-methods'),
      /** The cart priced with the given shipping method */
      quote: (shippingMethod: ShippingMethodId) => get<CartDTO>('/checkout/quote', { shippingMethod }),
    },

    orders: {
      /** Reuse the same idempotencyKey when retrying the same checkout attempt */
      place: (input: PlaceOrderInput, idempotencyKey: string) => postOnce<OrderDTO>('/orders', idempotencyKey, input),
      list: (query?: { page?: number; pageSize?: number }) => get<Paginated<OrderDTO>>('/orders', query),
      get: (orderId: string) => get<OrderDTO>(`/orders/${id(orderId)}`),
      cancel: (orderId: string) => post<OrderDTO>(`/orders/${id(orderId)}/cancel`),
    },

    /** Razorpay: start → open Checkout in the browser → verify the signed result */
    payments: {
      /** Creates (or reuses) the Razorpay order for one of our orders */
      start: (orderId: string, idempotencyKey: string) =>
        postOnce<PaymentSession>(`/payments/orders/${id(orderId)}`, idempotencyKey),
      /** Sends Razorpay Checkout's signed success payload to be verified; safe to call more than once */
      verify: (input: VerifyPaymentInput) => post<VerifyPaymentResult>('/payments/verify', input),
    },

    /** Header bell: notifications the background workers sent about the user's orders */
    notifications: {
      list: () => get<NotificationsDTO>('/notifications'),
      markAllRead: () => post<{ marked: number }>('/notifications/read'),
    },

    wishlist: {
      list: () => get<WishlistProduct[]>('/wishlist'),
      ids: () => get<string[]>('/wishlist/ids'),
      add: (productId: string) => post<void>(`/wishlist/${id(productId)}`),
      remove: (productId: string) => del(`/wishlist/${id(productId)}`),
    },

    addresses: {
      list: () => get<AddressDTO[]>('/addresses'),
      create: (input: AddressInput) => post<AddressDTO>('/addresses', input),
      update: (addressId: string, input: Partial<AddressInput>) => patch<AddressDTO>(`/addresses/${id(addressId)}`, input),
      remove: (addressId: string) => del(`/addresses/${id(addressId)}`),
    },

    admin: {
      stats: (days = 30) => get<AdminStats>('/admin/stats', { days }),

      products: {
        list: (query?: AdminProductQuery) => get<Paginated<ProductDTO>>('/admin/products', query),
        get: (productId: string) => get<AdminProductDetail>(`/admin/products/${id(productId)}`),
        create: (input: ProductInput) => post<ProductDTO>('/admin/products', input),
        update: (productId: string, input: Partial<ProductInput>) => patch<ProductDTO>(`/admin/products/${id(productId)}`, input),
        remove: (productId: string) => del(`/admin/products/${id(productId)}`),
      },

      categories: {
        list: () => get<CategoryDTO[]>('/admin/categories'),
        create: (input: CategoryInput) => post<CategoryDTO>('/admin/categories', input),
        update: (categoryId: string, input: Partial<CategoryInput>) => patch<CategoryDTO>(`/admin/categories/${id(categoryId)}`, input),
        remove: (categoryId: string) => del(`/admin/categories/${id(categoryId)}`),
      },

      orders: {
        list: (query?: AdminOrderQuery) => get<Paginated<OrderDTO>>('/admin/orders', query),
        get: (orderId: string) => get<AdminOrderDTO>(`/admin/orders/${id(orderId)}`),
        setStatus: (orderId: string, status: OrderStatus) => patch<AdminOrderDTO>(`/admin/orders/${id(orderId)}/status`, { status }),
      },

      customers: {
        list: (query?: { page?: number; pageSize?: number; q?: string }) => get<Paginated<AdminCustomer>>('/admin/customers', query),
        get: (customerId: string) => get<AdminCustomerDetail>(`/admin/customers/${id(customerId)}`),
      },

      coupons: {
        list: () => get<CouponDTO[]>('/admin/coupons'),
        create: (input: CouponInput) => post<CouponDTO>('/admin/coupons', input),
        update: (couponId: string, input: Partial<CouponInput>) => patch<CouponDTO>(`/admin/coupons/${id(couponId)}`, input),
        remove: (couponId: string) => del(`/admin/coupons/${id(couponId)}`),
      },

      reviews: {
        list: (query?: AdminReviewQuery) => get<Paginated<AdminReview>>('/admin/reviews', query),
        remove: (reviewId: string) => del(`/admin/reviews/${id(reviewId)}`),
      },

      /** Uploads images; returns paths like /uploads/abc.jpg (render them with assetUrl). */
      upload: (files: File[] | FileList) => {
        const form = new FormData()
        for (const f of Array.from(files)) form.append('files', f)
        return post<{ urls: string[] }>('/admin/uploads', form)
      },
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
