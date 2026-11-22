import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './env.js'
import { attachUser } from './middleware/auth.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { addressesRouter, wishlistRouter } from './routes/account.js'
import { adminRouter } from './routes/admin/index.js'
import { authRouter } from './routes/auth.js'
import { cartRouter } from './routes/cart.js'
import { catalogRouter } from './routes/catalog.js'
import { checkoutRouter, ordersRouter } from './routes/orders.js'
import { paymentsRouter } from './routes/payments.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({ origin: env.corsOrigins, credentials: true }))
  // TODO(payments): mount the provider webhook here, before express.json(), so it receives the raw body.
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser(env.cookieSecret))
  app.use('/uploads', express.static(env.uploadDir, { maxAge: '7d', fallthrough: false }))
  app.use(attachUser)

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use('/auth', authRouter)
  app.use('/', catalogRouter) // /products, /categories
  app.use('/cart', cartRouter)
  app.use('/checkout', checkoutRouter)
  app.use('/orders', ordersRouter)
  app.use('/payments', paymentsRouter)
  app.use('/wishlist', wishlistRouter)
  app.use('/addresses', addressesRouter)
  app.use('/admin', adminRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
