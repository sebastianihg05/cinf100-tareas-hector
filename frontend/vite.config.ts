/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // En desarrollo, las llamadas a /api van al backend (npm run dev en backend/), sin problemas de CORS.
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    // Los flujos de registro y aprobación tardan más de 5 s (el límite por defecto) en computadores lentos.
    testTimeout: 20000,
  },
})
