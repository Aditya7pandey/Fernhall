import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as auth from '../controllers/auth.controller.js'
import { env } from '../env.js'
import { requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

// Brute-force protection; skipped in development so repeated test sign-ins don't lock you out
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  skip: () => !env.isProd,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.', code: 'RATE_LIMITED' })
  },
})

authRouter.post('/register', authLimiter, auth.register)
authRouter.post('/login', authLimiter, auth.login)
authRouter.post('/logout', auth.logout)
authRouter.get('/me', auth.getMe)
authRouter.patch('/me', requireAuth, auth.updateMe)
authRouter.post('/password', requireAuth, auth.changePassword)
