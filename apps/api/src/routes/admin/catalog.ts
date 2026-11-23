import { Router } from 'express'
import * as catalog from '../../controllers/admin/catalog.controller.js'

export const adminCatalogRouter = Router()

// ─── Products ───────────────────────────────────────────────────────────────

adminCatalogRouter.get('/products', catalog.listProducts)
adminCatalogRouter.get('/products/:id', catalog.getProduct)
adminCatalogRouter.post('/products', catalog.createProduct)
adminCatalogRouter.patch('/products/:id', catalog.updateProduct)
adminCatalogRouter.delete('/products/:id', catalog.deleteProduct)

// ─── Categories ─────────────────────────────────────────────────────────────

adminCatalogRouter.get('/categories', catalog.listCategories)
adminCatalogRouter.post('/categories', catalog.createCategory)
adminCatalogRouter.patch('/categories/:id', catalog.updateCategory)
adminCatalogRouter.delete('/categories/:id', catalog.deleteCategory)

// ─── Reviews ────────────────────────────────────────────────────────────────

adminCatalogRouter.get('/reviews', catalog.listReviews)
adminCatalogRouter.delete('/reviews/:id', catalog.deleteReview)
