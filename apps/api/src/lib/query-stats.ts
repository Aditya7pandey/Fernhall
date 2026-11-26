import { AsyncLocalStorage } from 'node:async_hooks'
import { prisma, type Prisma } from '@ecom/db'

/**
 * Per-request SQL accounting, used to SEE N+1 problems.
 *
 * Prisma emits a `query` event for every SQL statement it sends (an `include` is its own
 * statement). The event fires inside the async context of whoever awaited the query, so an
 * AsyncLocalStorage store started by the request middleware collects exactly that request's
 * statements — even with many requests running concurrently.
 *
 * N+1 signature: the SAME SQL text (Prisma always parameterises, so `WHERE id = $1` looks
 * identical for every id) running many times in one request.
 */
export type QueryStats = {
  count: number
  dbMs: number
  /** SQL text → how many times it ran in this request */
  byStatement: Map<string, { times: number; ms: number }>
}

const storage = new AsyncLocalStorage<QueryStats>()

/** Statements repeated at least this often in one request are reported as a likely N+1 */
export const N_PLUS_ONE_THRESHOLD = 5

let listening = false
function listen() {
  if (listening) return
  listening = true
  // packages/db creates the client with log: [{ emit: 'event', level: 'query' }]; the exported
  // type doesn't carry that generic, so narrow $on by hand.
  const onQuery = prisma.$on.bind(prisma) as unknown as (event: 'query', cb: (e: Prisma.QueryEvent) => void) => void
  onQuery('query', (e) => {
    const stats = storage.getStore()
    if (!stats) return // query outside a request (workers, startup)
    stats.count += 1
    stats.dbMs += e.duration
    const entry = stats.byStatement.get(e.query) ?? { times: 0, ms: 0 }
    entry.times += 1
    entry.ms += e.duration
    stats.byStatement.set(e.query, entry)
  })
}

/** Runs `fn` with a fresh stats store; everything it awaits is attributed to it. */
export function withQueryStats<T>(fn: () => T) {
  listen()
  const stats: QueryStats = { count: 0, dbMs: 0, byStatement: new Map() }
  return { stats, result: storage.run(stats, fn) }
}

export const currentQueryStats = () => storage.getStore()

/** Repeated statements, worst first — the N+1 suspects */
export function repeatedStatements(stats: QueryStats, min = N_PLUS_ONE_THRESHOLD) {
  return [...stats.byStatement.entries()]
    .filter(([, v]) => v.times >= min)
    .sort((a, b) => b[1].times - a[1].times)
    .map(([sql, v]) => ({ sql, ...v }))
}
