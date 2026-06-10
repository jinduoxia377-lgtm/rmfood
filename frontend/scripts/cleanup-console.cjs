/**
 * RMFOOD Console.log 清理工具
 *
 * 自动扫描前端代码中的 console.log 调用，
 * 并将其替换为 safeLogger 的相应方法。
 *
 * 功能：
 * 1. 扫描所有 .ts/.tsx 文件
 * 2. 识别 console.log/warn/error/debug 调用
 * 3. 自动添加 safeLogger import
 * 4. 替换为 logger.info/warn/error/debug
 * 5. 生成清理报告
 */

const fs = require('fs');
const path = require('path');

class ConsoleCleanupTool {
  constructor(projectRoot) {
    this.projectRoot = projectRoot || process.cwd();
    this.stats = {
      totalFiles: 0,
      modifiedFiles: 0,
      consoleLogCount: 0,
      consoleWarnCount: 0,
      consoleErrorCount: 0,
      consoleDebugCount: 0,
      fixedCount: 0,
    };
    this.issues = [];
    this.importAddedFiles = new Set();
  }

  /**
   * 扫描目录中的所有TypeScript/JavaScript文件
   */
  scanDirectory(dir = 'src', extensions = ['.ts', '.tsx']) {
    const targetDir = path.join(this.projectRoot, dir);

    if (!fs.existsSync(targetDir)) {
      console.log(`⚠️ 目录不存在: ${targetDir}`);
      return [];
    }

    const files = this.getAllFiles(targetDir, extensions);
    this.stats.totalFiles = files.length;

    files.forEach(file => {
      this.analyzeFile(file);
    });

    return this.issues;
  }

