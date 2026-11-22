import type { Role } from '@ecom/db'
import bcrypt from 'bcryptjs'
import type { CookieOptions, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../env.js'

export const AUTH_COOKIE = 'ecom_token'
export const CART_COOKIE = 'ecom_cart'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type TokenPayload = { sub: string; role: Role }

export const hashPassword = (password: string) => bcrypt.hash(password, 12)
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash)

export function signToken(payload: TokenPayload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret)
    if (typeof decoded === 'object' && typeof decoded.sub === 'string') {
      return { sub: decoded.sub, role: decoded.role as Role }
    }
    return null
  } catch {
    return null
  }
}

export const cookieOptions = (maxAge = WEEK_MS): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProd,
  maxAge,
  path: '/',
})

export function setAuthCookie(res: Response, payload: TokenPayload) {
  res.cookie(AUTH_COOKIE, signToken(payload), cookieOptions())
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, { ...cookieOptions(), maxAge: undefined })
}
