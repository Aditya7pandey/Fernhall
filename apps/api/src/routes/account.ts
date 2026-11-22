import { prisma } from '@ecom/db'
import { Router } from 'express'
import { notFound } from '../lib/http.js'
import { z } from '../lib/validate.js'
import { currentUser, requireAuth } from '../middleware/auth.js'
import { productListSelect } from './catalog.js'

// ─── Wishlist ───────────────────────────────────────────────────────────────

export const wishlistRouter = Router()
wishlistRouter.use(requireAuth)

wishlistRouter.get('/', async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { userId: currentUser(req).id, product: { isActive: true } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, product: { select: productListSelect } },
  })
  res.json(items.map((i) => ({ ...i.product, addedAt: i.createdAt })))
})

/** Just the product ids, for quickly rendering heart icons on product cards. */
wishlistRouter.get('/ids', async (req, res) => {
  const items = await prisma.wishlistItem.findMany({ where: { userId: currentUser(req).id }, select: { productId: true } })
  res.json(items.map((i) => i.productId))
})

wishlistRouter.post('/:productId', async (req, res) => {
  const userId = currentUser(req).id
  const product = await prisma.product.findUnique({ where: { id: req.params.productId } })
  if (!product) throw notFound('Product')
  await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId, productId: product.id } },
    create: { userId, productId: product.id },
    update: {},
  })
  res.status(204).end()
})

wishlistRouter.delete('/:productId', async (req, res) => {
  await prisma.wishlistItem.deleteMany({ where: { userId: currentUser(req).id, productId: req.params.productId } })
  res.status(204).end()
})

// ─── Addresses ──────────────────────────────────────────────────────────────

export const addressesRouter = Router()
addressesRouter.use(requireAuth)

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

addressesRouter.get('/', async (req, res) => {
  res.json(
    await prisma.address.findMany({
      where: { userId: currentUser(req).id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    }),
  )
})

addressesRouter.post('/', async (req, res) => {
  const userId = currentUser(req).id
  const body = addressBody.parse(req.body)
  const address = await prisma.$transaction(async (tx) => {
    const isFirst = (await tx.address.count({ where: { userId } })) === 0
    const isDefault = body.isDefault ?? isFirst
    if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
    return tx.address.create({ data: { ...body, isDefault, userId } })
  })
  res.status(201).json(address)
})

addressesRouter.patch('/:id', async (req, res) => {
  const userId = currentUser(req).id
  const body = addressBody.partial().parse(req.body)
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) throw notFound('Address')
  const address = await prisma.$transaction(async (tx) => {
    if (body.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } })
    return tx.address.update({ where: { id: existing.id }, data: body })
  })
  res.json(address)
})

addressesRouter.delete('/:id', async (req, res) => {
  const userId = currentUser(req).id
  const existing = await prisma.address.findFirst({ where: { id: req.params.id, userId } })
  if (!existing) throw notFound('Address')
  await prisma.address.delete({ where: { id: existing.id } })
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })
    if (next) await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } })
  }
  res.status(204).end()
})
