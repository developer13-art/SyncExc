import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(() => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@syncexc/ui': path.resolve(__dirname, '../packages/ui/src/index.ts'),
    },
  },
  server: {
    port: 5174,
    host: true,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 5174,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'state-vendor': ['@reduxjs/toolkit', 'react-redux', '@tanstack/react-query'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-toast',
          ],
          'charts-vendor': ['recharts'],
        },
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
}));