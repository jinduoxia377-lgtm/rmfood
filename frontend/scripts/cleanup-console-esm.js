// RMFOOD Console.log 清理工具 (ES Module版本)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..', '..');
const targetDir = path.join(projectRoot, 'frontend', 'src');

console.log('\n🚀 开始 Console.log 清理...\n');

let stats = {
  totalFiles: 0,
  modifiedFiles: 0,
  consoleLogCount: 0,
  consoleWarnCount: 0,
  consoleErrorCount: 0,
  consoleDebugCount: 0,
  fixedCount: 0,
  importAdded: 0,
};

function getAllFiles(dir, extensions) {
  let results = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build', '__mocks__', '__tests__'].includes(item)) {
          results = results.concat(getAllFiles(fullPath, extensions));
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

function analyzeAndFixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(targetDir, filePath);
    
    let hasChanges = false;
    let fileStats = { log: 0, warn: 0, error: 0, debug: 0 };
    
    // 检查并替换 console.log
    const logMatches = content.match(/console\.log\s*\(/g);
    if (logMatches) {
      fileStats.log = logMatches.length;
      stats.consoleLogCount += logMatches.length;
      content = content.replace(/console\.log\s*\(/g, 'logger.info(');
      hasChanges = true;
    }
    
    // 检查并替换 console.warn
    const warnMatches = content.match(/console\.warn\s*\(/g);
    if (warnMatches) {
      fileStats.warn = warnMatches.length;
      stats.consoleWarnCount += warnMatches.length;
      content = content.replace(/console\.warn\s*\(/g, 'logger.warn(');
      hasChanges = true;
    }
    
    // 检查并替换 console.error
    const errorMatches = content.match(/console\.error\s*\(/g);
    if (errorMatches) {
      fileStats.error = errorMatches.length;
      stats.consoleErrorCount += errorMatches.length;
      content = content.replace(/console\.error\s*\(/g, 'logger.error(');
      hasChanges = true;
    }
    
    // 检查并替换 console.debug
    const debugMatches = content.match(/console\.debug\s*\(/g);
    if (debugMatches) {
      fileStats.debug = debugMatches.length;
      stats.consoleDebugCount += debugMatches.length;
      content = content.replace(/console\.debug\s*\(/g, 'logger.debug(');
      hasChanges = true;
    }
    
    if (hasChanges) {
      // 检查是否需要添加 import
      const needsImport = !(
        content.includes("from '@/utils/safeLogger'") ||
        content.includes("from './utils/safeLogger'") ||
        content.includes("from '../utils/safeLogger'") ||
        content.includes("from '../../utils/safeLogger'")
      );
      
      if (needsImport) {
        const importStatement = "import { logger } from '@/utils/safeLogger';\n";
        
        const lines = content.split('\n');
        let lastImportIndex = -1;
        
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('require(')) {
            lastImportIndex = i;
          }
        }
        
        if (lastImportIndex >= 0) {
          lines.splice(lastImportIndex + 1, 0, importStatement);
        } else {
          lines.unshift(importStatement);
        }
        
        content = lines.join('\n');
        stats.importAdded++;
      }
      
      // 写入文件
      fs.writeFileSync(filePath, content, 'utf-8');
      stats.modifiedFiles++;
      stats.fixedCount += fileStats.log + fileStats.warn + fileStats.error + fileStats.debug;
      
      const totalIssues = fileStats.log + fileStats.warn + fileStats.error + fileStats.debug;
      console.log(`   ✅ 已修复: ${relativePath} (${totalIssues} 处)`);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`处理文件失败: ${filePath}`, error.message);
    return false;
  }
}

// 主流程
console.log('📂 正在扫描文件...');

if (!fs.existsSync(targetDir)) {
  console.log(`❌ 目录不存在: ${targetDir}`);
  process.exit(1);
}

const files = getAllFiles(targetDir, ['.ts', '.tsx']);
stats.totalFiles = files.length;

console.log(`   找到 ${stats.totalFiles} 个文件\n`);

let issuesFound = 0;

files.forEach(file => {
  if (analyzeAndFixFile(file)) {
    issuesFound++;
  }
});

const totalAll = stats.consoleLogCount + stats.consoleWarnCount + stats.consoleErrorCount + stats.consoleDebugCount;

console.log('\n================================================================================');
console.log('📊 RMFOOD Console.log 清理报告');
console.log('================================================================================');
console.log('');
console.log(`📁 扫描目录: ${targetDir}`);
console.log(`📄 总文件数: ${stats.totalFiles}`);
console.log('🔍 发现问题:');
console.log(`   - console.log: ${stats.consoleLogCount} 处`);
console.log(`   - console.warn: ${stats.consoleWarnCount} 处`);
console.log(`   - console.error: ${stats.consoleErrorCount} 处`);
console.log(`   - console.debug: ${stats.consoleDebugCount} 处`);
console.log(`   - 总计: ${totalAll} 处`);
console.log('');
console.log('✅ 修复结果:');
console.log(`   - 已修改文件: ${stats.modifiedFiles}`);
console.log(`   - 已修复调用: ${stats.fixedCount}`);
console.log(`   - 添加import: ${stats.importAdded} 个文件`);
console.log('');
console.log('✨ 清理完成！所有 console.* 调用已替换为 safeLogger');
console.log('================================================================================');

console.log('\n✅ 清理流程完成！\n');
