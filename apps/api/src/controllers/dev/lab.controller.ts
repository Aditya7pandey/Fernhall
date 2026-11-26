import { prisma } from '@ecom/db'
import type { Request, Response } from 'express'
import { notFound, paginate } from '../../lib/http.js'
import { currentQueryStats, repeatedStatements } from '../../lib/query-stats.js'
import { pageQuery, z } from '../../lib/validate.js'

/**
 * Performance lab (dev only, mounted at /dev/lab).
 *
 * Each endpoint builds the SAME response several ways so you can compare query counts and
 * timings side by side. Every response carries `_meta` with what the request cost; the API
 * terminal prints the same line and flags repeated statements.
 *
 *   GET /dev/lab/customers?impl=naive|parallel|batched
 *   GET /dev/lab/orders?impl=naive|include
 *   GET /dev/lab/explain            → list of index experiments
 *   GET /dev/lab/explain/:name      → EXPLAIN ANALYZE of one query (look for "Seq Scan")
 */

const meta = (impl: string, started: number) => {
  const s = currentQueryStats()
  return {
    impl,
    queries: s?.count ?? 0,
    dbMs: Math.round((s?.dbMs ?? 0) * 10) / 10,
    totalMs: Math.round(performance.now() - started),
    repeated: s ? repeatedStatements(s).map((r) => ({ times: r.times, sql: r.sql.replace(/\s+/g, ' ').slice(0, 200) })) : [],
  }
}

// ─── 1. Customers list: count + spend per customer ─────────────────────────────

const customersQuery = z.object({ ...pageQuery, impl: z.enum(['naive', 'parallel', 'batched']).default('naive') })

export async function labCustomers(req: Request, res: Response) {
  const started = performance.now()
  const q = customersQuery.parse(req.query)
  const users = await prisma.user.findMany({
    where: { role: 'CUSTOMER' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true },
    ...paginate(q.page, q.pageSize),
  })

  let items
  if (q.impl === 'naive') {
    // ❌ N+1: 1 query for the page + 2 per customer. pageSize=100 → 201 queries.
    items = []
    for (const u of users) {
      const orderCount = await prisma.order.count({ where: { userId: u.id } })
      const spend = await prisma.order.aggregate({ where: { userId: u.id, paymentStatus: 'PAID' }, _sum: { totalCents: true } })
      items.push({ ...u, orderCount, totalSpentCents: spend._sum.totalCents ?? 0 })
    }
  } else if (q.impl === 'parallel') {
    // ⚠ Still N+1 — same 201 queries, just fired concurrently. Faster wall-clock on an idle DB,
    // but it competes for the connection pool (default ~10), so under load it's often SLOWER.
    items = await Promise.all(
      users.map(async (u) => {
        const [orderCount, spend] = await Promise.all([
          prisma.order.count({ where: { userId: u.id } }),
          prisma.order.aggregate({ where: { userId: u.id, paymentStatus: 'PAID' }, _sum: { totalCents: true } }),
        ])
        return { ...u, orderCount, totalSpentCents: spend._sum.totalCents ?? 0 }
      }),
    )
  } else {
    // ✅ Batched: one GROUP BY for the whole page (… WHERE "userId" IN ($1…$n)). 2 queries total,
    // whatever the page size. This is what admin/sales.controller.ts → listCustomers does.
    const ids = users.map((u) => u.id)
    const [counts, spend] = await Promise.all([
      prisma.order.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: { _all: true } }),
      prisma.order.groupBy({ by: ['userId'], where: { userId: { in: ids }, paymentStatus: 'PAID' }, _sum: { totalCents: true } }),
    ])
    const countBy = new Map(counts.map((c) => [c.userId, c._count._all]))
    const spendBy = new Map(spend.map((s) => [s.userId, s._sum.totalCents ?? 0]))
    items = users.map((u) => ({ ...u, orderCount: countBy.get(u.id) ?? 0, totalSpentCents: spendBy.get(u.id) ?? 0 }))
  }
  res.json({ _meta: meta(q.impl, started), items })
}

// ─── 2. Orders list with line items, product links and customer ───────────────

const ordersQuery = z.object({ ...pageQuery, impl: z.enum(['naive', 'include']).default('naive') })

