import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { resolveTestDatabaseUrl } from './tests/assert-test-database'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Applied to process.env before any test module loads. This has to happen here, not in
    // setup.ts: ESM hoists setup.ts's imports above its statements, and src/config.ts runs
    // dotenv on import — so .env's DATABASE_URL (the DEVELOPMENT database) would otherwise
    // be in place first and become the TRUNCATE target. dotenv does not overwrite.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: resolveTestDatabaseUrl(),
    },
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