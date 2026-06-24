import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['supabase/tests/**/*.test.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
