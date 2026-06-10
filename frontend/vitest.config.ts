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
    exclude: [
      'node_modules',
      'dist',
      '**/*.d.ts',
      '**/node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'json', 'json-summary'],
      reportsDirectory: './coverage',
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
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
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
      },
    },
    css: false,
  },
});
