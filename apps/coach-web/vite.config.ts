/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Pinned: the Supabase dev URL config (Site URL, redirect allow-list) and the
  // athlete app's baked-in redirects all point at 5176. strictPort fails loudly
  // if the port is taken instead of silently drifting to 5173 and breaking
  // every emailed auth link.
  server: { port: 5176, strictPort: true },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    // Hermetic dummy Supabase env so createClient() constructs in tests without
    // depending on .env files (CI has none). Unit tests mock all queries.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
})
