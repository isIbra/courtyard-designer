import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5183,
    strictPort: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3051',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3051',
        ws: true,
      },
    },
  },
});
