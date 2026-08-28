import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

/**
 * SPA fallback 插件 — 开发环境下所有未匹配的请求返回 index.html，
 * 让 React Router 处理客户端路由（防止 /api-docs 等路径返回 404）
 */
function createSpaFallbackPlugin(): Plugin {
  return {
    name: 'vite-spa-fallback',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '/';
        // 不拦截：Vite 内部路径、静态资源、真实 API 路径、后端专属路径
        if (
          url.startsWith('/@') ||
          url.startsWith('/node_modules') ||
          url.startsWith('/api/') ||       // 只排除 /api/ 开头的真实 API 调用，不拦截 /api-docs
          url.startsWith('/health') ||
          url.startsWith('/docs') ||
          url.startsWith('/redoc') ||
          url.includes('.')               // 带扩展名的请求（JS/CSS/图片等静态资源）
        ) {
          return next();
        }
        try {
          // 读取真实的 index.html
          const indexHtmlPath = server.config.root ? `${server.config.root}/index.html` : 'index.html';
          const fs = require('fs');
          let html = fs.readFileSync(indexHtmlPath, 'utf-8');
          html = await server.transformIndexHtml(url, html);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(html);
        } catch (e) {
          // 如果变换失败，返回空页面
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end('<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/></head><body><div id="root"></div></body></html>');
        }
      });
    },
  };
}

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
  const fixDeleteUndefined = (code: string): string => {
    return code.replace(/delete undefined/g, 'undefined = void 0');
  };
  return {
    name: 'esbuild-compat-plugin',
    enforce: 'pre',
    transform(code) {
      if (code.includes('delete undefined')) {
        return {
          code: fixDeleteUndefined(code),
          map: null,
        };
      }
      return null;
    },
    renderChunk(code) {
      if (code.includes('delete undefined')) {
        return {
          code: fixDeleteUndefined(code),
          map: null,
        };
      }
      return null;
    },
  };
}

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
  const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:8001';

  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.DEBUG': 'undefined',
      'process.version': JSON.stringify('v18.0.0'),
      'process.platform': JSON.stringify('browser'),
      'process.node': 'false',
    },
    plugins: [
      createSpaFallbackPlugin(),
      createProcessPolyfillPlugin(),
      createEsbuildCompatPlugin(),
      react({
        fastRefresh: true,
        jsxRuntime: 'automatic',
      }),
      tailwindcss(),
      isProduction &&
        visualizer({
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
      allowedHosts: ['agnet.ltd', 'www.agnet.ltd'],
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
      ssrManifest: isProduction,
      reportCompressedSize: true,
      emptyOutDir: true,

      // 🔒 P3-1: esbuild 压缩增强（生产环境）
      // - 删除 console.log / debugger
      // - 更激进的 tree-shaking
      esbuildOptions: isProduction
        ? {
            drop: ['console', 'debugger'],
            legalComments: 'none',
            treeShaking: true,
            // 🔒 P3-1: 目标浏览器版本（支持 Chrome 110+ / Edge 110+ / Firefox 110+ / Safari 16+）
            target: ['chrome110', 'edge110', 'firefox110', 'safari16'],
            // 更小的标识符 + 更激进的压缩
            minifyWhitespace: true,
            minifyIdentifiers: true,
            minifySyntax: true,
          }
        : undefined,

      rollupOptions: {
        output: {
          chunkFileNames: isProduction ? 'assets/js/[name]-[hash:8].js' : 'assets/js/[name].js',
          entryFileNames: isProduction ? 'assets/js/[name]-[hash:8].js' : 'assets/js/[name].js',
          assetFileNames: isProduction ? 'assets/[ext]/[name]-[hash:8].[ext]' : 'assets/[ext]/[name].[ext]',

          // 🔒 P3-1: enhanced manualChunks 策略
          manualChunks: (id, { moduleIds }) => {
            // ── Vendor chunks ──
            if (id.includes('node_modules')) {
              // 🔒 P3-1: React 生态（核心框架 - 稳定版本）
              if (
                id.includes('react') ||
                id.includes('react-dom') ||
                id.includes('scheduler') ||
                id.includes('react-router')
              ) {
                return 'vendor-react';
              }
              // 🔒 P3-1: UI 组件库
              if (
                id.includes('lucide-react') ||
                id.includes('@radix-ui') ||
                id.includes('@tanstack') ||
                id.includes('headlessui')
              ) {
                return 'vendor-ui';
              }
              // 🔒 P3-1: Markdown 渲染（体积较大，独立 chunk）
              if (
                id.includes('remark') ||
                id.includes('rehype') ||
                id.includes('dompurify') ||
                id.includes('markdown')
              ) {
                return 'vendor-markdown';
              }
              // 🔒 P3-1: 图表库（大型依赖 - 懒加载）
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              // 🔒 P3-1: 文件导出（体积最大 - 动态加载）
              if (id.includes('docx') || id.includes('jspdf') || id.includes('exceljs') || id.includes('html2canvas')) {
                return 'vendor-export';
              }
              // 🔒 P3-1: 状态管理 & HTTP 客户端
              if (id.includes('axios') || id.includes('zustand') || id.includes('@tanstack/react-query')) {
                return 'vendor-core';
              }
              // 🔒 P3-1: 日期/时间工具（统一分组）
              if (id.includes('dayjs') || id.includes('date-fns') || id.includes('timeago')) {
                return 'vendor-date';
              }
              // 🔒 P3-1: i18n 国际化（如需要多语言支持）
              if (id.includes('i18n') || id.includes('intl')) {
                return 'vendor-i18n';
              }
              // 🔒 P3-1: 其他 node_modules 依赖（避免大 vendor 文件）
              return 'vendor-other';
            }

            // ── 功能模块分割 ──
            // 🔒 P3-1: AI Chat（用户高活跃路径，优先级高）
            if (
              id.includes('/components/ai/features/ChatTab') ||
              id.includes('/components/ai/features/hooks/useChatMessages') ||
              id.includes('/components/ai/features/services/chatService')
            ) {
              return 'feature-ai-chat';
            }
            if (
              id.includes('/components/ai/features/components/SimpleMarkdown') ||
              id.includes('/components/ai/features/utils/sanitize')
            ) {
              return 'feature-ai-chat-render';
            }
            // 🔒 P3-1: AI 生成（高价值功能，独立 chunk）
            if (
              id.includes('/components/ai/features/GenerateTab') ||
              id.includes('/components/ai/features/components/FormulaCard') ||
              id.includes('/components/ai/features/hooks/useFormulaManager')
            ) {
              return 'feature-ai-generate';
            }
            // 🔒 P3-1: AI 肽段分析（专业功能）
            if (
              id.includes('/components/ai/features/Peptide') ||
              id.includes('/components/ai/features/services/peptide') ||
              id.includes('/components/ai/professional/Peptide')
            ) {
              return 'feature-ai-peptide';
            }
            // 🔒 P3-1: AI 安全分析（专业功能）
            if (
              id.includes('/components/ai/features/SafetyTab') ||
              id.includes('/components/ai/features/services/safety')
            ) {
              return 'feature-ai-safety';
            }
            // 🔒 P3-1: 配方管理（核心功能）
            if (id.includes('/pages/formula/') || id.includes('/components/formula/')) {
              return 'feature-formula';
            }
            // 🔒 P3-1: 数据库查询（数据密集型）
            if (
              id.includes('/pages/database/') ||
              id.includes('/components/database/') ||
              id.includes('/api/database')
            ) {
              return 'feature-database';
            }
            // 🔒 P3-1: 数据分析（图表 + 计算）
            if (id.includes('/pages/analytics/') || id.includes('/components/analytics/')) {
              return 'feature-analytics';
            }
            // 🔒 P3-1: 组织管理
            if (id.includes('/pages/organizations/') || id.includes('/components/academic/')) {
              return 'feature-orgs';
            }
            // 🔒 P3-1: 系统设置
            if (id.includes('/pages/settings/')) {
              return 'feature-settings';
            }
            // 🔒 P3-1: 实验管理
            if (id.includes('/pages/experiment/')) {
              return 'feature-experiment';
            }
            // 🔒 P3-1: 用户管理
            if (id.includes('/pages/user/') || id.includes('/components/user/')) {
              return 'feature-user';
            }
          },
        },
      },
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react-router-dom',
          '@tanstack/react-query',
          'axios',
          'zustand',
          'lucide-react',
        ],
        exclude: ['recharts', 'd3', 'docx', 'jspdf', 'html2canvas', 'exceljs'],
      },
    },

    cacheDir: '.vite-cache',
  };
});