export async function labOrders(req: Request, res: Response) {
  const started = performance.now()
  const q = ordersQuery.parse(req.query)

  let items
  if (q.impl === 'naive') {
    // ❌ N+1 nested: 1 + N (items) + N (users) + N×M (products).
    // 20 orders × ~2 items ≈ 80 queries. And OrderItem."orderId" has no index, so each of the
    // N item lookups is a full table scan — the N+1 and the missing index multiply each other.
    const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, ...paginate(q.page, q.pageSize) })
    items = []
    for (const order of orders) {
      const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { name: true } })
      const lines = await prisma.orderItem.findMany({ where: { orderId: order.id } })
      const withProducts = []
      for (const line of lines) {
        const product = line.productId
          ? await prisma.product.findUnique({ where: { id: line.productId }, select: { slug: true } })
          : null
        withProducts.push({ ...line, productSlug: product?.slug ?? null })
      }
      items.push({ id: order.id, number: order.number, totalCents: order.totalCents, customer: user?.name, items: withProducts })
    }
  } else {
    // ✅ `include` = one query per RELATION, not per row: orders, then users IN (…), items IN (…),
    // products IN (…). 4 queries for any page size.
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      ...paginate(q.page, q.pageSize),
      include: { user: { select: { name: true } }, items: { include: { product: { select: { slug: true } } } } },
    })
    items = orders.map((o) => ({
      id: o.id,
      number: o.number,
      totalCents: o.totalCents,
      customer: o.user.name,
      items: o.items.map(({ product, ...line }) => ({ ...line, productSlug: product?.slug ?? null })),
    }))
  }
  res.json({ _meta: meta(q.impl, started), items })
}

// ─── 3. Index experiments: EXPLAIN ANALYZE ───────────────────────────────────

type Experiment = {
  description: string
  /** Fixed SQL (never user input). $1 is filled from `param` */
  sql: string
  param?: () => Promise<string>
  fix: string
}

const anOrderId = async () => (await prisma.order.findFirstOrThrow({ orderBy: { createdAt: 'desc' }, select: { id: true } })).id
const aBestSellerId = async () =>
  (await prisma.product.findFirstOrThrow({ orderBy: { ratingCount: 'desc' }, select: { id: true } })).id
const aCustomerId = async () =>
  (await prisma.user.findFirstOrThrow({ where: { role: 'CUSTOMER', orders: { some: {} } }, select: { id: true } })).id

const EXPERIMENTS: Record<string, Experiment> = {
  'order-items': {
    description: 'Line items of one order (every order page, every `include: { items }`)',
    sql: `SELECT * FROM "OrderItem" WHERE "orderId" = $1`,
    param: anOrderId,
    fix: 'OrderItem: @@index([orderId])',
  },
  'product-sales': {
    description: 'Units sold for one product (top products, product analytics)',
    sql: `SELECT SUM(quantity) FROM "OrderItem" WHERE "productId" = $1`,
    param: aBestSellerId,
    fix: 'OrderItem: @@index([productId])',
  },
  'revenue-30d': {
    description: 'Dashboard revenue chart: paid orders in the last 30 days, per day',
    sql: `SELECT date_trunc('day', "createdAt") AS day, SUM("totalCents") FROM "Order"
          WHERE "paymentStatus" = 'PAID' AND "createdAt" >= now() - interval '30 days' GROUP BY 1 ORDER BY 1`,
    fix: 'Order: @@index([createdAt])  — or @@index([paymentStatus, createdAt]); compare both',
  },
  'orders-page-deep': {
    description: 'Admin orders list, page 250 (OFFSET pagination, newest first)',
    sql: `SELECT id, number, "totalCents" FROM "Order" ORDER BY "createdAt" DESC LIMIT 20 OFFSET 5000`,
    fix: 'Order: @@index([createdAt]) removes the sort; keyset pagination (WHERE "createdAt" < $last) removes the OFFSET walk',
  },
  'customer-orders': {
    description: 'CONTROL — "My orders" for one customer. Already indexed: expect an Index/Bitmap scan',
    sql: `SELECT id, number, "createdAt" FROM "Order" WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
    param: aCustomerId,
    fix: 'Already uses @@index([userId]). @@index([userId, createdAt]) would also drop the Sort node',
  },
  'product-search': {
    description: 'Shop search box: name ILIKE %term%',
    sql: `SELECT id, name FROM "Product" WHERE name ILIKE '%' || $1 || '%'`,
    param: async () => 'tee',
    fix: 'A B-tree index can\'t serve a leading %. Needs pg_trgm: CREATE INDEX … USING gin (name gin_trgm_ops)',
  },
}

export async function listExperiments(_req: Request, res: Response) {
  res.json(Object.entries(EXPERIMENTS).map(([name, e]) => ({ name, url: `/dev/lab/explain/${name}`, description: e.description })))
}

export async function explainExperiment(req: Request<{ name: string }>, res: Response) {
  const exp = EXPERIMENTS[req.params.name]
  if (!exp) throw notFound('Experiment')
  const params = exp.param ? [await exp.param()] : []
  const rows = await prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(`EXPLAIN (ANALYZE, BUFFERS) ${exp.sql}`, ...params)
  const plan = rows.map((r) => r['QUERY PLAN'])
  const seqScans = plan.filter((l) => l.includes('Seq Scan')).map((l) => l.trim())
  res.json({
    name: req.params.name,
    description: exp.description,
    sql: exp.sql.replace(/\s+/g, ' '),
    params,
    executionMs: Number(plan.find((l) => l.startsWith('Execution Time'))?.match(/[\d.]+/)?.[0] ?? NaN),
    seqScans,
    verdict: seqScans.length ? 'Full table scan — every row is read. Candidate for an index.' : 'Uses an index (or the table is tiny).',
    suggestedFix: exp.fix,
    plan,
  })
}
