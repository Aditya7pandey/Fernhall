import { Router } from 'express'
import * as notifications from '../controllers/notifications.controller.js'
import { requireAuth } from '../middleware/auth.js'

export const notificationsRouter = Router()
notificationsRouter.use(requireAuth)
notificationsRouter.get('/', notifications.listMyNotifications)
notificationsRouter.post('/read', notifications.markAllNotificationsRead)
