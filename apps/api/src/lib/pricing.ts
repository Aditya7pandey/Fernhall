import type { Coupon } from '@ecom/db'

export const TAX_RATE = 0.08

export const SHIPPING_METHODS = {
  standard: { id: 'standard', label: 'Standard', description: '3–5 business days', priceCents: 599, freeOverCents: 7500 },
  express: { id: 'express', label: 'Express', description: '1–2 business days', priceCents: 1499, freeOverCents: null },
} as const

export type ShippingMethodId = keyof typeof SHIPPING_METHODS
export const SHIPPING_METHOD_IDS = Object.keys(SHIPPING_METHODS) as [ShippingMethodId, ...ShippingMethodId[]]

/** Returns a human-readable reason the coupon can't be used, or null if it's valid. */
export function couponProblem(coupon: Coupon | null, subtotalCents: number, now = new Date()): string | null {
  if (!coupon || !coupon.isActive) return 'This code is not valid'
  if (coupon.expiresAt && coupon.expiresAt < now) return 'This code has expired'
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) return 'This code has reached its usage limit'
  if (coupon.minSubtotalCents != null && subtotalCents < coupon.minSubtotalCents) {
    return `Spend $${(coupon.minSubtotalCents / 100).toFixed(2)} or more to use this code`
  }
  return null
}

export function discountFor(coupon: Coupon, subtotalCents: number) {
  const raw = coupon.type === 'PERCENT' ? Math.round((subtotalCents * coupon.value) / 100) : coupon.value
  return Math.min(raw, subtotalCents)
}

export function shippingFor(method: ShippingMethodId, subtotalCents: number) {
  const m = SHIPPING_METHODS[method]
  if (subtotalCents === 0) return 0
  return m.freeOverCents != null && subtotalCents >= m.freeOverCents ? 0 : m.priceCents
}

export function computeTotals(subtotalCents: number, coupon: Coupon | null, method: ShippingMethodId) {
  const discountCents = coupon && !couponProblem(coupon, subtotalCents) ? discountFor(coupon, subtotalCents) : 0
  const shippingCents = shippingFor(method, subtotalCents)
  const taxCents = Math.round((subtotalCents - discountCents) * TAX_RATE)
  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents: subtotalCents - discountCents + shippingCents + taxCents,
  }
}
