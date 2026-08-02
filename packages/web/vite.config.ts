import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Vite rejects requests whose Host header it doesn't recognise, which blocks
    // every tunnelled request. Allowing the ngrok domains means a new random
    // tunnel URL works without touching this file.
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok.io'],
    // Over a tunnel the browser reaches the dev server on 443, not 5174, so the
    // HMR socket has to be told where to connect. Set TUNNEL=1 when sharing.
    hmr: process.env.TUNNEL
      ? { clientPort: 443, protocol: 'wss' }
      : { clientPort: 5174 },
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  optimizeDeps: {
    exclude: ['@naru/shared'],
  },
});
