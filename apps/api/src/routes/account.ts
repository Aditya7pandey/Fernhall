import { Router } from 'express'
import * as account from '../controllers/account.controller.js'
import { requireAuth } from '../middleware/auth.js'

// ─── Wishlist ───────────────────────────────────────────────────────────────

export const wishlistRouter = Router()
wishlistRouter.use(requireAuth)
wishlistRouter.get('/', account.listWishlist)
wishlistRouter.get('/ids', account.listWishlistIds)
wishlistRouter.post('/:productId', account.addToWishlist)
wishlistRouter.delete('/:productId', account.removeFromWishlist)

// ─── Addresses ──────────────────────────────────────────────────────────────

export const addressesRouter = Router()
addressesRouter.use(requireAuth)
addressesRouter.get('/', account.listAddresses)
addressesRouter.post('/', account.createAddress)
addressesRouter.patch('/:id', account.updateAddress)
addressesRouter.delete('/:id', account.deleteAddress)
