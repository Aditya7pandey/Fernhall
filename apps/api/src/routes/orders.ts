import { Router } from 'express'
import * as orders from '../controllers/orders.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { idempotent } from '../middleware/idempotency.js'

export const checkoutRouter = Router()
checkoutRouter.get('/shipping-methods', orders.listShippingMethods)
checkoutRouter.get('/quote', orders.getQuote)

export const ordersRouter = Router()
ordersRouter.use(requireAuth)
// idempotent(): a double-clicked "Place order" (or a network retry) creates ONE order
ordersRouter.post('/', idempotent(), orders.placeOrder)
ordersRouter.get('/', orders.listMyOrders)
ordersRouter.get('/:id', orders.getMyOrder)
ordersRouter.post('/:id/cancel', orders.cancelMyOrder)
