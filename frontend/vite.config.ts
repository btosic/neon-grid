import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const port = parseInt(env.VITE_PORT ?? '5173', 10);
  const backendUrl = env.VITE_BACKEND_URL ?? 'http://localhost:3001';

  return {
    plugins: [react()],
    server: {
      port,
      proxy: {
        '/api': {
          target: backendUrl,
          rewrite: (path) => path.replace(/^\/api/, ''),
          changeOrigin: true,
        },
      },
      allowedHosts: [
        env.VITE_HOST_DOMAIN
      ]
    },
  };
});
