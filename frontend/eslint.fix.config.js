/**
 * ESLint 自动修复配置
 * 用于批量修复可自动修复的问题
 */
module.exports = {
  rules: {
    // 自动修复类型问题
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    
    // 自动修复 React 问题
    'react-hooks/set-state-in-effect': 'warn',
    
    // 自动修复代码风格
    'prefer-const': 'warn',
    'no-case-declarations': 'warn',
  },
};
