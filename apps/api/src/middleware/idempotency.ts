/**
 * ════════════════════════════════════════════════════════════════════════════
 *  Idempotency-Key middleware
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Goal: a POST sent twice with the same `Idempotency-Key` header performs the
 * operation ONCE. Every retry gets the original response back.
 *
 * Used on:  POST /orders                (place order — no double orders)
 *           POST /payments/orders/:id   (start payment — no double Razorpay orders)
 *
 * Table: `IdempotencyKey` (packages/db/prisma/schema.prisma)
 *   userId + key  (unique together)   method, path, requestHash,
 *   status: IN_PROGRESS | COMPLETED,  responseStatus, responseBody, createdAt
 *
 * ── Behaviour (each rule is a test in idempotency.test.ts) ───────────────────
 *  1. No `Idempotency-Key` header            → 400 IDEMPOTENCY_KEY_REQUIRED
 *  2. New key                                → run the handler, store its response
 *  3. Same key + same request, completed     → replay stored status + body, handler NOT run,
 *                                              header `Idempotent-Replayed: true`
 *  4. Same key + DIFFERENT request body      → 422 IDEMPOTENCY_KEY_REUSED
 *  5. Same key while the first is running    → 409 IDEMPOTENCY_IN_PROGRESS
 *  6. Handler responds 5xx or throws         → delete the row so the client can retry
 *  7. Keys are per user
 *  8. Keys older than `ttlHours`             → treated as brand new
 *
 * ── Algorithm ────────────────────────────────────────────────────────────────
 *  a) read + validate key       b) hash the request
 *  c) INSERT the row as a LOCK  (unique constraint settles races)
 *       P2002 → load row → expired? delete + retry · hash differs? 422 ·
 *               IN_PROGRESS? 409 · COMPLETED? replay
 *  d) we own the key → wrap res.json to capture the body
 *  e) on finish/close → <500 save COMPLETED, ≥500 / aborted → delete row
 *  f) next()
 * ════════════════════════════════════════════════════════════════════════════
 */
import { createHash } from 'node:crypto'
import { Prisma, prisma } from '@ecom/db'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { badRequest, HttpError } from '../lib/http.js'

export const IDEMPOTENCY_HEADER = 'idempotency-key'
export const REPLAYED_HEADER = 'Idempotent-Replayed'

export type IdempotencyOptions = {
  /** How long a stored result is replayed for. Default 24 hours. */
  ttlHours?: number
}

/** (a) Returns the trimmed key, or throws 400 when it's missing / malformed. */
export function readIdempotencyKey(req: Request): string {
  const key = req.get(IDEMPOTENCY_HEADER)?.trim()
  if (!key) throw badRequest('Missing Idempotency-Key header', 'IDEMPOTENCY_KEY_REQUIRED')
  if (key.length < 8 || key.length > 255) {
    throw badRequest('Idempotency-Key must be 8–255 characters', 'IDEMPOTENCY_KEY_REQUIRED')
  }
  return key
}

/**
 * (b) Fingerprint of "what is being asked": method + path + body.
 * Keys are sorted recursively so {a,b} and {b,a} hash the same.
 */
export function hashRequest(req: Request): string {
  const stable = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(stable)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable((value as Record<string, unknown>)[k])]))
        : value
  return createHash('sha256')
    .update(`${req.method} ${req.baseUrl}${req.path}\n${JSON.stringify(stable(req.body ?? null))}`)
    .digest('hex')
}

/** Prisma's "unique constraint failed" error. */
const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'

/**
 * Must run AFTER requireAuth (it needs req.user).
 */
export function idempotent(options: IdempotencyOptions = {}): RequestHandler {
  const ttlMs = (options.ttlHours ?? 24) * 60 * 60 * 1000

  return async (req: Request, res: Response, next: NextFunction) => {
    // (a) + (b)
    const key = readIdempotencyKey(req)
    const userId = req.user!.id // rule 7: every lookup is scoped to (userId, key)
    const requestHash = hashRequest(req)
    const where = { userId_key: { userId, key } }

    // (c) INSERT-AS-LOCK. Never "SELECT, then INSERT if missing": two concurrent requests
    // would both see "missing" and both run the handler. The unique (userId, key)
    // constraint guarantees exactly one INSERT wins; every loser gets P2002.
    for (;;) {
      try {
        await prisma.idempotencyKey.create({
          data: { userId, key, method: req.method, path: req.baseUrl + req.path, requestHash },
        })
        break // we own the key → go run the handler
      } catch (err) {
        if (!isUniqueViolation(err)) throw err

        const row = await prisma.idempotencyKey.findUnique({ where })
        // The owner deleted it between our INSERT and this SELECT (it failed with 5xx) → try again.
        if (!row) continue

        // Rule 8: expired → forget it and try to claim it fresh. deleteMany (not delete) so two
        // requests deleting the same expired row don't throw "record not found".
        if (Date.now() - row.createdAt.getTime() > ttlMs) {
          await prisma.idempotencyKey.deleteMany({ where: { id: row.id } })
          continue
        }

        // Rule 4: same key, different request → client bug. Don't replay the wrong answer.
        if (row.requestHash !== requestHash) {
          throw new HttpError(422, 'Idempotency-Key was used for a different request', 'IDEMPOTENCY_KEY_REUSED')
        }

        // Rule 5: the first request is still running → tell the client to retry later.
        if (row.status === 'IN_PROGRESS') {
          throw new HttpError(409, 'A request with this Idempotency-Key is in progress', 'IDEMPOTENCY_IN_PROGRESS')
        }

        // Rule 3: COMPLETED → replay; the handler never runs.
        res.setHeader(REPLAYED_HEADER, 'true')
        res.status(row.responseStatus!).json(row.responseBody)
        return
      }
    }

    // (d) We own the key. Capture whatever the handler sends via res.json.
    let body: unknown
    const originalJson = res.json.bind(res)
    res.json = (b: unknown) => {
      body = b
      return originalJson(b)
    }

    // (e) Persist the outcome exactly once. 'finish' = response fully sent.
    // 'close' without 'finish' = client hung up / stream aborted → we don't know the result,
    // so release the key (the client will retry with the same key).
    let done = false
    const settle = async () => {
      if (done) return
      done = true
      if (res.writableFinished && res.statusCode < 500) {
        // Rule 2 + 6b: 2xx AND 4xx are stored — a 4xx is a final answer for that request.
        await prisma.idempotencyKey.update({
          where,
          data: {
            status: 'COMPLETED',
            responseStatus: res.statusCode,
            responseBody: (body ?? null) as Prisma.InputJsonValue,
          },
        })
      } else {
        // Rule 6: 5xx / thrown error / aborted → transient, let the client retry.
        await prisma.idempotencyKey.deleteMany({ where: { userId, key } })
      }
    }
    res.on('finish', () => void settle().catch(console.error))
    res.on('close', () => void settle().catch(console.error))

    // (f)
    next()
  }
}
