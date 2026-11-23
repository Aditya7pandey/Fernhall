-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('ORDER_RECEIVED', 'PAYMENT_CONFIRMED', 'ORDER_EXPIRED');

-- CreateTable
CREATE TABLE "OrderNotification" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "recipient" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderNotification_orderId_kind_key" ON "OrderNotification"("orderId", "kind");

-- AddForeignKey
ALTER TABLE "OrderNotification" ADD CONSTRAINT "OrderNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

