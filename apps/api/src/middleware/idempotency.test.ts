/**
 * Spec for the idempotency middleware — each test maps to a numbered rule in idempotency.ts.
 * Runs against the dev database (creates two throwaway users, removes them afterwards).
 *
 *   pnpm --filter @ecom/api test            # once
 *   pnpm --filter @ecom/api test:watch      # re-run as you edit
 */
import { randomUUID } from 'node:crypto'
import { prisma } from '@ecom/db'
import express from 'express'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { errorHandler } from './error.js'
import { idempotent } from './idempotency.js'

// ─── Test app ───────────────────────────────────────────────────────────────
// A tiny Express app with one idempotent endpoint. The handler counts how many
// times it really ran, so we can prove retries didn't re-run it.

let handlerRuns = 0

function makeApp() {
  const app = express()
  app.use(express.json())
  // Fake auth: the test picks the user with a header
  app.use((req, _res, next) => {
    const id = req.get('x-test-user')
    if (id) req.user = { id, email: `${id}@test.local`, name: 'Test', role: 'CUSTOMER' }
    next()
  })
  app.post('/things', idempotent(), async (req, res) => {
    handlerRuns++
    const body = req.body as { delayMs?: number; fail?: boolean; throws?: boolean; invalid?: boolean }
    if (body.delayMs) await new Promise((r) => setTimeout(r, body.delayMs))
    if (body.throws) throw new Error('kaboom')
    if (body.fail) {
      res.status(500).json({ error: 'server exploded' })
      return
    }
    if (body.invalid) {
      res.status(400).json({ error: 'invalid input', code: 'VALIDATION_ERROR' })
      return
    }
    res.status(201).json({ thingId: randomUUID(), run: handlerRuns })
  })
  app.use(errorHandler)
  return app
}

const app = makeApp()
let alice = ''
let bob = ''

const post = (user: string, key: string | null, body: object = {}) => {
  const r = request(app).post('/things').set('x-test-user', user)
  if (key) r.set('Idempotency-Key', key)
  return r.send(body)
}

/** The middleware may save the result just after the response is sent — wait until it's settled. */
async function settled(user: string, key: string) {
  for (let i = 0; i < 40; i++) {
    const row = await prisma.idempotencyKey.findUnique({ where: { userId_key: { userId: user, key } } })
    if (!row || row.status !== 'IN_PROGRESS') return row
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`key ${key} stayed IN_PROGRESS`)
}

const newKey = () => `test-${randomUUID()}`

beforeAll(async () => {
  const stamp = Date.now()
  alice = (await prisma.user.create({ data: { email: `alice-${stamp}@test.local`, name: 'Alice', passwordHash: 'x' } })).id
  bob = (await prisma.user.create({ data: { email: `bob-${stamp}@test.local`, name: 'Bob', passwordHash: 'x' } })).id
})

afterAll(async () => {
  // Cascades to their IdempotencyKey rows
  await prisma.user.deleteMany({ where: { id: { in: [alice, bob] } } })
  await prisma.$disconnect()
})

beforeEach(() => {
  handlerRuns = 0
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('idempotent()', () => {
  it('1. rejects requests without an Idempotency-Key', async () => {
    const res = await post(alice, null)
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
    expect(handlerRuns).toBe(0)
  })

  it('2. runs the handler for a new key and stores the response', async () => {
    const key = newKey()
    const res = await post(alice, key, { name: 'lamp' })
    expect(res.status).toBe(201)
    expect(handlerRuns).toBe(1)

    const row = await settled(alice, key)
    expect(row?.status).toBe('COMPLETED')
    expect(row?.responseStatus).toBe(201)
    expect(row?.responseBody).toEqual(res.body)
  })

  it('3. replays the stored response for a retry, without re-running the handler', async () => {
    const key = newKey()
    const first = await post(alice, key, { name: 'lamp' })
    await settled(alice, key)

    const retry = await post(alice, key, { name: 'lamp' })
    expect(retry.status).toBe(first.status)
    expect(retry.body).toEqual(first.body) // same thingId — not a new thing
    expect(retry.headers['idempotent-replayed']).toBe('true')
    expect(handlerRuns).toBe(1)
  })

  it('3b. treats bodies with the same content in a different key order as the same request', async () => {
    const key = newKey()
    await post(alice, key, { a: 1, b: 2 })
    await settled(alice, key)
    const retry = await post(alice, key, { b: 2, a: 1 })
    expect(retry.status).toBe(201)
    expect(handlerRuns).toBe(1)
  })

  it('4. rejects the same key reused for a different request', async () => {
    const key = newKey()
    await post(alice, key, { name: 'lamp' })
    await settled(alice, key)

    const res = await post(alice, key, { name: 'sofa' })
    expect(res.status).toBe(422)
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REUSED')
    expect(handlerRuns).toBe(1)
  })

  it('5. answers 409 while the first request with that key is still running', async () => {
    const key = newKey()
    const body = { delayMs: 400 }
    const [a, b] = await Promise.all([post(alice, key, body), post(alice, key, body)])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([201, 409])
    const conflict = a.status === 409 ? a : b
    expect(conflict.body.code).toBe('IDEMPOTENCY_IN_PROGRESS')
    expect(handlerRuns).toBe(1) // the database let exactly one through
  })

  it('6a. forgets the key when the handler responds 5xx, so the client can retry', async () => {
    const key = newKey()
    expect((await post(alice, key, { fail: true })).status).toBe(500)
    expect(await settled(alice, key)).toBeNull()

    expect((await post(alice, key, { fail: true })).status).toBe(500)
    expect(handlerRuns).toBe(2) // retried for real
  })

  it('6b. forgets the key when the handler throws', async () => {
    const key = newKey()
    expect((await post(alice, key, { throws: true })).status).toBe(500)
    expect(await settled(alice, key)).toBeNull()
    expect((await post(alice, key, { throws: true })).status).toBe(500)
    expect(handlerRuns).toBe(2)
  })

  it('6c. stores 4xx responses (they are deterministic) and replays them', async () => {
    const key = newKey()
    const first = await post(alice, key, { invalid: true })
    expect(first.status).toBe(400)
    await settled(alice, key)

    const retry = await post(alice, key, { invalid: true })
    expect(retry.status).toBe(400)
    expect(retry.body).toEqual(first.body)
    expect(retry.headers['idempotent-replayed']).toBe('true')
    expect(handlerRuns).toBe(1)
  })

  it('7. scopes keys per user', async () => {
    const key = newKey()
    await post(alice, key, { name: 'lamp' })
    await settled(alice, key)

    const res = await post(bob, key, { name: 'lamp' })
    expect(res.status).toBe(201)
    expect(res.headers['idempotent-replayed']).toBeUndefined()
    expect(handlerRuns).toBe(2)
  })

  it('8. treats an expired key as new', async () => {
    const key = newKey()
    await post(alice, key, { name: 'lamp' })
    await settled(alice, key)

    // Pretend it was stored 25 hours ago (default TTL is 24h)
    await prisma.idempotencyKey.update({
      where: { userId_key: { userId: alice, key } },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    })

    const res = await post(alice, key, { name: 'lamp' })
    expect(res.status).toBe(201)
    expect(res.headers['idempotent-replayed']).toBeUndefined()
    expect(handlerRuns).toBe(2)
  })
})
