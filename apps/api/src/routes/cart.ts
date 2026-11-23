import { Router } from 'express'
import * as cart from '../controllers/cart.controller.js'

export const cartRouter = Router()
cartRouter.get('/', cart.getCart)
cartRouter.post('/items', cart.addItem)
cartRouter.patch('/items/:productId', cart.updateItem)
cartRouter.delete('/items/:productId', cart.removeItem)
cartRouter.delete('/', cart.clearCart)
cartRouter.post('/coupon', cart.applyCoupon)
cartRouter.delete('/coupon', cart.removeCoupon)
