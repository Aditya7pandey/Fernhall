import { prisma } from '@ecom/db'
import type { Request, Response } from 'express'
import { CART_COOKIE, cookieOptions } from './auth.js'
import { computeTotals, couponProblem, SHIPPING_METHODS, type ShippingMethodId } from './pricing.js'

const GUEST_CART_MAX_AGE = 30 * 24 * 60 * 60 * 1000

export const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          priceCents: true,
          compareAtPriceCents: true,
          images: true,
          stock: true,
          isActive: true,
        },
      },
    },
  },
} as const

/** Finds the current cart: the user's if signed in, otherwise the guest cart from the signed cookie. */
export async function findCart(req: Request) {
  if (req.user) {
    return prisma.cart.findUnique({ where: { userId: req.user.id }, include: cartInclude })
  }
  const guestId = req.signedCookies?.[CART_COOKIE] as string | undefined
  if (!guestId) return null
  return prisma.cart.findFirst({ where: { id: guestId, userId: null }, include: cartInclude })
}

/** Like findCart, but creates the cart (and the guest cookie) when there isn't one yet. */
export async function getOrCreateCart(req: Request, res: Response) {
  const existing = await findCart(req)
  if (existing) return existing
  if (req.user) {
    return prisma.cart.create({ data: { userId: req.user.id }, include: cartInclude })
  }
  const cart = await prisma.cart.create({ data: {}, include: cartInclude })
  res.cookie(CART_COOKIE, cart.id, { ...cookieOptions(GUEST_CART_MAX_AGE), signed: true })
  return cart
}

/** On sign-in: move the guest cart's items into the user's cart, then drop the guest cart. */
export async function mergeGuestCart(req: Request, res: Response, userId: string) {
  const guestId = req.signedCookies?.[CART_COOKIE] as string | undefined
  if (!guestId) return
  res.clearCookie(CART_COOKIE, { ...cookieOptions(), maxAge: undefined, signed: true })
  const guest = await prisma.cart.findFirst({ where: { id: guestId, userId: null }, include: { items: true } })
  if (!guest) return

  await prisma.$transaction(async (tx) => {
    const userCart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {} })
    for (const item of guest.items) {
      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: userCart.id, productId: item.productId } },
        create: { cartId: userCart.id, productId: item.productId, quantity: item.quantity },
        update: { quantity: { increment: item.quantity } },
      })
    }
    if (guest.couponCode && !userCart.couponCode) {
      await tx.cart.update({ where: { id: userCart.id }, data: { couponCode: guest.couponCode } })
    }
    await tx.cart.delete({ where: { id: guest.id } })
  })
}

export type CartWithItems = NonNullable<Awaited<ReturnType<typeof findCart>>>

/** Shapes a cart for the API, with totals (shipping estimated with the given method). */
export async function presentCart(cart: CartWithItems | null, method: ShippingMethodId = 'standard') {
  const items = (cart?.items ?? []).map((item) => ({
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    product: item.product,
    lineTotalCents: item.product.priceCents * item.quantity,
    available: item.product.isActive && item.product.stock >= item.quantity,
  }))
  const subtotalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0)

  const coupon = cart?.couponCode ? await prisma.coupon.findUnique({ where: { code: cart.couponCode } }) : null
  const problem = cart?.couponCode ? couponProblem(coupon, subtotalCents) : null

  return {
    id: cart?.id ?? null,
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    coupon: cart?.couponCode
      ? { code: cart.couponCode, valid: !problem, message: problem, description: coupon?.description ?? null }
      : null,
    shippingMethod: SHIPPING_METHODS[method],
    totals: computeTotals(subtotalCents, problem ? null : coupon, method),
  }
}
