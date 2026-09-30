import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@/utils/safeLogger', '@/components/ui/ToastContainer'],
    include: ['react', 'react-dom', 'axios', 'zustand'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 将所有 react / react-dom 相关模块放入单一共享 chunk，
          // 彻底消除 feature-* chunk 内联独立 React 副本的双实例缺陷。
          if (
            id.includes('node_modules') &&
            /node_modules[\\/](react|react-dom|react-router|scheduler|use-sync-external-store)[\\/]/.test(id.replace(/\\/g, '/'))
          ) {
            return 'vendor-react';
          }
          if (id.includes('node_modules')) {
            // 将第三方库统一拆分到 vendor 区
            const m = id.match(/node_modules\/(@[a-z0-9-]+\/)?([a-z0-9-]+)/i);
            if (m) return 'vendor-' + (m[1] ? m[1].split('/')[0] + '-' + m[2] : m[2]);
          }
          return undefined;
        },
      },
    },
  },
});
