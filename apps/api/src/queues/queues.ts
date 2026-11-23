/**
 * BullMQ queues — the "message bus" between the API and the background workers.
 *
 *  API (producer)                  Redis                       Worker (consumer)
 *  ───────────────                 ─────                       ─────────────────
 *  order placed      ──add──▶  [ orders   ] ──process──▶  jobs/order-placed, jobs/expire-order, jobs/sweep
 *  payment succeeded ──add──▶  [ payments ] ──process──▶  jobs/payment-succeeded
 *
 * Why a queue at all? The HTTP request only does what MUST happen before we answer
 * (reserve stock, mark paid). Slow or flaky side effects (emails, cleanup) run later, are
 * retried with backoff when they fail, and can't slow down or break checkout.
 */
import { Queue, type DefaultJobOptions } from 'bullmq'
import { env } from '../env.js'

export const QUEUE_NAMES = { orders: 'orders', payments: 'payments' } as const

// ─── Job names + payloads ───────────────────────────────────────────────────
// Payloads carry IDs only, never whole records: the worker re-reads fresh data from the DB,
// so a job that runs (or retries) minutes later never acts on a stale snapshot.

export type OrderPlacedData = { orderId: string }
export type ExpireOrderData = { orderId: string }
export type PaymentSucceededData = { orderId: string; paymentId: string }

export const JOBS = {
  orderPlaced: 'order.placed',
  expireOrder: 'order.expire',
  sweep: 'orders.sweep',
  paymentSucceeded: 'payment.succeeded',
} as const

/**
 * Deterministic job ids = queue-level de-duplication. BullMQ ignores an `add` whose jobId
 * already exists, so publishing "payment succeeded" twice for one order enqueues ONE job.
 * (Ids may not contain ':' — BullMQ uses it as its own key separator.)
 */
export const jobIds = {
  orderPlaced: (orderId: string) => `order-placed-${orderId}`,
  expireOrder: (orderId: string) => `order-expire-${orderId}`,
  paymentSucceeded: (orderId: string) => `payment-succeeded-${orderId}`,
}

const defaultJobOptions: DefaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 }, // 5s, 10s, 20s, 40s
  // Keep finished jobs for a while: the jobId de-dup above only works while the job still exists.
  removeOnComplete: { age: 7 * 24 * 3600, count: 5_000 },
  removeOnFail: { age: 30 * 24 * 3600 },
}

/** Producer connection: fail fast-ish instead of hanging an HTTP request when Redis is down. */
const producerConnection = () => ({ url: env.redisUrl, maxRetriesPerRequest: 2 })

/** Worker connection: BullMQ requires maxRetriesPerRequest: null for its blocking commands. */
export const workerConnection = () => ({ url: env.redisUrl, maxRetriesPerRequest: null })

// Created lazily so importing this module (e.g. in tests) doesn't open a Redis connection.
let ordersQueue: Queue | undefined
let paymentsQueue: Queue | undefined

export const getOrdersQueue = () =>
  (ordersQueue ??= new Queue(QUEUE_NAMES.orders, { connection: producerConnection(), defaultJobOptions }))

export const getPaymentsQueue = () =>
  (paymentsQueue ??= new Queue(QUEUE_NAMES.payments, { connection: producerConnection(), defaultJobOptions }))

export async function closeQueues() {
  await Promise.all([ordersQueue?.close(), paymentsQueue?.close()])
  ordersQueue = paymentsQueue = undefined
}
