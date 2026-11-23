import { createApp } from './app.js'
import { env } from './env.js'
import { closeQueues } from './queues/queues.js'
import { startWorkers } from './workers/index.js'

const app = createApp()

const server = app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`)
})

// Dev default: run the queue workers in this process so `pnpm dev` is all you need.
let stopWorkers: (() => Promise<void>) | undefined
if (env.runWorkersInApi) {
  startWorkers()
    .then((stop) => (stopWorkers = stop))
    .catch((err) => console.error('[worker] failed to start (is Redis running? `pnpm db:up`):', err.message))
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    server.close()
    await (stopWorkers ? stopWorkers() : closeQueues())
    process.exit(0)
  })
}
