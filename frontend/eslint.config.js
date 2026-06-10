import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import i18next from 'eslint-plugin-i18next'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    'node_modules',
    '.vite-cache',
    'build',
    'coverage'
  ]),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      i18next,
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ============================================
      // TypeScript Rules
      // ============================================
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // ============================================
      // React Hooks Rules
      // ============================================
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // ============================================
      // React Refresh Rules
      // ============================================
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // ============================================
      // i18n Internationalization Rules
      // ============================================
      'i18next/no-literal-string': [
        'warn',
        {
          markupOnly: false,
          ignoreAttribute: ['className', 'style', 'data-*'],
          ignoreLiteral: [
            'http://',
            'https://',
            '/',
            '.com',
            '.cn',
            'localhost',
          ],
          ignoreCallee: [
            'console.log',
            'console.warn',
            'console.error',
            'describe',
            'it',
            'test',
          ],
        },
      ],

      // ============================================
      // General JavaScript Rules
      // ============================================
      'prefer-const': 'error',
      'no-case-declarations': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-useless-concat': 'error',
      'no-useless-escape': 'error',
      'no-void': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      'require-await': 'error',

      // ============================================
      // Code Style (standard ESLint rules, not plugin-specific)
      // ============================================
      'comma-dangle': ['error', 'always-multiline'],
      'eol-last': ['error', 'always'],
      'no-trailing-spaces': 'error',
      'no-unused-vars': 'off', // use @typescript-eslint/no-unused-vars instead

      // ============================================
      // Security Rules
      // ============================================
      'no-script-url': 'error',
    },
  },

  // ============================================
  // Test File Overrides
  // ============================================
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },

  // ============================================
  // Configuration Files Overrides
  // ============================================
  {
    files: ['**/*.config.js', '**/*.config.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
    },
  },
])
