import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev fallback token signed with backend JWT_SECRET for seamless iframe telemetry gateway in development
const DEV_SESSION_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MjAwMDAwMDAwMH0.DLR8ja99MFa-CXyB3FeV1Z7b13LKcx1m_cVOiBA3NqM'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/grafana': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false,
        ws: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const cookie = req.headers.cookie || ''
            if (!cookie.includes('ccad_token=')) {
              proxyReq.setHeader(
                'cookie',
                cookie ? `${cookie}; ccad_token=${DEV_SESSION_TOKEN}` : `ccad_token=${DEV_SESSION_TOKEN}`
              )
            }
          })
        },
      },
      '/prometheus': {
        target: 'https://localhost:8443',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const cookie = req.headers.cookie || ''
            if (!cookie.includes('ccad_token=')) {
              proxyReq.setHeader(
                'cookie',
                cookie ? `${cookie}; ccad_token=${DEV_SESSION_TOKEN}` : `ccad_token=${DEV_SESSION_TOKEN}`
              )
            }
          })
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts', 'echarts-for-react'],
          vendor: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
        },
      },
    },
  },
})
