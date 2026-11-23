import { prisma } from '@ecom/db'
import type { Request, Response } from 'express'
import { clearAuthCookie, hashPassword, setAuthCookie, verifyPassword } from '../lib/auth.js'
import { mergeGuestCart } from '../lib/cart.js'
import { badRequest, conflict, unauthorized } from '../lib/http.js'
import { z } from '../lib/validate.js'
import { currentUser } from '../middleware/auth.js'

const sessionSelect = { id: true, email: true, name: true, role: true, createdAt: true } as const

const email = z.string().trim().toLowerCase().email('Enter a valid email address')
const password = z.string().min(8, 'Password must be at least 8 characters').max(128)

const registerBody = z.object({ name: z.string().trim().min(1, 'Name is required').max(100), email, password })
const loginBody = z.object({ email, password: z.string().min(1, 'Password is required') })
const updateMeBody = z.object({ name: z.string().trim().min(1).max(100).optional(), email: email.optional() })
const changePasswordBody = z.object({ currentPassword: z.string().min(1), newPassword: password })

export async function register(req: Request, res: Response) {
  const body = registerBody.parse(req.body)

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
}

export async function login(req: Request, res: Response) {
  const body = loginBody.parse(req.body)
  const user = await prisma.user.findUnique({ where: { email: body.email } })
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw unauthorized('Incorrect email or password')
  }
  setAuthCookie(res, { sub: user.id, role: user.role })
  await mergeGuestCart(req, res, user.id)
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt })
}

export function logout(_req: Request, res: Response) {
  clearAuthCookie(res)
  res.status(204).end()
}

/** Current session user, or null when signed out (200 either way, so clients can poll it freely). */
export async function getMe(req: Request, res: Response) {
  if (!req.user) {
    res.json(null)
    return
  }
  res.json(await prisma.user.findUnique({ where: { id: req.user.id }, select: sessionSelect }))
}

export async function updateMe(req: Request, res: Response) {
  const user = currentUser(req)
  const body = updateMeBody.parse(req.body)
  if (body.email && body.email !== user.email && (await prisma.user.findUnique({ where: { email: body.email } }))) {
    throw conflict('An account with this email already exists')
  }
  res.json(await prisma.user.update({ where: { id: user.id }, data: body, select: sessionSelect }))
}

export async function changePassword(req: Request, res: Response) {
  const { id } = currentUser(req)
  const body = changePasswordBody.parse(req.body)
  const user = await prisma.user.findUniqueOrThrow({ where: { id } })
  if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
    throw badRequest('Current password is incorrect')
  }
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(body.newPassword) } })
  res.status(204).end()
}
