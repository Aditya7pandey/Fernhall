import { prisma, type Prisma } from '@ecom/db'
import type { Request, Response } from 'express'
import { notFound, paged, paginate } from '../lib/http.js'
import { recomputeRating } from '../lib/reviews.js'
import { pageQuery, queryBool, z } from '../lib/validate.js'
import { currentUser } from '../middleware/auth.js'

export const productListSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  priceCents: true,
  compareAtPriceCents: true,
  sku: true,
  stock: true,
  images: true,
  categoryId: true,
  featured: true,
  isActive: true,
  ratingAvg: true,
  ratingCount: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },
} as const satisfies Prisma.ProductSelect

const SORTS = {
  newest: { createdAt: 'desc' },
  price_asc: { priceCents: 'asc' },
  price_desc: { priceCents: 'desc' },
  rating: { ratingAvg: 'desc' },
  popular: { ratingCount: 'desc' },
  name: { name: 'asc' },
} as const satisfies Record<string, Prisma.ProductOrderByWithRelationInput>

const listProductsQuery = z.object({
  ...pageQuery,
  pageSize: z.coerce.number().int().min(1).max(48).default(12),
  q: z.string().trim().max(100).optional(),
  category: z.string().optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: queryBool,
  onSale: queryBool,
  featured: queryBool,
  sort: z.enum(Object.keys(SORTS) as [keyof typeof SORTS]).default('newest'),
})
const reviewBody = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1, 'Please write a few words').max(2000),
})

// ─── Categories ─────────────────────────────────────────────────────────────

export async function listCategories(_req: Request, res: Response) {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  })
  res.json(categories.map(({ _count, ...c }) => ({ ...c, productCount: _count.products })))
}

export async function getCategory(req: Request<{ slug: string }>, res: Response) {
  const category = await prisma.category.findUnique({ where: { slug: req.params.slug } })
  if (!category) throw notFound('Category')
  res.json(category)
}

// ─── Products ───────────────────────────────────────────────────────────────

export async function listProducts(req: Request, res: Response) {
  const q = listProductsQuery.parse(req.query)

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(q.q && {
      OR: [
        { name: { contains: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
        { category: { name: { contains: q.q, mode: 'insensitive' } } },
      ],
    }),
    ...(q.category && { category: { slug: q.category } }),
    ...((q.minPrice != null || q.maxPrice != null) && {
      priceCents: { ...(q.minPrice != null && { gte: q.minPrice }), ...(q.maxPrice != null && { lte: q.maxPrice }) },
    }),
    ...(q.inStock && { stock: { gt: 0 } }),
    ...(q.onSale && { compareAtPriceCents: { not: null } }),
    ...(q.featured && { featured: true }),
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: productListSelect,
      orderBy: [SORTS[q.sort], { id: 'asc' }],
      ...paginate(q.page, q.pageSize),
    }),
    prisma.product.count({ where }),
  ])
  res.json(paged(items, total, q.page, q.pageSize))
}

export async function getProduct(req: Request<{ slug: string }>, res: Response) {
  const product = await prisma.product.findFirst({
    where: { slug: req.params.slug, isActive: true },
    select: {
      ...productListSelect,
      reviews: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { name: true } } },
      },
    },
  })
  if (!product) throw notFound('Product')

  const related = await prisma.product.findMany({
    where: { isActive: true, id: { not: product.id }, categoryId: product.categoryId },
    select: productListSelect,
    orderBy: { ratingAvg: 'desc' },
    take: 4,
  })

  const breakdown = await prisma.review.groupBy({
    by: ['rating'],
    where: { productId: product.id },
    _count: { _all: true },
  })
  const ratingBreakdown = Object.fromEntries([1, 2, 3, 4, 5].map((r) => [r, 0])) as Record<number, number>
  for (const b of breakdown) ratingBreakdown[b.rating] = b._count._all

  res.json({ ...product, related, ratingBreakdown })
}

// ─── Reviews ────────────────────────────────────────────────────────────────

export async function upsertReview(req: Request<{ id: string }>, res: Response) {
  const user = currentUser(req)
  const body = reviewBody.parse(req.body)

  const product = await prisma.product.findFirst({ where: { id: req.params.id, isActive: true } })
  if (!product) throw notFound('Product')

  const review = await prisma.review.upsert({
    where: { productId_userId: { productId: product.id, userId: user.id } },
    create: { ...body, productId: product.id, userId: user.id },
    update: body,
    include: { user: { select: { name: true } } },
  })
  await recomputeRating(product.id)
  res.status(201).json(review)
}