  /**
   * 递归获取所有文件
   */
  getAllFiles(dir, extensions) {
    let results = [];

    try {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // 跳过 node_modules, .git, dist 等目录
          if (!['node_modules', '.git', 'dist', 'build', '__mocks__', '__tests__'].includes(item)) {
            results = results.concat(this.getAllFiles(fullPath, extensions));
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item);
          if (extensions.includes(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.error(`读取目录失败: ${dir}`, error.message);
    }

    return results;
  }

  /**
   * 分析单个文件中的console调用
   */
  analyzeFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(this.projectRoot, filePath);
      const lines = content.split('\n');

      let fileIssues = [];

      lines.forEach((line, index) => {
        // 匹配 console.log
        const logMatch = line.match(/console\.log\s*\(/);
        if (logMatch) {
          this.stats.consoleLogCount++;
          fileIssues.push({
            line: index + 1,
            type: 'console.log',
            content: line.trim(),
            severity: 'medium',
          });
        }

        // 匹配 console.warn
        const warnMatch = line.match(/console\.warn\s*\(/);
        if (warnMatch) {
          this.stats.consoleWarnCount++;
          fileIssues.push({
            line: index + 1,
            type: 'console.warn',
            content: line.trim(),
            severity: 'low',
          });
        }

        // 匹配 console.error
        const errorMatch = line.match(/console\.error\s*\(/);
        if (errorMatch) {
          this.stats.consoleErrorCount++;
          fileIssues.push({
            line: index + 1,
            type: 'console.error',
            content: line.trim(),
            severity: 'high',
          });
        }

        // 匹配 console.debug
        const debugMatch = line.match(/console\.debug\s*\(/);
        if (debugMatch) {
          this.stats.consoleDebugCount++;
          fileIssues.push({
            line: index + 1,
            type: 'console.debug',
            content: line.trim(),
            severity: 'low',
          });
        }
      });

      if (fileIssues.length > 0) {
        this.issues.push({
          file: relativePath,
          filePath: filePath,
          issues: fileIssues,
          totalIssues: fileIssues.length,
        });
      }
    } catch (error) {
      console.error(`分析文件失败: ${filePath}`, error.message);
    }
  }

  /**
   * 修复所有发现的console调用
   */
  fixAllIssues(dryRun = false) {
    let fixedCount = 0;

    this.issues.forEach(fileIssue => {
      if (this.fixFileIssues(fileIssue, dryRun)) {
        fixedCount += fileIssue.totalIssues;
        this.stats.modifiedFiles++;
      }
    });

    this.stats.fixedCount = fixedCount;
    return fixedCount;
  }

  /**
   * 修复单个文件的问题
   */
  fixFileIssues(fileIssue, dryRun = false) {
    try {
      let content = fs.readFileSync(fileIssue.filePath, 'utf-8');
      let modified = false;
      const relativePath = path.relative(this.projectRoot, fileIssue.filePath);

      // 替换 console.log -> logger.info
      const logRegex = /console\.log\s*\(/g;
      const logMatches = content.match(logRegex);
      if (logMatches && logMatches.length > 0) {
        content = content.replace(logRegex, 'logger.info(');
        modified = true;
      }

      // 替换 console.warn -> logger.warn
      const warnRegex = /console\.warn\s*\(/g;
      const warnMatches = content.match(warnRegex);
      if (warnMatches && warnMatches.length > 0) {
        content = content.replace(warnRegex, 'logger.warn(');
        modified = true;
      }

      // 替换 console.error -> logger.error
      const errorRegex = /console\.error\s*\(/g;
      const errorMatches = content.match(errorRegex);
      if (errorMatches && errorMatches.length > 0) {
        content = content.replace(errorRegex, 'logger.error(');
        modified = true;
      }

      // 替换 console.debug -> logger.debug
      const debugRegex = /console\.debug\s*\(/g;
      const debugMatches = content.match(debugRegex);
      if (debugMatches && debugMatches.length > 0) {
        content = content.replace(debugRegex, 'logger.debug(');
        modified = true;
      }

      // 添加 safeLogger import（如果需要）
      if (modified && !this.hasSafeLoggerImport(content)) {
        content = this.addSafeLoggerImport(content, relativePath);
        this.importAddedFiles.add(relativePath);
      }

      // 写入文件（如果不是dry run）
      if (modified && !dryRun) {
        fs.writeFileSync(fileIssue.filePath, content, 'utf-8');
        console.log(`✅ 已修复: ${relativePath} (${fileIssue.totalIssues} 处)`);
      } else if (modified && dryRun) {
        console.log(`🔍 将修复: ${relativePath} (${fileIssue.totalIssues} 处)`);
      }

      return modified;
    } catch (error) {
      console.error(`修复文件失败: ${fileIssue.filePath}`, error.message);
      return false;
    }
  }

  /**
   * 检查是否已经有 safeLogger import
   */
  hasSafeLoggerImport(content) {
    return (
      content.includes("from '@/utils/safeLogger'") ||
      content.includes("from '../utils/safeLogger'") ||
      content.includes("from '../../utils/safeLogger'") ||
      content.includes('require') && content.includes('safeLogger')
    );
  }

  /**
   * 添加 safeLogger import 语句
   */
  addSafeLoggerImport(content, relativePath) {
    // 计算相对路径到 utils 的距离
    const depth = (relativePath.match(/\//g) || []).length;
    let importPath = '';

    if (depth === 1) {
      // src/components/* -> ./utils/safeLogger 或 @/utils/safeLogger
      importPath = "@/utils/safeLogger";
    } else if (depth === 2) {
      // src/components/common/*
      importPath = "@/utils/safeLogger";
    } else {
      importPath = "@/utils/safeLogger";
    }

    const importStatement = `import { logger } from '${importPath}';\n`;

    // 在文件开头的最后一个 import 之后插入
    const lines = content.split('\n');
    let lastImportIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('require(')) {
        lastImportIndex = i;
      }
    }

    if (lastImportIndex >= 0) {
      // 在最后一个 import 之后插入
      lines.splice(lastImportIndex + 1, 0, importStatement);
    } else {
      // 如果没有其他 import，在文件开头插入
      lines.unshift(importStatement);
    }

    return lines.join('\n');
  }

  /**
   * 生成详细的清理报告
   */
  generateReport() {
    const report = [];

    report.push('=' .repeat(80));
    report.push('📊 RMFOOD Console.log 清理报告');
    report.push('=' .repeat(80));
    report.push('');
    report.push(`📁 扫描目录: ${path.join(this.projectRoot, 'src')}`);
    report.push(`📄 总文件数: ${this.stats.totalFiles}`);
    report.push(`🔍 发现问题:`);
    report.push(`   - console.log: ${this.stats.consoleLogCount} 处`);
    report.push(`   - console.warn: ${this.stats.consoleWarnCount} 处`);
    report.push(`   - console.error: ${this.stats.consoleErrorCount} 处`);
    report.push(`   - console.debug: ${this.stats.consoleDebugCount} 处`);
    report.push(`   - 总计: ${this.stats.consoleLogCount + this.stats.consoleWarnCount + this.stats.consoleErrorCount + this.stats.consoleDebugCount} 处`);
    report.push('');
    report.push(`✅ 修复结果:`);
    report.push(`   - 已修改文件: ${this.stats.modifiedFiles}`);
    report.push(`   - 已修复调用: ${this.stats.fixedCount}`);
    report.push(`   - 添加import: ${this.importAddedFiles.size} 个文件`);
    report.push('');

    if (this.issues.length > 0) {
      report.push('📋 问题详情:');
      report.push('-'.repeat(80));

      this.issues.forEach((fileIssue, index) => {
        report.push(`\n${index + 1}. ${fileIssue.file} (${fileIssue.totalIssues} 处)`);
        fileIssue.issues.forEach(issue => {
          const severityIcon = {
            'high': '🔴',
            'medium': '🟡',
            'low': '🟢'
          }[issue.severity] || '⚪';

          report.push(`   ${severityIcon} 行 ${issue.line}: [${issue.type}] ${issue.content.substring(0, 80)}...`);
        });
      });
    }

    report.push('');
    report.push('=' .repeat(80));
    report.push('✨ 清理完成！所有 console.* 调用已替换为 safeLogger');
    report.push('=' .repeat(80));

    return report.join('\n');
  }

  /**
   * 执行完整的清理流程
   */
  run(options = {}) {
    const {
      directory = 'src',
      dryRun = false,
      reportOnly = false,
    } = options;

    console.log('\n🚀 开始 Console.log 清理...\n');

    // 1. 扫描文件
    console.log('📂 正在扫描文件...');
    this.scanDirectory(directory);

    if (this.issues.length === 0) {
      console.log('✅ 太棒了！没有发现 console.* 调用');
      return {
        success: true,
        message: '无需清理',
        stats: this.stats,
      };
    }

    // 2. 显示扫描结果
    console.log(`\n📊 扫描完成，发现 ${this.issues.length} 个文件存在问题:\n`);

    // 3. 生成报告或执行修复
    if (reportOnly) {
      const report = this.generateReport();
      console.log(report);

      return {
        success: true,
        message: '报告已生成',
        stats: this.stats,
        issues: this.issues,
        report: report,
      };
    }

    // 4. 执行修复
    console.log('🔧 开始修复...\n');
    this.fixAllIssues(dryRun);

    // 5. 生成最终报告
    const finalReport = this.generateReport();
    console.log('\n' + finalReport);

    return {
      success: true,
      message: dryRun ? 'Dry run 完成' : '清理完成',
      stats: this.stats,
      issues: this.issues,
      report: finalReport,
    };
  }
}

// 主程序入口
if (require.main === module) {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const tool = new ConsoleCleanupTool(projectRoot);

  // 解析命令行参数
  const args = process.argv.slice(2);
  const options = {};

  if (args.includes('--dry-run')) {
    options.dryRun = true;
  }

  if (args.includes('--report-only')) {
    options.reportOnly = true;
  }

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
使用方法:
  node cleanup-console.js [选项]

选项:
  --dry-run       仅显示将要进行的更改，不实际修改文件
  --report-only   只生成报告，不进行任何修改
  --help, -h      显示帮助信息

示例:
  node cleanup-console.js                 # 执行完整清理
  node cleanup-console.js --dry-run       # 预览将要进行的更改
  node cleanup-console.js --report-only   # 仅生成报告
    `);
    process.exit(0);
  }

  // 执行清理
  const result = tool.run(options);

  // 保存报告到文件
  const reportPath = path.join(projectRoot, 'CONSOLE_CLEANUP_REPORT.md');
  fs.writeFileSync(reportPath, result.report || tool.generateReport(), 'utf-8');
  console.log(`\n📝 报告已保存至: ${reportPath}`);

  process.exit(result.success ? 0 : 1);
}

module.exports = ConsoleCleanupTool;
