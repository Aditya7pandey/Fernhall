/**
 * The consumers. One BullMQ Worker per queue; each routes a job to its handler by job name.
 *
 * Started either inside the API process (RUN_WORKERS_IN_API=true, the dev default) or as
 * its own process (`pnpm --filter @ecom/api worker`), which is what you'd run in production
 * so a burst of jobs can't slow down HTTP requests and you can scale workers separately.
 */
import { Worker, type Job } from 'bullmq'
import { handleExpireOrder } from '../jobs/expire-order.job.js'
import { handleOrderPlaced } from '../jobs/order-placed.job.js'
import { handlePaymentSucceeded } from '../jobs/payment-succeeded.job.js'
import { handleSweep } from '../jobs/sweep.job.js'
import { closeQueues, getOrdersQueue, JOBS, QUEUE_NAMES, workerConnection } from '../queues/queues.js'

const SWEEP_EVERY_MS = 10 * 60_000

async function processOrdersJob(job: Job) {
  switch (job.name) {
    case JOBS.orderPlaced:
      return handleOrderPlaced(job.data)
    case JOBS.expireOrder:
      return handleExpireOrder(job.data)
    case JOBS.sweep:
      return handleSweep()
    default:
      throw new Error(`Unknown job "${job.name}" on ${QUEUE_NAMES.orders}`)
  }
}

async function processPaymentsJob(job: Job) {
  switch (job.name) {
    case JOBS.paymentSucceeded:
      return handlePaymentSucceeded(job.data)
    default:
      throw new Error(`Unknown job "${job.name}" on ${QUEUE_NAMES.payments}`)
  }
}

function withLogging(worker: Worker) {
  worker.on('completed', (job, result) => console.log(`[worker] ✓ ${job.name} (${job.id}) →`, result))
  worker.on('failed', (job, err) =>
    console.error(`[worker] ✗ ${job?.name} (${job?.id}) attempt ${job?.attemptsMade}/${job?.opts.attempts}:`, err.message),
  )
  worker.on('error', (err) => console.error(`[worker] ${worker.name} error:`, err.message))
  return worker
}

export async function startWorkers({ schedule = true }: { schedule?: boolean } = {}) {
  const workers = [
    withLogging(new Worker(QUEUE_NAMES.orders, processOrdersJob, { connection: workerConnection(), concurrency: 5 })),
    withLogging(new Worker(QUEUE_NAMES.payments, processPaymentsJob, { connection: workerConnection(), concurrency: 5 })),
  ]

  // Repeatable job. upsert = safe to call on every boot / from several processes: one schedule.
  if (schedule) await getOrdersQueue().upsertJobScheduler('sweep-unpaid-orders', { every: SWEEP_EVERY_MS }, { name: JOBS.sweep, data: {} })

  console.log(`[worker] listening on queues: ${Object.values(QUEUE_NAMES).join(', ')}`)

  return async function stopWorkers() {
    // close() waits for running jobs to finish, so a deploy doesn't cut a job in half.
    await Promise.all(workers.map((w) => w.close()))
    await closeQueues()
  }
}
