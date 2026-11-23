import { prisma } from '@ecom/db'
import type { Request, Response } from 'express'
import { currentUser } from '../middleware/auth.js'

const LIMIT = 20

/** The signed-in customer's latest notifications (written by the queue workers) + unread count. */
export async function listMyNotifications(req: Request, res: Response) {
  const mine = { order: { userId: currentUser(req).id } }
  const [items, unreadCount] = await Promise.all([
    prisma.orderNotification.findMany({
      where: mine,
      orderBy: { sentAt: 'desc' },
      take: LIMIT,
      select: {
        id: true,
        kind: true,
        channel: true,
        recipient: true,
        sentAt: true,
        readAt: true,
        order: { select: { id: true, number: true } },
      },
    }),
    prisma.orderNotification.count({ where: { ...mine, readAt: null } }),
  ])
  res.json({ items, unreadCount })
}

/** Marks everything read (the bell was opened). Naturally idempotent: only touches unread rows. */
export async function markAllNotificationsRead(req: Request, res: Response) {
  const { count } = await prisma.orderNotification.updateMany({
    where: { order: { userId: currentUser(req).id }, readAt: null },
    data: { readAt: new Date() },
  })
  res.json({ marked: count })
}
