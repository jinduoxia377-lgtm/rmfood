import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

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
    testTimeout: 5000,
    hookTimeout: 10000,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // **/e2e/** 是 Playwright 测试（testDir 见 playwright.config.ts，有独立 test:e2e 脚本），
    // 若被 vitest 收集会因缺少浏览器上下文而挂起——这是此前全量套件卡在 81/115 不返回的直接原因。
    exclude: ['node_modules', 'dist', '**/*.d.ts', '**/node_modules/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      // P2-1: CI 强制覆盖率检查
      // 生产/CI 环境低于阈值则构建失败
      // 开发环境可使用 ENFORCE_COVERAGE=false 跳过
      checkOnRun: process.env.CI === 'true' || process.env.ENFORCE_COVERAGE === 'true',
      include: [
        'src/components/ai/features/**/*.{ts,tsx}',
        'src/api/**/*.{ts,tsx}',
        'src/services/**/*.{ts,tsx}',
        'src/hooks/**/*.{ts,tsx}',
        'src/utils/**/*.{ts,tsx}',
      ],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/index.ts',
        '**/__tests__/**',
        '**/__mocks__/**',
        '**/types/**',
        'src/tests/**', // 测试辅助文件不计入覆盖率
      ],
      // P2-1: 分类阈值
      // AI 核心业务: 严格（95%）
      // API/Utils: 中等（90%）
      // 其他: 基础（70%）
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
        './src/components/ai/features/hooks/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        './src/components/ai/features/services/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        './src/components/ai/features/utils/': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        './src/api/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        './src/utils/': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    css: false,
  },
});
