import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

function createProcessPolyfillPlugin(): Plugin {
  const processPolyfill = `
    (typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : {}).process = 
    (typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : {}).process || {
      env: {
        NODE_ENV: '${process.env.NODE_ENV || 'development'}',
        DEBUG: undefined,
        PRODUCTION: ${process.env.NODE_ENV === 'production'},
      },
      version: 'v18.0.0',
      platform: 'browser',
      arch: 'unknown',
      node: false,
      title: 'browser',
      browser: true,
      argv: [],
      execPath: '',
      cwd: function() { return '/'; },
      nextTick: function(cb) { var args = Array.prototype.slice.call(arguments, 1); setTimeout(function() { cb.apply(null, args); }, 0); },
      stdout: { write: function(s) {}, writeLine: function(s) {} },
      stderr: { write: function(s) {}, writeLine: function(s) {} },
      stdin: {},
      exit: function() {},
      on: function() {},
      off: function() {},
      removeAllListeners: function() {},
      emit: function() { return false; },
      listeners: function() { return []; },
      once: function() {},
      prependListener: function() {},
      prependOnceListener: function() {},
      removeListener: function() {},
      uptime: function() { return 0; },
      memoryUsage: function() { return { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 }; },
      hrtime: function(time) { return time ? [0, 0] : [0, 0]; }
    };
  `.trim();

  return {
    name: 'process-polyfill-plugin',
    
    configResolved(config) {
      if (!config.optimizeDeps.exclude.includes('exceljs')) {
        config.optimizeDeps.exclude.push('exceljs');
      }
    },

    transform(code, id) {
      if (!id.match(/\.(js|ts|jsx|tsx|mjs|cjs)$/)) {
        return null;
      }
      if (code.includes('process') && !id.includes('polyfills') && !id.includes('dynamicImports')) {
        const injectedCode = `// [Process Polyfill Injected]\n${processPolyfill}\n\n${code}`;
        return { code: injectedCode, map: null };
      }
      return null;
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:8000';

  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.DEBUG': 'undefined',
      'process.version': JSON.stringify('v18.0.0'),
      'process.platform': JSON.stringify('browser'),
      'process.node': 'false',
    },
    plugins: [
      createProcessPolyfillPlugin(),
      react({
        fastRefresh: true,
        jsxRuntime: 'automatic',
      }),
      tailwindcss(),
      isProduction && visualizer({
        open: false,
        filename: 'dist/stats.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),

    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
      conditions: ['module', 'import'],
      mainFields: ['module', 'jsnext:main', 'jsnext'],
    },

    server: {
      host: '0.0.0.0',
      port: parseInt(process.env.VITE_PORT || '3000', 10),
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          proxyTimeout: parseInt(process.env.VITE_PROXY_TIMEOUT || '60000', 10),
        },
        '/health': { target: backendUrl, changeOrigin: true, secure: false },
        '/docs': { target: backendUrl, changeOrigin: true, secure: false },
        '/redoc': { target: backendUrl, changeOrigin: true, secure: false },
      },
      compress: true,
    },

    build: {
      chunkSizeWarningLimit: 500,
      minify: isProduction ? 'terser' : false,
      sourcemap: !isProduction,
      cssCodeSplit: true,
      manifest: isProduction,
      reportCompressedSize: true,
      emptyOutDir: true,
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
          dead_code: true,
          unused: true,
          collapse_vars: true,
        },
        format: { comments: false, ascii_only: true },
      },
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-core': ['react', 'react-dom', 'react-router-dom'],
            'vendor-query': ['@tanstack/react-query', '@tanstack/react-table'],
            'vendor-charts': ['recharts', 'd3'],
            'vendor-utils': ['axios', 'date-fns', 'clsx', 'tailwind-merge'],
            'vendor-icons': ['lucide-react'],
            'vendor-export': ['docx', 'jspdf', 'jspdf-autotable', 'html2canvas', 'exceljs', 'xlsx'],
          },
          chunkFileNames: isProduction
            ? 'assets/js/[name]-[hash:8].js'
            : 'assets/js/[name].js',
          entryFileNames: isProduction
            ? 'assets/js/[name]-[hash:8].js'
            : 'assets/js/[name].js',
          assetFileNames: isProduction
            ? 'assets/[ext]/[name]-[hash:8].[ext]'
            : 'assets/[ext]/[name].[ext]',
        },
        treeshake: { moduleSideEffects: 'no-external', propertyReadSideEffects: false, tryCatchDeoptimization: false },
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'axios', 'zustand', 'lucide-react'],
        exclude: ['recharts', 'd3', 'docx', 'jspdf', 'html2canvas', 'exceljs'],
      },
    },

    cacheDir: '.vite-cache',
    experimental: { optimizeCss: true },
  };
});
