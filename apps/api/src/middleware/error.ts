import { Prisma } from '@ecom/db'
import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'
import { ZodError } from 'zod'
import { HttpError } from '../lib/http.js'

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found`, code: 'NOT_FOUND' })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: err.issues[0]?.message ?? 'Invalid request',
      code: 'VALIDATION_ERROR',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
    return
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'A record with that value already exists', code: 'CONFLICT' })
      return
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' })
      return
    }
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' })
    return
  }
  // Razorpay SDK rejects with { statusCode, error: { code, description } } (not an Error instance)
  const rzp = err as { statusCode?: number; error?: { code?: string; description?: string } }
  if (typeof rzp?.statusCode === 'number' && rzp.error?.description) {
    console.error('[razorpay]', rzp.statusCode, rzp.error)
    res.status(502).json({ error: `Payment provider error: ${rzp.error.description}`, code: 'PAYMENT_PROVIDER_ERROR' })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Something went wrong', code: 'INTERNAL' })
}
