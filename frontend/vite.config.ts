import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward API calls to the PHP backend so the browser sees a single origin (no CORS needed).
    proxy: {
      '/api': {
        target: 'http://hr.localhost',
        changeOrigin: true,
      },
    },
  },
});
