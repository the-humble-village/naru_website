/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // UTC so date formatting is the same on every machine and in CI.
    env: { TZ: 'UTC' },
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 2,
      },
    },
  },
});