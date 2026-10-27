import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Frontend dev server proxies /api requests to the FastAPI backend on port 8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
