import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // All /api/* requests are forwarded to the .NET backend.
      // Because requests go server-to-server (Vite node → .NET),
      // the browser never sees a cross-origin request → no CORS blocks.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        // Needed for SSE (chat streaming) — disables buffering
        ws: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[vite-proxy] error', err.message)
          })
        },
      },
    },
  },
})