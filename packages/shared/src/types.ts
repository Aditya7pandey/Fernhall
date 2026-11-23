// Model types come straight from the Prisma schema (type-only: no Prisma code reaches the browser).
import type {
  Address,
  Category,
  Coupon,
  DiscountType,
  NotificationKind,
  Order,
  OrderNotification,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Product,
  Review,
  Role,
} from '@ecom/db/browser'

export type { DiscountType, NotificationKind, OrderStatus, PaymentStatus, Role }

/** Shape of a value after it has gone through JSON: Dates become ISO strings. */
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T

export type Paginated<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export type SessionUser = { id: string; email: string; name: string; role: Role; createdAt: string }

export type RegisterInput = { name: string; email: string; password: string }
export type LoginInput = { email: string; password: string }
export type UpdateProfileInput = { name?: string; email?: string }
export type ChangePasswordInput = { currentPassword: string; newPassword: string }

// ─── Catalog ────────────────────────────────────────────────────────────────

export type CategoryRef = { id: string; name: string; slug: string }
export type CategoryDTO = Serialized<Category> & { productCount: number }

export type ProductDTO = Serialized<Product> & { category: CategoryRef | null }

export type ReviewDTO = Serialized<Review> & { user: { name: string } }

export type ProductDetail = ProductDTO & {
  reviews: ReviewDTO[]
  related: ProductDTO[]
  /** Count of reviews per star rating, keys "1"–"5" */
  ratingBreakdown: Record<string, number>
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'rating' | 'popular' | 'name'

export type ProductQuery = {
  page?: number
  pageSize?: number
  q?: string
  /** Category slug */
  category?: string
  /** Cents */
  minPrice?: number
  /** Cents */
  maxPrice?: number
  inStock?: boolean
  onSale?: boolean
  featured?: boolean
  sort?: ProductSort
}

export type ReviewInput = { rating: number; title?: string; body: string }

// ─── Cart & checkout ────────────────────────────────────────────────────────

export type ShippingMethodId = 'standard' | 'express'

export type ShippingMethod = {
  id: ShippingMethodId
  label: string
  description: string
  priceCents: number
  /** Free when the subtotal reaches this amount (null = never free) */
  freeOverCents: number | null
}

export type Totals = {
  subtotalCents: number
  discountCents: number
  shippingCents: number
  taxCents: number
  totalCents: number
}

export type CartProduct = Pick<
  ProductDTO,
  'id' | 'name' | 'slug' | 'priceCents' | 'compareAtPriceCents' | 'images' | 'stock' | 'isActive'
>

export type CartItemDTO = {
  id: string
  productId: string
  quantity: number
  product: CartProduct
  lineTotalCents: number
  /** False when the product was deactivated or stock dropped below the quantity */
  available: boolean
}

export type CartDTO = {
  id: string | null
  items: CartItemDTO[]
  itemCount: number
  coupon: { code: string; valid: boolean; message: string | null; description: string | null } | null
  shippingMethod: ShippingMethod
  totals: Totals
}

// ─── Account ────────────────────────────────────────────────────────────────

export type AddressDTO = Serialized<Address>

export type AddressInput = {
  fullName: string
  line1: string
  line2?: string | null
  city: string
  state: string
  postalCode: string
  country: string
  phone?: string | null
  isDefault?: boolean
}

export type WishlistProduct = ProductDTO & { addedAt: string }

// ─── Orders ─────────────────────────────────────────────────────────────────

/** Address snapshot stored on the order at checkout time */
export type ShippingAddress = {
  fullName: string
  line1: string
  line2?: string | null
  city: string
  state: string
  postalCode: string
  country: string
  phone?: string | null
}

export type OrderItemDTO = Serialized<OrderItem>

/** A notification the background workers actually sent for an order (one per kind). */
export type OrderNotificationDTO = Serialized<Omit<OrderNotification, 'orderId'>>

/** An item in the header bell: a notification plus the order it's about. */
export type NotificationItemDTO = OrderNotificationDTO & { order: { id: string; number: number } }
export type NotificationsDTO = { items: NotificationItemDTO[]; unreadCount: number }

export type OrderDTO = Serialized<Omit<Order, 'shippingAddress'>> & {
  shippingAddress: ShippingAddress
  shippingMethod: ShippingMethodId
  items: OrderItemDTO[]
  notifications: OrderNotificationDTO[]
  user: { id: string; name: string; email: string }
}

export type PlaceOrderInput = { addressId: string; shippingMethod: ShippingMethodId }

// ─── Payments (Razorpay) ────────────────────────────────────────────────────

/** What the browser needs to open Razorpay Checkout */
export type PaymentSession = {
  provider: 'razorpay'
  /** Public key id (rzp_test_… / rzp_live_…) */
  keyId: string
  razorpayOrderId: string
  /** Paise */
  amount: number
  currency: string
  orderId: string
  orderNumber: number
  prefill: { name: string; email: string }
}

/** Razorpay Checkout's success-handler payload, plus our order id */
export type VerifyPaymentInput = {
  orderId: string
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export type VerifyPaymentResult = { orderId: string; status: OrderStatus; paymentStatus: PaymentStatus }

// ─── Admin ──────────────────────────────────────────────────────────────────

export type AdminOrderDTO = OrderDTO & { allowedTransitions: OrderStatus[] }

export type AdminOrderQuery = { page?: number; pageSize?: number; status?: OrderStatus; q?: string }

export type AdminProductStatus = 'all' | 'active' | 'inactive' | 'low_stock' | 'out_of_stock'

export type AdminProductQuery = {
  page?: number
  pageSize?: number
  q?: string
  categoryId?: string
  status?: AdminProductStatus
  sort?: 'newest' | 'name' | 'price_asc' | 'price_desc' | 'stock_asc'
}

export type AdminProductDetail = ProductDTO & { _count: { orderItems: number; reviews: number } }

export type ProductInput = {
  name: string
  /** Generated from the name when omitted */
  slug?: string
  description?: string
  priceCents: number
  compareAtPriceCents?: number | null
  sku?: string | null
  stock?: number
  images?: string[]
  categoryId?: string | null
  featured?: boolean
  isActive?: boolean
}

export type CategoryInput = { name: string; slug?: string; description?: string | null; imageUrl?: string | null }

export type CouponDTO = Serialized<Coupon>

export type CouponInput = {
  code: string
  description?: string | null
  type: DiscountType
  /** Percent (1–100) for PERCENT, cents for FIXED */
  value: number
  minSubtotalCents?: number | null
  maxUses?: number | null
  /** ISO date string */
  expiresAt?: string | null
  isActive?: boolean
}

export type AdminCustomer = {
  id: string
  name: string
  email: string
  createdAt: string
  orderCount: number
  totalSpentCents: number
  lastOrderAt: string | null
}

export type AdminCustomerDetail = {
  id: string
  name: string
  email: string
  role: Role
  createdAt: string
  addresses: AddressDTO[]
  orders: OrderDTO[]
  orderCount: number
  totalSpentCents: number
}

export type AdminReview = ReviewDTO & {
  user: { id: string; name: string; email: string }
  product: { id: string; name: string; slug: string; images: string[] }
}

export type AdminReviewQuery = { page?: number; pageSize?: number; rating?: number; q?: string }

export type AdminStats = {
  rangeDays: number
  revenueCents: number
  /** % change vs the previous period of the same length (null when there's no previous data) */
  revenueChangePct: number | null
  orders: number
  ordersChangePct: number | null
  averageOrderCents: number
  customers: number
  newCustomers: number
  /** Orders that are paid but not yet shipped */
  pendingFulfilment: number
  ordersByStatus: Record<OrderStatus, number>
  revenueByDay: { date: string; revenueCents: number; orders: number }[]
  topProducts: { productId: string; name: string; imageUrl: string | null; unitsSold: number; revenueCents: number }[]
  lowStock: { id: string; name: string; slug: string; stock: number; images: string[] }[]
  recentOrders: OrderDTO[]
}
