// AI-assisted: see AI-ATTRIBUTION.md
/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // UTC so date formatting is the same on every machine and in CI.
    env: { TZ: 'UTC' },
    pool: 'forks',
  },
});