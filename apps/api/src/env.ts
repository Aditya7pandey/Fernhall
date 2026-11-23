function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var ${name}`)
  return value
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  isProd: process.env.NODE_ENV === 'production',
  jwtSecret: required('JWT_SECRET'),
  cookieSecret: required('COOKIE_SECRET'),
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  uploadDir: process.env.UPLOAD_DIR ?? new URL('../uploads/', import.meta.url).pathname,
  /** Redis for BullMQ (docker-compose maps it to host port 6380) */
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',
  /** Run the queue workers inside the API process (handy in dev). In production run `worker` separately. */
  runWorkersInApi: (process.env.RUN_WORKERS_IN_API ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true',
  /** Unpaid orders are cancelled (stock released) after this many minutes */
  orderPaymentTimeoutMinutes: Number(process.env.ORDER_PAYMENT_TIMEOUT_MINUTES ?? 30),
  /** Razorpay test/live credentials — payments return 503 until these are set */
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
  },
}
