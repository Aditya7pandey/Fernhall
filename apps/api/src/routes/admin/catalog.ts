import { prisma, type Prisma } from '@ecom/db'
import { Router } from 'express'
import { notFound, paged, paginate } from '../../lib/http.js'
import { recomputeRating } from '../../lib/reviews.js'
import { uniqueSlug } from '../../lib/slug.js'
import { pageQuery, z } from '../../lib/validate.js'
import { productListSelect } from '../catalog.js'

export const adminCatalogRouter = Router()

export const LOW_STOCK_THRESHOLD = 5

// ─── Products ───────────────────────────────────────────────────────────────

const productBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().max(5000).default(''),
  priceCents: z.number().int().min(0, 'Price must be positive'),
  compareAtPriceCents: z.number().int().min(0).nullish(),
  sku: z.string().trim().max(64).nullish().transform((v) => v || null),
  stock: z.number().int().min(0).default(0),
  images: z.array(z.string().trim().min(1)).max(10).default([]),
  categoryId: z.string().nullish(),
  featured: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

const slugTaken = (excludeId?: string) => async (slug: string) =>
  !!(await prisma.product.findFirst({ where: { slug, ...(excludeId && { id: { not: excludeId } }) } }))

adminCatalogRouter.get('/products', async (req, res) => {
  const q = z
    .object({
      ...pageQuery,
      q: z.string().trim().optional(),
      categoryId: z.string().optional(),
      status: z.enum(['all', 'active', 'inactive', 'low_stock', 'out_of_stock']).default('all'),
      sort: z.enum(['newest', 'name', 'price_asc', 'price_desc', 'stock_asc']).default('newest'),
    })
    .parse(req.query)

  const where: Prisma.ProductWhereInput = {
    ...(q.q && {
      OR: [
        { name: { contains: q.q, mode: 'insensitive' } },
        { sku: { contains: q.q, mode: 'insensitive' } },
      ],
    }),
    ...(q.categoryId && { categoryId: q.categoryId }),
    ...(q.status === 'active' && { isActive: true }),
    ...(q.status === 'inactive' && { isActive: false }),
    ...(q.status === 'low_stock' && { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } }),
    ...(q.status === 'out_of_stock' && { stock: 0 }),
  }
  const orderBy = {
    newest: { createdAt: 'desc' },
    name: { name: 'asc' },
    price_asc: { priceCents: 'asc' },
    price_desc: { priceCents: 'desc' },
    stock_asc: { stock: 'asc' },
  }[q.sort] as Prisma.ProductOrderByWithRelationInput

  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, select: productListSelect, orderBy: [orderBy, { id: 'asc' }], ...paginate(q.page, q.pageSize) }),
    prisma.product.count({ where }),
  ])
  res.json(paged(items, total, q.page, q.pageSize))
})

adminCatalogRouter.get('/products/:id', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    select: { ...productListSelect, _count: { select: { orderItems: true, reviews: true } } },
  })
  if (!product) throw notFound('Product')
  res.json(product)
})

adminCatalogRouter.post('/products', async (req, res) => {
  const body = productBody.parse(req.body)
  const slug = await uniqueSlug(body.slug || body.name, slugTaken())
  const product = await prisma.product.create({ data: { ...body, slug }, select: productListSelect })
  res.status(201).json(product)
})

adminCatalogRouter.patch('/products/:id', async (req, res) => {
  const body = productBody.partial().parse(req.body)
  const existing = await prisma.product.findUnique({ where: { id: req.params.id } })
  if (!existing) throw notFound('Product')
  const slug = body.slug !== undefined && body.slug !== existing.slug
    ? await uniqueSlug(body.slug || body.name || existing.name, slugTaken(existing.id))
    : undefined
  const product = await prisma.product.update({
    where: { id: existing.id },
    data: { ...body, ...(slug && { slug }) },
    select: productListSelect,
  })
  res.json(product)
})

/** Past orders keep their item snapshots (OrderItem.productId is set to null). */
adminCatalogRouter.delete('/products/:id', async (req, res) => {
  await prisma.product.delete({ where: { id: req.params.id } })
  res.status(204).end()
})

// ─── Categories ─────────────────────────────────────────────────────────────

const categoryBody = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  slug: z.string().trim().max(100).optional(),
  description: z.string().trim().max(1000).nullish(),
  imageUrl: z.string().trim().nullish(),
})

const categorySlugTaken = (excludeId?: string) => async (slug: string) =>
  !!(await prisma.category.findFirst({ where: { slug, ...(excludeId && { id: { not: excludeId } }) } }))

adminCatalogRouter.get('/categories', async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  })
  res.json(categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products })))
})

adminCatalogRouter.post('/categories', async (req, res) => {
  const body = categoryBody.parse(req.body)
  const slug = await uniqueSlug(body.slug || body.name, categorySlugTaken())
  res.status(201).json(await prisma.category.create({ data: { ...body, slug } }))
})

adminCatalogRouter.patch('/categories/:id', async (req, res) => {
  const body = categoryBody.partial().parse(req.body)
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } })
  if (!existing) throw notFound('Category')
  const slug = body.slug !== undefined && body.slug !== existing.slug
    ? await uniqueSlug(body.slug || body.name || existing.name, categorySlugTaken(existing.id))
    : undefined
  res.json(await prisma.category.update({ where: { id: existing.id }, data: { ...body, ...(slug && { slug }) } }))
})

/** Products in the category become uncategorised. */
adminCatalogRouter.delete('/categories/:id', async (req, res) => {
  await prisma.category.delete({ where: { id: req.params.id } })
  res.status(204).end()
})

// ─── Reviews ────────────────────────────────────────────────────────────────

adminCatalogRouter.get('/reviews', async (req, res) => {
  const q = z
    .object({ ...pageQuery, rating: z.coerce.number().int().min(1).max(5).optional(), q: z.string().trim().optional() })
    .parse(req.query)
  const where: Prisma.ReviewWhereInput = {
    ...(q.rating && { rating: q.rating }),
    ...(q.q && {
      OR: [
        { body: { contains: q.q, mode: 'insensitive' } },
        { title: { contains: q.q, mode: 'insensitive' } },
        { product: { name: { contains: q.q, mode: 'insensitive' } } },
      ],
    }),
  }
  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true, slug: true, images: true } },
      },
      ...paginate(q.page, q.pageSize),
    }),
    prisma.review.count({ where }),
  ])
  res.json(paged(items, total, q.page, q.pageSize))
})

adminCatalogRouter.delete('/reviews/:id', async (req, res) => {
  const review = await prisma.review.delete({ where: { id: req.params.id } })
  await recomputeRating(review.productId)
  res.status(204).end()
})
