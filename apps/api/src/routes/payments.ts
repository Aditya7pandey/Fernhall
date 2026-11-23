import express, { Router } from 'express'
import * as payments from '../controllers/payments.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { idempotent } from '../middleware/idempotency.js'

export const paymentsRouter = Router()
paymentsRouter.post('/orders/:id', requireAuth, idempotent(), payments.startPayment)
paymentsRouter.post('/verify', requireAuth, payments.verifyPayment)

/** Mounted in app.ts BEFORE express.json(): the webhook signature is computed over the raw body. */
export const paymentsWebhookRouter = Router()
paymentsWebhookRouter.post('/', express.raw({ type: 'application/json', limit: '1mb' }), payments.handleWebhook)
