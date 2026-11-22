import { prisma } from '@ecom/db'
import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../env.js'
import { clearAuthCookie, hashPassword, setAuthCookie, verifyPassword } from '../lib/auth.js'
import { mergeGuestCart } from '../lib/cart.js'
import { badRequest, conflict, unauthorized } from '../lib/http.js'
import { z } from '../lib/validate.js'
import { currentUser, requireAuth } from '../middleware/auth.js'

export const authRouter = Router()

// Brute-force protection; skipped in development so repeated test sign-ins don't lock you out
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
  skip: () => !env.isProd,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.', code: 'RATE_LIMITED' })
  },
})

const sessionSelect = { id: true, email: true, name: true, role: true, createdAt: true } as const

const email = z.string().trim().toLowerCase().email('Enter a valid email address')
const password = z.string().min(8, 'Password must be at least 8 characters').max(128)

authRouter.post('/register', authLimiter, async (req, res) => {
  const body = z
    .object({ name: z.string().trim().min(1, 'Name is required').max(100), email, password })
    .parse(req.body)

  if (await prisma.user.findUnique({ where: { email: body.email } })) {
    throw conflict('An account with this email already exists')
  }
  const user = await prisma.user.create({
    data: { name: body.name, email: body.email, passwordHash: await hashPassword(body.password) },
    select: sessionSelect,
  })
  setAuthCookie(res, { sub: user.id, role: user.role })
  await mergeGuestCart(req, res, user.id)
  res.status(201).json(user)
})

authRouter.post('/login', authLimiter, async (req, res) => {
  const body = z.object({ email, password: z.string().min(1, 'Password is required') }).parse(req.body)
  const user = await prisma.user.findUnique({ where: { email: body.email } })
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw unauthorized('Incorrect email or password')
  }
  setAuthCookie(res, { sub: user.id, role: user.role })
  await mergeGuestCart(req, res, user.id)
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt })
})

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.status(204).end()
})

/** Current session user, or null when signed out (200 either way, so clients can poll it freely). */
authRouter.get('/me', async (req, res) => {
  if (!req.user) {
    res.json(null)
    return
  }
  res.json(await prisma.user.findUnique({ where: { id: req.user.id }, select: sessionSelect }))
})

authRouter.patch('/me', requireAuth, async (req, res) => {
  const user = currentUser(req)
  const body = z.object({ name: z.string().trim().min(1).max(100).optional(), email: email.optional() }).parse(req.body)
  if (body.email && body.email !== user.email && (await prisma.user.findUnique({ where: { email: body.email } }))) {
    throw conflict('An account with this email already exists')
  }
  res.json(await prisma.user.update({ where: { id: user.id }, data: body, select: sessionSelect }))
})

authRouter.post('/password', requireAuth, async (req, res) => {
  const { id } = currentUser(req)
  const body = z.object({ currentPassword: z.string().min(1), newPassword: password }).parse(req.body)
  const user = await prisma.user.findUniqueOrThrow({ where: { id } })
  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
    throw badRequest('Current password is incorrect')
  }
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(body.newPassword) } })
  res.status(204).end()
})
