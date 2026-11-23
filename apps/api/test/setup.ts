// Load apps/api/.env before anything imports @ecom/db (which reads DATABASE_URL on import)
process.loadEnvFile(new URL('../.env', import.meta.url))
