import { prisma } from '@ecom/db'
import { Router } from 'express'
import type { Request, Response } from 'express'
import { cartInclude, findCart, getOrCreateCart, presentCart } from '../lib/cart.js'
import { badRequest, notFound } from '../lib/http.js'
import { couponProblem } from '../lib/pricing.js'
import { z } from '../lib/validate.js'

export const cartRouter = Router()

const MAX_QTY = 20

/**
 * Sends the up-to-date cart. Pass `cartId` after getOrCreateCart: a guest cart created in this
 * request isn't findable via findCart yet (its cookie is only on the response).
 */
async function respond(req: Request, res: Response, cartId?: string) {
  const cart = cartId ? await prisma.cart.findUnique({ where: { id: cartId }, include: cartInclude }) : await findCart(req)
  res.json(await presentCart(cart))
}

cartRouter.get('/', async (req, res) => {
  await respond(req, res)
})

/** Adds a product (or increases its quantity if it's already in the cart). */
cartRouter.post('/items', async (req, res) => {
  const body = z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(MAX_QTY).default(1) }).parse(req.body)
  const product = await prisma.product.findFirst({ where: { id: body.productId, isActive: true } })
  if (!product) throw notFound('Product')

  const cart = await getOrCreateCart(req, res)
  const existing = cart.items.find((i) => i.productId === product.id)
  const quantity = Math.min((existing?.quantity ?? 0) + body.quantity, MAX_QTY)
  if (quantity > product.stock) {
    throw badRequest(product.stock === 0 ? 'This item is out of stock' : `Only ${product.stock} left in stock`, 'OUT_OF_STOCK')
  }
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId: product.id } },
    create: { cartId: cart.id, productId: product.id, quantity },
    update: { quantity },
  })
  await respond(req, res, cart.id)
})

/** Sets an item's quantity; 0 removes it. */
cartRouter.patch('/items/:productId', async (req, res) => {
  const { quantity } = z.object({ quantity: z.number().int().min(0).max(MAX_QTY) }).parse(req.body)
  const cart = await findCart(req)
  const item = cart?.items.find((i) => i.productId === req.params.productId)
  if (!cart || !item) throw notFound('Cart item')

  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } })
  } else {
    if (quantity > item.product.stock) throw badRequest(`Only ${item.product.stock} left in stock`, 'OUT_OF_STOCK')
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } })
  }
  await respond(req, res)
})

cartRouter.delete('/items/:productId', async (req, res) => {
  const cart = await findCart(req)
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId: req.params.productId } })
  await respond(req, res)
})

cartRouter.delete('/', async (req, res) => {
  const cart = await findCart(req)
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } })
    await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } })
  }
  await respond(req, res)
})

cartRouter.post('/coupon', async (req, res) => {
  const { code } = z.object({ code: z.string().trim().min(1).max(40).toUpperCase() }).parse(req.body)
  const cart = await getOrCreateCart(req, res)
  const coupon = await prisma.coupon.findUnique({ where: { code } })
  const subtotal = cart.items.reduce((sum, i) => sum + i.product.priceCents * i.quantity, 0)
  const problem = couponProblem(coupon, subtotal)
  if (problem) throw badRequest(problem, 'INVALID_COUPON')
  await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: code } })
  await respond(req, res, cart.id)
})

cartRouter.delete('/coupon', async (req, res) => {
  const cart = await findCart(req)
  if (cart) await prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } })
  await respond(req, res)
})
