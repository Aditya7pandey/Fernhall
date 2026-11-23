/** Standalone worker process: `pnpm --filter @ecom/api worker` (dev) / `worker:start` (built). */
import { startWorkers } from './workers/index.js'

const stop = await startWorkers()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    console.log(`[worker] ${signal} received, finishing running jobs…`)
    await stop()
    process.exit(0)
  })
}
