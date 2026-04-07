import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    pool: 'forks',  // Use forks instead of threads to avoid shared state
    poolOptions: {
      forks: {
        singleFork: true  // Run tests sequentially to avoid race conditions
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})