import { Prisma, prisma, type NotificationKind, type Order } from '@ecom/db'
import { sendEmail } from './mailer.js'

/**
 * Sends one kind of notification for an order AT MOST ONCE per (order, kind), no matter
 * how many times the job runs.
 *
 * Why this is needed: BullMQ delivers jobs AT LEAST ONCE. A worker can crash after sending
 * the email but before BullMQ records the job as completed → the job runs again. So every
 * job handler must be idempotent, exactly like our HTTP endpoints.
 *
 *  1. Already recorded?  → skip.
 *  2. Send.
 *  3. Record it. The unique (orderId, kind) constraint means a concurrent duplicate loses
 *     with P2002, which we ignore.
 *
 * The remaining gap — crash between 2 and 3 — can produce one duplicate email. Closing it
 * fully needs the email provider's idempotency key (passed below).
 */
export async function notifyOnce(
  order: Pick<Order, 'id' | 'email'>,
  kind: NotificationKind,
  message: { subject: string; text: string },
): Promise<'sent' | 'already-sent'> {
  const where = { orderId_kind: { orderId: order.id, kind } }
  if (await prisma.orderNotification.findUnique({ where })) return 'already-sent'

  await sendEmail({ to: order.email, ...message, idempotencyKey: `${order.id}-${kind}` })

  try {
    await prisma.orderNotification.create({ data: { orderId: order.id, kind, recipient: order.email } })
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err
  }
  return 'sent'
}
