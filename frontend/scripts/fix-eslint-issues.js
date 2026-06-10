#!/usr/bin/env node
/**
 * ESLint 渐进式修复脚本
 * 按照优先级逐步修复代码质量问题
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始 ESLint 渐进式修复...\n');

// 修复阶段定义
const FIX_PHASES = [
  {
    name: 'Phase 1: 自动修复简单问题',
    rules: [
      'prefer-const',
      'no-case-declarations',
      'no-useless-escape',
      'no-control-regex'
    ],
    description: '修复可自动修复的语法问题'
  },
  {
    name: 'Phase 2: 移除未使用变量',
    rules: [
      '@typescript-eslint/no-unused-vars'
    ],
    description: '移除未使用的导入和变量'
  },
  {
    name: 'Phase 3: 类型安全修复',
    rules: [
      '@typescript-eslint/no-explicit-any',
      '@typescript-eslint/no-unsafe-function-type'
    ],
    description: '需要手动修复的类型问题'
  }
];

// 执行函数
function runCommand(command, options = {}) {
  try {
    console.log(`\$ ${command}`);
    const result = execSync(command, {
      cwd: path.join(__dirname, '..'),
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8'
    });
    return result;
  } catch (error) {
    if (!options.silent) {
      console.error(`❌ 命令执行失败: ${command}`);
    }
    return null;
  }
}

// 检查是否有 ESLint 配置
function checkESLintConfig() {
  const eslintConfigPath = path.join(__dirname, '..', 'eslint.config.js');
  return fs.existsSync(eslintConfigPath);
}

// 获取当前 ESLint 问题数量
function getIssueCount() {
  try {
    const output = runCommand('npx eslint src --format json', { silent: true });
    if (output) {
      const results = JSON.parse(output);
      let totalErrors = 0;
      let totalWarnings = 0;
      results.forEach(file => {
        totalErrors += file.errorCount;
        totalWarnings += file.warningCount;
      });
      return { errors: totalErrors, warnings: totalWarnings, total: totalErrors + totalWarnings };
    }
  } catch (e) {
    // 忽略
  }
  return null;
}

// 主函数
async function main() {
  if (!checkESLintConfig()) {
    console.error('❌ 找不到 ESLint 配置文件');
    process.exit(1);
  }

  const initialIssues = getIssueCount();
  console.log('📊 初始问题统计:');
  if (initialIssues) {
    console.log(`   - 错误: ${initialIssues.errors}`);
    console.log(`   - 警告: ${initialIssues.warnings}`);
    console.log(`   - 总计: ${initialIssues.total}`);
  } else {
    console.log('   - 无法获取问题统计');
  }
  console.log();

  // Phase 1: 尝试自动修复
  console.log('📍 Phase 1: 运行 ESLint --fix 自动修复...');
  runCommand('npx eslint src --fix');
  console.log('✅ Phase 1 完成\n');

  // Phase 2: 检查剩余问题
  const issuesAfterFix = getIssueCount();
  if (issuesAfterFix) {
    console.log('📊 修复后问题统计:');
    console.log(`   - 错误: ${issuesAfterFix.errors}`);
    console.log(`   - 警告: ${issuesAfterFix.warnings}`);
    console.log(`   - 总计: ${issuesAfterFix.total}`);
    if (initialIssues) {
      const fixed = initialIssues.total - issuesAfterFix.total;
      if (fixed > 0) {
        console.log(`   - 已修复: ${fixed} 个问题 🎉`);
      }
    }
  }
  console.log();

  // 生成问题报告
  console.log('📋 生成问题详细报告...');
  runCommand('npx eslint src --format stylish > eslint-report.txt 2>&1');
  console.log('✅ 报告已保存到 eslint-report.txt');

  console.log('\n' + '='.repeat(60));
  console.log('📝 修复建议:');
  console.log('1. 查看 eslint-report.txt 了解剩余问题');
  console.log('2. 优先修复安全相关的问题');
  console.log('3. 逐步替换 any 类型为具体类型');
  console.log('4. 使用类型声明文件增强类型安全');
  console.log('='.repeat(60));
  console.log();
  console.log('🎉 渐进式修复第一阶段完成！');
}

main().catch(console.error);
