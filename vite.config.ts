import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['framework-laptop.tail8c7608.ts.net', '100.71.51.95'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4174'
      }
    }
  }
});
