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

/**
 * esbuild-compat-plugin: 修复第三方库中的 `delete undefined` 模式
 * 该模式在 debug 等库中出现，esbuild 的 ESM 模式不允许 bare identifier delete
 */
function createEsbuildCompatPlugin(): Plugin {
  return {
    name: 'esbuild-compat-plugin',
    transform(code) {
      if (code.includes('delete undefined')) {
        return {
          code: code.replace(/delete undefined/g, 'undefined = void 0'),
          map: null,
        };
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
      createEsbuildCompatPlugin(),
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
      headers: {
        'Accept-Encoding': 'gzip, deflate, br',
      },
    },

    build: {
      chunkSizeWarningLimit: 500,
      minify: isProduction ? 'esbuild' : false,
      sourcemap: !isProduction,
      cssCodeSplit: true,
      cssMinify: isProduction,
      manifest: isProduction,
      reportCompressedSize: true,
      emptyOutDir: true,
      rollupOptions: {
        output: {
          chunkFileNames: isProduction
            ? 'assets/js/[name]-[hash:8].js'
            : 'assets/js/[name].js',
          entryFileNames: isProduction
            ? 'assets/js/[name]-[hash:8].js'
            : 'assets/js/[name].js',
          assetFileNames: isProduction
            ? 'assets/[ext]/[name]-[hash:8].[ext]'
            : 'assets/[ext]/[name].[ext]',
          manualChunks: (id) => {
            // ── Vendor chunks ──
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
                return 'vendor-react'
              }
              if (id.includes('lucide-react') || id.includes('@radix-ui') || id.includes('@tanstack')) {
                return 'vendor-ui'
              }
              if (id.includes('remark') || id.includes('rehype') || id.includes('dompurify') || id.includes('markdown')) {
                return 'vendor-markdown'
              }
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts'
              }
              if (id.includes('docx') || id.includes('jspdf') || id.includes('exceljs') || id.includes('html2canvas')) {
                return 'vendor-export'
              }
              if (id.includes('axios') || id.includes('zustand') || id.includes('react-router')) {
                return 'vendor-core'
              }
              return 'vendor-other'
            }

            // ── Feature: AI Chat ──
            if (id.includes('/components/ai/features/ChatTab') ||
                id.includes('/components/ai/features/hooks/useChatMessages') ||
                id.includes('/components/ai/features/services/chatService')) {
              return 'feature-ai-chat'
            }
            if (id.includes('/components/ai/features/components/SimpleMarkdown') ||
                id.includes('/components/ai/features/utils/sanitize')) {
              return 'feature-ai-chat-render'
            }

            // ── Feature: AI Generate ──
            if (id.includes('/components/ai/features/GenerateTab') ||
                id.includes('/components/ai/features/components/FormulaCard') ||
                id.includes('/components/ai/features/hooks/useFormulaManager')) {
              return 'feature-ai-generate'
            }

            // ── Feature: AI Peptide ──
            if (id.includes('/components/ai/features/Peptide') ||
                id.includes('/components/ai/features/services/peptide') ||
                id.includes('/components/ai/professional/Peptide')) {
              return 'feature-ai-peptide'
            }

            // ── Feature: AI Safety ──
            if (id.includes('/components/ai/features/SafetyTab') ||
                id.includes('/components/ai/features/services/safety')) {
              return 'feature-ai-safety'
            }

            // ── Feature: Formula pages ──
            if (id.includes('/pages/formula/') ||
                id.includes('/components/formula/')) {
              return 'feature-formula'
            }

            // ── Feature: Database pages ──
            if (id.includes('/pages/database/') ||
                id.includes('/components/database/') ||
                id.includes('/api/database')) {
              return 'feature-database'
            }

            // ── Feature: Analytics ──
            if (id.includes('/pages/analytics/') ||
                id.includes('/components/analytics/')) {
              return 'feature-analytics'
            }

            // ── Feature: Organizations ──
            if (id.includes('/pages/organizations/') ||
                id.includes('/components/academic/')) {
              return 'feature-orgs'
            }

            // ── Feature: Settings ──
            if (id.includes('/pages/settings/')) {
              return 'feature-settings'
            }
          }
        }
      },
      optimizeDeps: {
        include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', 'axios', 'zustand', 'lucide-react'],
        exclude: ['recharts', 'd3', 'docx', 'jspdf', 'html2canvas', 'exceljs'],
      },
    },

    cacheDir: '.vite-cache',
  };
});
