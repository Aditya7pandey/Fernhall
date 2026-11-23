import { prisma } from '@ecom/db'
import type { Request, Response } from 'express'
import { findCart, presentCart } from '../lib/cart.js'
import { badRequest, notFound, paged, paginate } from '../lib/http.js'
import { cancelUnpaidOrder, orderInclude } from '../lib/orders.js'
import { computeTotals, couponProblem, SHIPPING_METHOD_IDS, SHIPPING_METHODS } from '../lib/pricing.js'
import { pageQuery, z } from '../lib/validate.js'
import { currentUser } from '../middleware/auth.js'
import { publishOrderPlaced } from '../queues/publishers.js'

const placeOrderBody = z.object({
  addressId: z.string().min(1, 'Choose a shipping address'),
  shippingMethod: z.enum(SHIPPING_METHOD_IDS),
})
const quoteQuery = z.object({ shippingMethod: z.enum(SHIPPING_METHOD_IDS).default('standard') })
const listOrdersQuery = z.object({ ...pageQuery, pageSize: z.coerce.number().int().min(1).max(50).default(10) })

// ─── Checkout ───────────────────────────────────────────────────────────────

export function listShippingMethods(_req: Request, res: Response) {
  res.json(Object.values(SHIPPING_METHODS))
}

/** The cart priced with a specific shipping method — used by the checkout summary. */
export async function getQuote(req: Request, res: Response) {
  const { shippingMethod } = quoteQuery.parse(req.query)
  res.json(await presentCart(await findCart(req), shippingMethod))
}

// ─── Orders ─────────────────────────────────────────────────────────────────

/**
 * Places an order from the current cart.
 *
 * Stock is reserved (decremented) immediately and the cart is emptied. The order starts
 * as PENDING_PAYMENT / UNPAID; the payment step moves it to PAID.
 *
 * After the transaction commits, an `order.placed` event goes onto the queue (confirmation
 * email + a delayed job that releases the stock if the order is never paid).
 */
export async function placeOrder(req: Request, res: Response) {
  const user = currentUser(req)
  const body = placeOrderBody.parse(req.body)

  const address = await prisma.address.findFirst({ where: { id: body.addressId, userId: user.id } })
  if (!address) throw notFound('Address')

  const order = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId: user.id },
      include: { items: { include: { product: true } } },
    })
    if (!cart || cart.items.length === 0) throw badRequest('Your cart is empty', 'EMPTY_CART')

    for (const { product, quantity } of cart.items) {
      if (!product.isActive) throw badRequest(`${product.name} is no longer available`, 'UNAVAILABLE')
      // Conditional decrement: fails if a concurrent checkout took the stock first
      const { count } = await tx.product.updateMany({
        where: { id: product.id, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      })
      if (count === 0) throw badRequest(`Not enough stock for ${product.name}`, 'OUT_OF_STOCK')
    }

    const subtotal = cart.items.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0)
    let coupon = cart.couponCode ? await tx.coupon.findUnique({ where: { code: cart.couponCode } }) : null
    if (coupon && couponProblem(coupon, subtotal)) coupon = null
    if (coupon) await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } })

    const totals = computeTotals(subtotal, coupon, body.shippingMethod)
    const { fullName, line1, line2, city, state, postalCode, country, phone } = address

    const created = await tx.order.create({
      data: {
        userId: user.id,
        email: user.email,
        shippingAddress: { fullName, line1, line2, city, state, postalCode, country, phone },
        shippingMethod: body.shippingMethod,
        couponCode: coupon?.code ?? null,
        ...totals,
        items: {
          create: cart.items.map(({ product, quantity }) => ({
            productId: product.id,
            name: product.name,
            imageUrl: product.images[0] ?? null,
            priceCents: product.priceCents,
            quantity,
          })),
        },
      },
      include: orderInclude,
    })

    await tx.cartItem.deleteMany({ where: { cartId: cart.id } })
    await tx.cart.update({ where: { id: cart.id }, data: { couponCode: null } })
    return created
  })

  // AFTER commit: workers must never see an order that might still roll back.
  await publishOrderPlaced(order.id)
  res.status(201).json(order)
}

export async function listMyOrders(req: Request, res: Response) {
  const user = currentUser(req)
  const q = listOrdersQuery.parse(req.query)
  const where = { userId: user.id }
  const [items, total] = await Promise.all([
    prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.pageSize) }),
    prisma.order.count({ where }),
  ])
  res.json(paged(items, total, q.page, q.pageSize))
}

export async function getMyOrder(req: Request<{ id: string }>, res: Response) {
  const order = await prisma.order.findFirst({
    where: { id: req.params.id, userId: currentUser(req).id },
    include: orderInclude,
  })
  if (!order) throw notFound('Order')
  res.json(order)
}

export async function cancelMyOrder(req: Request<{ id: string }>, res: Response) {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: currentUser(req).id } })
  if (!order) throw notFound('Order')
  res.json(await cancelUnpaidOrder(order.id))
}
