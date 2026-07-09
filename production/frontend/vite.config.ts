import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Disable proxy in Playwright test environment
const isTestEnv = !!(process.env.PLAYWRIGHT_PORT || process.env.CI)
const proxyConfig = isTestEnv ? {} : {
  '/api': {
    target: 'http://127.0.0.1:3001',
    changeOrigin: true
  },
  // The backend serves uploaded gallery photos itself (nginx does this in
  // prod), so proxy them too or images 404 in local dev.
  '/uploads': {
    target: 'http://127.0.0.1:3001',
    changeOrigin: true
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: proxyConfig
  }
})
