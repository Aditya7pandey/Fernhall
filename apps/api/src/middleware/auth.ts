import { prisma, type Role } from '@ecom/db'
import type { NextFunction, Request, Response } from 'express'
import { AUTH_COOKIE, clearAuthCookie, verifyToken } from '../lib/auth.js'
import { forbidden, unauthorized } from '../lib/http.js'

export type SessionUser = { id: string; email: string; name: string; role: Role }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

/** Resolves the signed-in user (if any) from the auth cookie. Never rejects the request. */
export async function attachUser(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[AUTH_COOKIE] as string | undefined
  if (!token) return next()
  const payload = verifyToken(token)
  if (payload) {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    })
    if (user) {
      req.user = user
      return next()
    }
  }
  clearAuthCookie(res)
  next()
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized())
  next()
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized())
  if (req.user.role !== 'ADMIN') return next(forbidden())
  next()
}

/** For handlers behind requireAuth */
export function currentUser(req: Request): SessionUser {
  if (!req.user) throw unauthorized()
  return req.user
}
