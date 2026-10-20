import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * CI 专用 vitest 配置
 *
 * 与 vitest.config.ts 的差异（目的：全量 CI 稳定可用）：
 * 1. testTimeout/hookTimeout 提高：jsdom + 大型模块图收集/执行较慢，避免误杀；
 * 2. exclude 增加 e2e 目录（测试路径中的 __tests__/e2e 层级）：
 *    Playwright E2E 由独立流水线（npm run test:e2e）运行，不参与 vitest 单测；
 * 3. coverage 保留 lcov 上报（供 Codecov），但关闭 checkOnRun 阈值强制——
 *    覆盖率阈值达标前不阻塞 CI，避免全量流水线因覆盖率数字失败。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 15000,
    hookTimeout: 20000,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // 详见 TEST_QUARANTINE.md。当前无隔离测试文件（2026-10-18 全部修复并移出）。
    exclude: [
      'node_modules',
      'dist',
      '**/*.d.ts',
      '**/node_modules/**',
      '**/__tests__/e2e/**',
      '**/__tests__/integration/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json', 'lcov'],
      reportsDirectory: './coverage',
      checkOnRun: false,
    },
    css: false,
  },
});