import vue from '@vitejs/plugin-vue';
import path from 'path';
import { defineConfig } from 'vite';
import vuetify from 'vite-plugin-vuetify';

export default defineConfig({
  plugins: [vue(), vuetify({ autoImport: true }),],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy backend requests to your Node.js server
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: '../server/static', // Output directory for production
    emptyOutDir: true,
  },
})
