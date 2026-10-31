// @ts-check
/**
 * ESLint 9 flat config — T-H2 / M4 治理
 *
 * 重建 `frontend/eslint.config.js`，使 `npm run lint` 可用。
 * 规则基线：@eslint/js 推荐 + typescript-eslint 推荐 + react-hooks +
 * react-refresh。主题系统额外启用 `no-irregular-whitespace` /
 * `no-redeclare` / `no-var` 等防御规则。
 *
 * 注意：
 *  - 并发编辑者的 WIP 文件可能产生既有 lint 错误 —— 这是预期行为，
 *    本次只建立基础设施，不承诺零错误。
 *  - i18n 相关规则由 eslint-plugin-i18next 提供（仅注册，默认不强制）。
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import i18next from 'eslint-plugin-i18next';

export default tseslint.config(
  // 忽略的目录
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'build/**',
      '.turbo/**',
      'scripts/theme-audit/**', // 审计工具脚本（.mjs），不在 lint 范围
      'src/utils/_test_parse.js', // 历史遗留的损坏 scratch 脚本（非源码、未被引用），保留但不参与 lint
    ],
  },

  // JS 推荐
  js.configs.recommended,

  // TypeScript 推荐（含 type-aware 关闭态）
  ...tseslint.configs.recommended,

  // 全局规则
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      // ── 防御性规则（主题系统 / 生产代码健壮性）──
      'no-var': 'error',
      'no-redeclare': 'error',
      'no-irregular-whitespace': 'error',
      'no-undef': 'off', // 由 tsc 管（flat config 下 typescript 解析器接管）
      'no-unused-vars': 'off', // 由 tsc 管
      // 主题系统特有：禁止硬编码 hex 色（L4 组合层除外，由 theme-validate 管）
      // 这里不开硬性 ESLint 规则，避免误报；改由 scripts/theme-validate.ts 专责。
      // 关闭对 .mjs 脚本的 react 规则误伤
      'react/prop-types': 'off',
      // 关闭 import 顺序（项目未统一）
      'import/order': 'off',
      // 允许 console（开发工具需要），但禁止 debug
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      'no-debugger': 'error',
      // Zustand persist 的 migrate 回调与旧数据反序列化边界使用 `any`
      // 属类型化债（待 TS 严格化清理），此处降为 warn 不阻断 lint
      '@typescript-eslint/no-explicit-any': 'warn',
      // 下划线前缀约定：`_` 开头的未使用变量/参数/捕获异常视为有意忽略
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // React Hooks 规则（仅 .tsx / .jsx）
  {
    files: ['**/*.{tsx,jsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // i18next（注册，按需启用）
  {
    plugins: { i18next },
    // 不强制 enforce-pluralization（项目已有大量既有用法，先注册再逐步收紧）
  },

  // Cordis 插件目录（theme-pro）：以 CommonJS 形式加载，`require` / `module.exports` 为合法用法
  {
    files: ['src/theme-pro/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
