/**
 * Publishing events from the API. Called AFTER the database change has committed.
 *
 * These functions never throw. By the time we publish, the order is already saved / paid.
 * If a Redis hiccup turned into a 500 here, the client would retry, the idempotency
 * middleware would forget the key (5xx releases it) and the retry could create a SECOND
 * order. So a failed publish is logged, and the periodic sweep job (jobs/sweep.job.ts)
 * repairs anything that was missed: it expires stale unpaid orders and sends missing
 * payment confirmations straight from the database.
 */
import { env } from '../env.js'
import { getOrdersQueue, getPaymentsQueue, JOBS, jobIds } from './queues.js'

const PUBLISH_TIMEOUT_MS = 3_000

async function safely(what: string, work: () => Promise<unknown>) {
  let timer: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      work(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${PUBLISH_TIMEOUT_MS}ms`)), PUBLISH_TIMEOUT_MS)
      }),
    ])
  } catch (err) {
    console.error(`[queue] could not publish ${what} — the sweep job will catch up:`, (err as Error).message)
  } finally {
    clearTimeout(timer)
  }
}

/** Order placed → confirmation email now + "release the stock if still unpaid" later. */
export function publishOrderPlaced(orderId: string) {
  return safely(`${JOBS.orderPlaced} for order ${orderId}`, () =>
    getOrdersQueue().addBulk([
      { name: JOBS.orderPlaced, data: { orderId }, opts: { jobId: jobIds.orderPlaced(orderId) } },
      {
        name: JOBS.expireOrder,
        data: { orderId },
        // A DELAYED job: sits in Redis and becomes runnable only after the payment window.
        opts: { jobId: jobIds.expireOrder(orderId), delay: env.orderPaymentTimeoutMinutes * 60_000 },
      },
    ]),
  )
}

/**
 * Payment succeeded → payment confirmation email (and the expiry job is dropped).
 * Only the caller that actually flipped the order to PAID publishes (markOrderPaid's
 * `changed`), and the jobId de-dups anyway if verify and the webhook both get here.
 */
export function publishPaymentSucceeded(orderId: string, paymentId: string) {
  return safely(`${JOBS.paymentSucceeded} for order ${orderId}`, () =>
    getPaymentsQueue().add(JOBS.paymentSucceeded, { orderId, paymentId }, { jobId: jobIds.paymentSucceeded(orderId) }),
  )
}
