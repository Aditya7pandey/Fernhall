import { prisma, type OrderStatus, type Prisma } from '@ecom/db'
import type { Request, Response } from 'express'
import { badRequest, notFound, paged, paginate } from '../../lib/http.js'
import { ADMIN_TRANSITIONS, cancelUnpaidOrder, orderInclude } from '../../lib/orders.js'
import { pageQuery, z } from '../../lib/validate.js'
import { LOW_STOCK_THRESHOLD } from './catalog.controller.js'

const ORDER_STATUSES = Object.keys(ADMIN_TRANSITIONS) as [OrderStatus, ...OrderStatus[]]
const DAY_MS = 24 * 60 * 60 * 1000

const statsQuery = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) })
const listOrdersQuery = z.object({ ...pageQuery, status: z.enum(ORDER_STATUSES).optional(), q: z.string().trim().optional() })
const updateOrderStatusBody = z.object({ status: z.enum(ORDER_STATUSES) })
const listCustomersQuery = z.object({ ...pageQuery, q: z.string().trim().optional() })
const couponBody = z
  .object({
    code: z.string().trim().min(2).max(40).toUpperCase().regex(/^[A-Z0-9_-]+$/, 'Use letters, numbers, - and _ only'),
    description: z.string().trim().max(200).nullish(),
    type: z.enum(['PERCENT', 'FIXED']),
    value: z.number().int().min(1),
    minSubtotalCents: z.number().int().min(0).nullish(),
    maxUses: z.number().int().min(1).nullish(),
    expiresAt: z.coerce.date().nullish(),
    isActive: z.boolean().default(true),
  })
const createCouponBody = couponBody.refine((c) => c.type !== 'PERCENT' || c.value <= 100, { message: 'Percent must be 1–100', path: ['value'] })

// ─── Dashboard ──────────────────────────────────────────────────────────────

export async function getStats(req: Request, res: Response) {
  const { days } = statsQuery.parse(req.query)
  const since = new Date(Date.now() - days * DAY_MS)
  const prevSince = new Date(since.getTime() - days * DAY_MS)
  const paid = { paymentStatus: 'PAID' } as const

  const [current, previous, customers, newCustomers, ordersInRange, statusCounts, lowStock, topItems, recentOrders] =
    await Promise.all([
      prisma.order.aggregate({ where: { ...paid, createdAt: { gte: since } }, _sum: { totalCents: true }, _count: { _all: true } }),
      prisma.order.aggregate({
        where: { ...paid, createdAt: { gte: prevSince, lt: since } },
        _sum: { totalCents: true },
        _count: { _all: true },
      }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: since } } }),
      prisma.order.findMany({ where: { ...paid, createdAt: { gte: since } }, select: { createdAt: true, totalCents: true } }),
      prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.product.findMany({
        where: { isActive: true, stock: { lte: LOW_STOCK_THRESHOLD } },
        select: { id: true, name: true, slug: true, stock: true, images: true },
        orderBy: { stock: 'asc' },
        take: 8,
      }),
      prisma.orderItem.groupBy({
        by: ['productId', 'name'],
        where: { order: { ...paid, createdAt: { gte: since } }, productId: { not: null } },
        _sum: { quantity: true, priceCents: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: orderInclude }),
    ])

  // Daily revenue series (UTC days), including zero days
  const byDay = new Map<string, { revenueCents: number; orders: number }>()
  for (let i = days - 1; i >= 0; i--) {
    byDay.set(new Date(Date.now() - i * DAY_MS).toISOString().slice(0, 10), { revenueCents: 0, orders: 0 })
  }
  for (const o of ordersInRange) {
    const day = byDay.get(o.createdAt.toISOString().slice(0, 10))
    if (day) {
      day.revenueCents += o.totalCents
      day.orders += 1
    }
  }

  // Revenue per top product (quantity × unit price at time of sale)
  const topIds = topItems.map((t) => t.productId!).filter(Boolean)
  const topLines = await prisma.orderItem.findMany({
    where: { productId: { in: topIds }, order: { ...paid, createdAt: { gte: since } } },
    select: { productId: true, priceCents: true, quantity: true },
  })
  const topImages = await prisma.product.findMany({ where: { id: { in: topIds } }, select: { id: true, images: true } })

  const revenue = current._sum.totalCents ?? 0
  const prevRevenue = previous._sum.totalCents ?? 0
  const orders = current._count._all
  const prevOrders = previous._count._all
  const change = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 1000) / 10)

  res.json({
    rangeDays: days,
    revenueCents: revenue,
    revenueChangePct: change(revenue, prevRevenue),
    orders,
    ordersChangePct: change(orders, prevOrders),
    averageOrderCents: orders ? Math.round(revenue / orders) : 0,
    customers,
    newCustomers,
    pendingFulfilment: statusCounts.filter((s) => s.status === 'PAID' || s.status === 'PROCESSING').reduce((n, s) => n + s._count._all, 0),
    ordersByStatus: Object.fromEntries(ORDER_STATUSES.map((s) => [s, statusCounts.find((c) => c.status === s)?._count._all ?? 0])),
    revenueByDay: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    topProducts: topItems.map((t) => ({
      productId: t.productId!,
      name: t.name,
      imageUrl: topImages.find((p) => p.id === t.productId)?.images[0] ?? null,
      unitsSold: t._sum.quantity ?? 0,
      revenueCents: topLines.filter((l) => l.productId === t.productId).reduce((s, l) => s + l.priceCents * l.quantity, 0),
    })),
    lowStock,
    recentOrders,
  })
}

