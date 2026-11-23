import { prisma } from '@ecom/db'
import type { Request, Response } from 'express'
import { notFound } from '../lib/http.js'
import { z } from '../lib/validate.js'
import { currentUser } from '../middleware/auth.js'
import { productListSelect } from './catalog.controller.js'

const addressBody = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100),
  line1: z.string().trim().min(1, 'Address is required').max(200),
  line2: z.string().trim().max(200).nullish(),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(1, 'State / region is required').max(100),
  postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
  country: z.string().trim().min(2, 'Country is required').max(60),
  phone: z.string().trim().max(30).nullish(),
  isDefault: z.boolean().optional(),
})

// ─── Wishlist ───────────────────────────────────────────────────────────────

export async function listWishlist(req: Request, res: Response) {
  const items = await prisma.wishlistItem.findMany({
    where: { userId: currentUser(req).id, product: { isActive: true } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, product: { select: productListSelect } },
  })
  res.json(items.map((i) => ({ ...i.product, addedAt: i.createdAt })))
}

/** Just the product ids, for quickly rendering heart icons on product cards. */
export async function listWishlistIds(req: Request, res: Response) {
  const items = await prisma.wishlistItem.findMany({ where: { userId: currentUser(req).id }, select: { productId: true } })
  res.json(items.map((i) => i.productId))
}

export async function addToWishlist(req: Request<{ productId: string }>, res: Response) {
  const userId = currentUser(req).id
  const product = await prisma.product.findUnique({ where: { id: req.params.productId } })
  if (!product) throw notFound('Product')
  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId, productId: product.id } },
    create: { userId, productId: product.id },
    update: {},
  })
  res.status(204).end()
}

export async function removeFromWishlist(req: Request<{ productId: string }>, res: Response) {
  await prisma.wishlistItem.deleteMany({ where: { userId: currentUser(req).id, productId: req.params.productId } })
  res.status(204).end()
}

// ─── Addresses ──────────────────────────────────────────────────────────────

export async function listAddresses(req: Request, res: Response) {
  res.json(
    await prisma.address.findMany({
      where: { userId: currentUser(req).id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    }),
  )
}

export async function createAddress(req: Request, res: Response) {
  const userId = currentUser(req).id
  const body = addressBody.parse(req.body)
  const address = await prisma.$transaction(async (tx) => {
    const isFirst = (await tx.address.count({ where: { userId } })) === 0
    const isDefault = body.isDefault ?? isFirst
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
    return tx.address.create({ data: { ...body, isDefault, userId } })
  })
  res.status(201).json(address)
}

export async function updateAddress(req: Request<{ id: string }>, res: Response) {
  const userId = currentUser(req).id
  const body = addressBody.partial().parse(req.body)
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) throw notFound('Address')
  const address = await prisma.$transaction(async (tx) => {
    if (body.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
    return tx.address.update({ where: { id: existing.id }, data: body })
  })
  res.json(address)
}

export async function deleteAddress(req: Request<{ id: string }>, res: Response) {
  const userId = currentUser(req).id
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) throw notFound('Address')
  await prisma.address.delete({ where: { id: existing.id } })
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } })
  }
  res.status(204).end()
}
