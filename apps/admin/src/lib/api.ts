import { createApiClient } from '@ecom/shared'

// In dev, Vite proxies /api to the Express server (see vite.config.ts).
export const api = createApiClient(import.meta.env.VITE_API_URL ?? '/api')
