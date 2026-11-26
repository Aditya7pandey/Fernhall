import type { NextFunction, Request, Response } from 'express'
import { repeatedStatements, withQueryStats } from '../lib/query-stats.js'

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`
const red = (s: string) => `\x1b[31m${s}\x1b[0m`

/**
 * Dev-only: counts the SQL each request runs and reports it
 *   - in the API terminal:   GET /admin/orders?page=2 → 200 · 4 queries · 12.3ms db · 18ms total
 *   - as response headers:   X-DB-Queries, Server-Timing (browser DevTools → Network → Timing)
 * and warns when one statement repeats N_PLUS_ONE_THRESHOLD+ times (the N+1 signature).
 */
export function queryProfiler(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/health') return next()
  const started = performance.now()
  const { stats } = withQueryStats(() => next())

  // Headers must be set before they're sent, so hook writeHead (queries after it aren't in the header)
  const writeHead = res.writeHead
  res.writeHead = function (this: Response, ...args: Parameters<Response['writeHead']>) {
    if (!res.headersSent) {
      res.setHeader('X-DB-Queries', String(stats.count))
      res.setHeader('Server-Timing', `db;dur=${stats.dbMs.toFixed(1)};desc="${stats.count} SQL queries"`)
    }
    return writeHead.apply(this, args)
  } as Response['writeHead']

  res.on('finish', () => {
    if (stats.count === 0) return
    const total = performance.now() - started
    const repeats = repeatedStatements(stats)
    const count = `${stats.count} ${stats.count === 1 ? 'query' : 'queries'}`
    const line = `${req.method} ${req.originalUrl} → ${res.statusCode} · ${count} · ${stats.dbMs.toFixed(1)}ms db · ${total.toFixed(0)}ms total`
    console.log(repeats.length ? yellow(line) : dim(line))
    for (const r of repeats.slice(0, 3)) {
      console.log(red(`  ⚠ possible N+1: ran ${r.times}× (${r.ms.toFixed(1)}ms) → ${r.sql.replace(/\s+/g, ' ').slice(0, 160)}`))
    }
  })
}