// ─── Orders ─────────────────────────────────────────────────────────────────

export async function listOrders(req: Request, res: Response) {
  const q = listOrdersQuery.parse(req.query)
  const orderNumber = q.q && /^#?\d+$/.test(q.q) ? Number(q.q.replace('#', '')) : null
  const where: Prisma.OrderWhereInput = {
    ...(q.status && { status: q.status }),
    ...(q.q && {
      OR: [
        ...(orderNumber != null ? [{ number: orderNumber }] : []),
        { email: { contains: q.q, mode: 'insensitive' } },
        { user: { name: { contains: q.q, mode: 'insensitive' } } },
      ],
    }),
  }
  const [items, total] = await Promise.all([
    prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.pageSize) }),
    prisma.order.count({ where }),
  ])
  res.json(paged(items, total, q.page, q.pageSize))
}

export async function getOrder(req: Request<{ id: string }>, res: Response) {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude })
  if (!order) throw notFound('Order')
  res.json({ ...order, allowedTransitions: ADMIN_TRANSITIONS[order.status] })
}

export async function updateOrderStatus(req: Request<{ id: string }>, res: Response) {
  const { status } = updateOrderStatusBody.parse(req.body)
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) throw notFound('Order')
  if (!ADMIN_TRANSITIONS[order.status].includes(status)) {
    throw badRequest(`Can't change an order from ${order.status} to ${status}`, 'INVALID_TRANSITION')
  }

  const updated =
    status === 'CANCELLED'
      ? await cancelUnpaidOrder(order.id)
      : await prisma.order.update({
          where: { id: order.id },
          data: {
            status,
            ...(status === 'SHIPPED' && { shippedAt: new Date() }),
            ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
          },
          include: orderInclude,
        })
  res.json({ ...updated, allowedTransitions: ADMIN_TRANSITIONS[updated.status] })
}

// ─── Customers ──────────────────────────────────────────────────────────────

export async function listCustomers(req: Request, res: Response) {
  const q = listCustomersQuery.parse(req.query)
  const where: Prisma.UserWhereInput = {
    role: 'CUSTOMER',
    ...(q.q && {
      OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }],
    }),
  }
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, createdAt: true, _count: { select: { orders: true } } },
      ...paginate(q.page, q.pageSize),
    }),
    prisma.user.count({ where }),
  ])
  const spend = await prisma.order.groupBy({
    by: ['userId'],
    where: { userId: { in: users.map((u) => u.id) }, paymentStatus: 'PAID' },
    _sum: { totalCents: true },
    _max: { createdAt: true },
  })
  const items = users.map(({ _count, ...u }) => {
    const s = spend.find((x) => x.userId === u.id)
    return { ...u, orderCount: _count.orders, totalSpentCents: s?._sum.totalCents ?? 0, lastOrderAt: s?._max.createdAt ?? null }
  })
  res.json(paged(items, total, q.page, q.pageSize))
}

export async function getCustomer(req: Request<{ id: string }>, res: Response) {
  const user = await prisma.user.findFirst({
    where: { id: req.params.id },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
      addresses: { orderBy: { isDefault: 'desc' } },
      orders: { orderBy: { createdAt: 'desc' }, include: orderInclude },
    },
  })
  if (!user) throw notFound('Customer')
  const totalSpentCents = user.orders.filter((o) => o.paymentStatus === 'PAID').reduce((s, o) => s + o.totalCents, 0)
  res.json({ ...user, orderCount: user.orders.length, totalSpentCents })
}

// ─── Coupons ────────────────────────────────────────────────────────────────

export async function listCoupons(_req: Request, res: Response) {
  res.json(await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } }))
}

export async function createCoupon(req: Request, res: Response) {
  const body = createCouponBody.parse(req.body)
  res.status(201).json(await prisma.coupon.create({ data: body }))
}

export async function updateCoupon(req: Request<{ id: string }>, res: Response) {
  const body = couponBody.partial().parse(req.body)
  const existing = await prisma.coupon.findUnique({ where: { id: req.params.id } })
  if (!existing) throw notFound('Coupon')
  if ((body.type ?? existing.type) === 'PERCENT' && (body.value ?? existing.value) > 100) {
    throw badRequest('Percent must be 1–100')
  }
  res.json(await prisma.coupon.update({ where: { id: existing.id }, data: body }))
}

export async function deleteCoupon(req: Request<{ id: string }>, res: Response) {
  await prisma.coupon.delete({ where: { id: req.params.id } })
  res.status(204).end()
}
