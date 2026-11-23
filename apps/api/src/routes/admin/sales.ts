import { Router } from 'express'
import * as sales from '../../controllers/admin/sales.controller.js'

export const adminSalesRouter = Router()

// ─── Dashboard ──────────────────────────────────────────────────────────────

adminSalesRouter.get('/stats', sales.getStats)

// ─── Orders ─────────────────────────────────────────────────────────────────

adminSalesRouter.get('/orders', sales.listOrders)
adminSalesRouter.get('/orders/:id', sales.getOrder)
adminSalesRouter.patch('/orders/:id/status', sales.updateOrderStatus)

// ─── Customers ──────────────────────────────────────────────────────────────

adminSalesRouter.get('/customers', sales.listCustomers)
adminSalesRouter.get('/customers/:id', sales.getCustomer)

// ─── Coupons ────────────────────────────────────────────────────────────────

adminSalesRouter.get('/coupons', sales.listCoupons)
adminSalesRouter.post('/coupons', sales.createCoupon)
adminSalesRouter.patch('/coupons/:id', sales.updateCoupon)
adminSalesRouter.delete('/coupons/:id', sales.deleteCoupon)
