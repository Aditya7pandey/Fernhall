import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./test/setup.ts'],
    // Tests share the dev database; run files one at a time
    fileParallelism: false,
    testTimeout: 15_000,
  },
})
