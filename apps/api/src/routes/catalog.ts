import { Router } from 'express'
import * as catalog from '../controllers/catalog.controller.js'
import { requireAuth } from '../middleware/auth.js'

export const catalogRouter = Router()

// ─── Categories ─────────────────────────────────────────────────────────────

catalogRouter.get('/categories', catalog.listCategories)
catalogRouter.get('/categories/:slug', catalog.getCategory)

// ─── Products ───────────────────────────────────────────────────────────────

catalogRouter.get('/products', catalog.listProducts)
catalogRouter.get('/products/:slug', catalog.getProduct)

// ─── Reviews ────────────────────────────────────────────────────────────────

catalogRouter.post('/products/:id/reviews', requireAuth, catalog.upsertReview)
