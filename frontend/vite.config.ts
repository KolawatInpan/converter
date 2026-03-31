import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const frontendPort = Number(env.FRONTEND_PORT || process.env.FRONTEND_PORT || '5001')
  const lanHostIp = env.LAN_HOST_IP || process.env.LAN_HOST_IP || ''

  return {
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      port: frontendPort,
      strictPort: true,
      hmr: lanHostIp
        ? {
            host: lanHostIp,
            clientPort: frontendPort,
            protocol: 'ws',
          }
        : undefined,
    },
  }
})
