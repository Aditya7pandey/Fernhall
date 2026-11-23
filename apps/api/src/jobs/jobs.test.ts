/**
 * Background jobs: every handler must be idempotent (BullMQ delivers AT LEAST once), and the
 * order state machine must survive "expiry vs payment" races.
 *
 * Uses the dev database (throwaway user/products, removed afterwards) and the docker Redis
 * for the last test. Emails are captured instead of logged.
 */
import { randomUUID } from 'node:crypto'
import { prisma } from '@ecom/db'
import { UnrecoverableError } from 'bullmq'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Email } from '../lib/mailer.js'
import { cancelUnpaidOrder } from '../lib/orders.js'
import { markOrderPaid } from '../lib/razorpay.js'
import { publishOrderPlaced } from '../queues/publishers.js'
import { getOrdersQueue, jobIds } from '../queues/queues.js'
import { startWorkers } from '../workers/index.js'
import { handleExpireOrder } from './expire-order.job.js'
import { handleOrderPlaced } from './order-placed.job.js'
import { handlePaymentSucceeded } from './payment-succeeded.job.js'

const sent = vi.hoisted(() => [] as Email[])
vi.mock('../lib/mailer.js', () => ({ sendEmail: vi.fn(async (e: Email) => void sent.push(e)) }))

let userId = ''
const productIds: string[] = []

/** An unpaid order for 2 × a product that has 5 left in stock (as if 2 were just reserved). */
async function makeOrder() {
  const product = await prisma.product.create({
    data: { name: 'Test lamp', slug: `test-lamp-${randomUUID()}`, description: 'x', priceCents: 10_000, stock: 5 },
  })
  productIds.push(product.id)
  const order = await prisma.order.create({
    data: {
      userId,
      email: 'jobs@test.local',
      shippingAddress: {},
      shippingMethod: 'standard',
      subtotalCents: 20_000,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 20_000,
      items: { create: [{ productId: product.id, name: product.name, priceCents: 10_000, quantity: 2 }] },
    },
  })
  return { order, product }
}

const notifications = (orderId: string) => prisma.orderNotification.findMany({ where: { orderId } })
const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stock

beforeAll(async () => {
  userId = (await prisma.user.create({ data: { email: `jobs-${Date.now()}@test.local`, name: 'Jobs', passwordHash: 'x' } })).id
})

afterAll(async () => {
  await prisma.order.deleteMany({ where: { userId } }) // cascades to items + notifications
  await prisma.product.deleteMany({ where: { id: { in: productIds } } })
  await prisma.user.delete({ where: { id: userId } })
  await prisma.$disconnect()
})

beforeEach(() => {
  sent.length = 0
})

describe('job handlers are idempotent', () => {
  it('order.placed twice → one "order received" email', async () => {
    const { order } = await makeOrder()
    expect(await handleOrderPlaced({ orderId: order.id })).toBe('sent')
    expect(await handleOrderPlaced({ orderId: order.id })).toBe('already-sent')
    expect(sent).toHaveLength(1)
    expect(await notifications(order.id)).toHaveLength(1)
  })

  it('payment.succeeded twice → one confirmation email', async () => {
    const { order } = await makeOrder()
    await markOrderPaid(order.id, 'pay_test_1')
    await handlePaymentSucceeded({ orderId: order.id, paymentId: 'pay_test_1' })
    await handlePaymentSucceeded({ orderId: order.id, paymentId: 'pay_test_1' })
    expect(sent.map((e) => e.subject)).toEqual([expect.stringContaining('Payment received')])
  })

  it('payment.succeeded for an unpaid order fails permanently (no pointless retries)', async () => {
    const { order } = await makeOrder()
    await expect(handlePaymentSucceeded({ orderId: order.id, paymentId: 'x' })).rejects.toBeInstanceOf(UnrecoverableError)
  })

  it('order.expire cancels an unpaid order, releases stock once, and is a no-op on retry', async () => {
    const { order, product } = await makeOrder()
    expect(await handleExpireOrder({ orderId: order.id })).toBe('cancelled')
    expect(await handleExpireOrder({ orderId: order.id })).toBe('already-settled')
    expect(await stockOf(product.id)).toBe(7) // 5 + 2, not 9
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('CANCELLED')
    expect(sent).toHaveLength(1)
  })

  it('order.expire leaves a paid order alone', async () => {
    const { order, product } = await makeOrder()
    await markOrderPaid(order.id, 'pay_test_2')
    expect(await handleExpireOrder({ orderId: order.id })).toBe('already-settled')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID')
    expect(await stockOf(product.id)).toBe(5)
  })
})

describe('race: payment vs cancellation', () => {
  it('when both happen at the same moment, exactly one wins — never "paid AND cancelled"', async () => {
    for (let i = 0; i < 10; i++) {
      const { order, product } = await makeOrder()
      const [paid, cancelled] = await Promise.all([
        markOrderPaid(order.id, `pay_race_${i}`),
        cancelUnpaidOrder(order.id).then(
          () => true,
          () => false,
        ),
      ])
      const final = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
      expect(paid.changed !== cancelled).toBe(true) // exactly one succeeded
      if (paid.changed) {
        expect(final).toMatchObject({ status: 'PAID', paymentStatus: 'PAID' })
        expect(await stockOf(product.id)).toBe(5)
      } else {
        expect(final).toMatchObject({ status: 'CANCELLED', paymentStatus: 'UNPAID' })
        expect(await stockOf(product.id)).toBe(7)
      }
    }
  })
})

describe('through BullMQ (needs Redis: pnpm db:up)', () => {
  it('publishing twice enqueues one job; the worker sends the email; expiry waits as a delayed job', async () => {
    const stop = await startWorkers({ schedule: false })
    try {
      const { order } = await makeOrder()
      await publishOrderPlaced(order.id)
      await publishOrderPlaced(order.id) // duplicate publish → same jobIds → ignored

      // Poll the DB until a worker (ours, or a running dev API's) has handled it
      let rows: Awaited<ReturnType<typeof notifications>> = []
      for (let i = 0; i < 50 && rows.length === 0; i++) {
        await new Promise((r) => setTimeout(r, 100))
        rows = await notifications(order.id)
      }
      expect(rows.map((r) => r.kind)).toEqual(['ORDER_RECEIVED'])

      const expiry = await getOrdersQueue().getJob(jobIds.expireOrder(order.id))
      expect(await expiry?.getState()).toBe('delayed')
      await expiry?.remove()
      await getOrdersQueue().remove(jobIds.orderPlaced(order.id))
    } finally {
      await stop()
    }
  })
})
