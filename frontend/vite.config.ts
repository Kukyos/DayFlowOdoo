import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Matches "paths" in tsconfig.app.json. Import shared code as '@/lib/x'
    // rather than counting ../.. from a nested page folder.
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    // The local API (backend/). Same origin for the browser, so the session
    // cookie needs no CORS setup.
    proxy: { '/api': 'http://localhost:8787' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:8787' },
  },
})
