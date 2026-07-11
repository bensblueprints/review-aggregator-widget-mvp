import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'client',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    port: 6351,
    proxy: {
      '/api': 'http://localhost:5351',
      '/widget.js': 'http://localhost:5351',
      '/badge.json': 'http://localhost:5351'
    }
  }
});
