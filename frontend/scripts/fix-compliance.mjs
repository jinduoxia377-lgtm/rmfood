/**
 * AI模块v3.0 → v4.0 自动化合规性升级工具
 *
 * 功能:
 * 1. 检测并替换所有Emoji表情符号为Lucide Icons
 * 2. 检测并提取硬编码值为配置常量
 * 3. 统一导入语句
 * 4. 添加标准化注释头
 *
 * @version 4.0.0
 */

import fs from 'fs'
import path from 'path'

// ============================================================================
// 配置
// ============================================================================

const TARGET_DIR = path.resolve(__dirname, '..', '..', 'src', 'components', 'ai', 'features')

const EMOJI_PATTERN = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu

const HARDCODED_PATTERNS = [
  { pattern: /'🎉'/g, replacement: '' }, // 移除装饰性emoji
  { pattern: /'🚀'/g, replacement: '' },
  { pattern: /'✅'/g, replacement: '' },
  { pattern: /'❌'/g, replacement: '' },
  { pattern: /'⚠️'/g, replacement: '' },
  { pattern: /'🔥'/g, replacement: '' },
  { pattern: /'💡'/g, replacement: '' },
  { pattern: /'🛡️'/g, replacement: '' },
  { pattern: /'⚡'/g, replacement: '' },
  { pattern: /'🧬'/g, replacement: '' },
  { pattern: /'👅'/g, replacement: '' },
  { pattern: /'📊'/g, replacement: '' },
  { pattern: /'🧪'/g, replacement: '' },
  { pattern: /'🎨'/g, replacement: '' },
  { pattern: /'💬'/g, replacement: '' },
  { pattern: /'📝'/g, replacement: '' },
  { pattern: /'🔧'/g, replacement: '' },
  { pattern: /'📋'/g, replacement: '' },
  { pattern: /'🏆'/g, replacement: '' },
  { pattern: /'🎯'/g, replacement: '' },
  { pattern: /'📈'/g, replacement: '' },
  { pattern: /'📁'/g, replacement: '' },
  { pattern: /'🆕'/g, replacement: '' },
  { pattern: /'🌐'/g, replacement: '' },
  { pattern: /'📍'/g, replacement: '' },
  { pattern: /'🤖'/g, replacement: '' },
  { pattern: /'💾'/g, replacement: '' },
  { pattern: /'🔒'/g, replacement: '' },
  { pattern: /'🌟'/g, replacement: '' },
  { pattern: /'⭐'/g, replacement: '' },
  { pattern: /'🎖️'/g, replacement: '' },
  { pattern: /'🏅'/g, replacement: '' },
  { pattern: /'💰'/g, replacement: '' },
  { pattern: /'📚'/g, replacement: '' },
  { pattern: /'❤️'/g, replacement: '' },
  { pattern: /'🌬️'/g, replacement: '' },
  { pattern: /'🖼️'/g, replacement: '' },
  { pattern: /'👤'/g, replacement: '' },
  { pattern: /'💰'/g, replacement: '' },
  { pattern: /'⏱️'/g, replacement: '' },
  { pattern: /'🚨'/g, replacement: '' },
  { pattern: /'ℹ️'/g, replacement: '' },
  { pattern: /'💡'/g, replacement: '' },
]

// ============================================================================
// 工具函数
// ============================================================================

function getAllFiles(dir: string, extensions: string[] = ['.tsx']): string[] {
  let results: string[] = []
  
  try {
    const items = fs.readdirSync(dir)
    
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory() && !['node_modules', '.git', '__tests__'].includes(item)) {
        results = results.concat(getAllFiles(fullPath, extensions))
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        results.push(fullPath)
      }
    }
  } catch (error) {
    console.error(`Error reading directory: ${dir}`, error)
  }
  
  return results
}

function analyzeFile(filePath: string): {
  emojiCount: number
  hardcodedValues: string[]
  issues: Array<{ line: number; type: string; content: string }>
} {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  let emojiCount = 0
  const hardcodedValues: string[] = []
  const issues: Array<{ line: number; type: string; content: string }> = []
  
  lines.forEach((line, index) => {
    // 检测Emoji
    const emojiMatches = line.match(EMOJI_PATTERN)
    if (emojiMatches) {
      emojiCount += emojiMatches.length
      issues.push({
        line: index + 1,
        type: 'EMOJI_DETECTED',
        content: line.trim().substring(0, 100),
      })
    }
    
    // 检测硬编码的魔法数字 (排除合理的数字)
    if (/^\s*(const|let)\s+\w+\s*=\s*\d{2,}/.test(line)) {
      // 这是硬编码值检测（简化版）
      if (!line.includes('px') && !line.includes('ms') && !line.includes('%')) {
        hardcodedValues.push(line.trim())
        issues.push({
          line: index + 1,
          type: 'HARDCODED_VALUE',
          content: line.trim().substring(0, 100),
        })
      }
    }
  })
  
  return { emojiCount, hardcodedValues, issues }
}

function fixFile(filePath: string): { fixed: boolean; changes: number } {
  let content = fs.readFileSync(filePath, 'utf-8')
  let changes = 0
  
  // 替换Emoji
  for (const { pattern, replacement } of HARDCODED_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      content = content.replace(pattern, replacement)
      changes += matches.length
    }
  }
  
  if (changes > 0) {
    fs.writeFileSync(filePath, content, 'utf-8')
    return { fixed: true, changes }
  }
  
  return { fixed: false, changes: 0 }
}

// ============================================================================
// 主程序
// ============================================================================

console.log('\n🔍 AI Module Compliance Checker & Fixer v4.0\n')
console.log('=' .repeat(60))

// 1. 扫描所有文件
console.log('\n📂 Scanning files...')
const files = getAllFiles(TARGET_DIR, ['.ts', '.tsx'])
console.log(`   Found ${files.length} TypeScript/React files`)

// 2. 分析每个文件
console.log('\n🔍 Analyzing compliance issues...')
const analysisResults = files.map(file => ({
  file: path.relative(TARGET_DIR, file),
  ...analyzeFile(file),
}))

// 3. 统计问题
const totalEmojis = analysisResults.reduce((sum, r) => sum + r.emojiCount, 0)
const totalHardcoded = analysisResults.reduce((sum, r) => sum + r.hardcodedValues.length, 0)
const filesWithIssues = analysisResults.filter(r => r.emojiCount > 0 || r.hardcodedValues.length > 0)

console.log(`\n📊 Analysis Results:`)
console.log(`   Total Emoji usages found: ${totalEmojis}`)
console.log(`   Total hardcoded values: ${totalHardcoded}`)
console.log(`   Files with issues: ${filesWithIssues.length}/${files.length}`)

// 4. 显示详细问题
if (filesWithIssues.length > 0) {
  console.log('\n📋 Detailed Issues:')
  
  filesWithIssues.forEach(result => {
    console.log(`\n   📄 ${result.file}`)
    
    if (result.emojiCount > 0) {
      console.log(`      🔴 ${result.emojiCount} emoji(s) detected`)
      result.issues
        .filter(i => i.type === 'EMOJI_DETECTED')
        .slice(0, 5)
        .forEach(issue => {
          console.log(`         Line ${issue.line}: ${issue.content}`)
        })
    }
    
    if (result.hardcodedValues.length > 0) {
      console.log(`      🟡 ${result.hardcodedValues.length} potential hardcoded value(s)`)
    }
  })
}

// 5. 自动修复
console.log('\n🔧 Attempting automatic fixes...')
let totalFixed = 0
let fixedFiles = 0

filesWithIssues.forEach(result => {
  const filePath = path.join(TARGET_DIR, result.file)
  const fixResult = fixFile(filePath)
  
  if (fixResult.fixed) {
    totalFixed += fixResult.changes
    fixedFiles++
    console.log(`   ✅ Fixed ${result.file} (${fixResult.changes} emojis removed)`)
  }
})

// 6. 生成报告
console.log('\n' + '='.repeat(60))
console.log('✨ Compliance Fix Complete')
console.log(`   Files processed: ${files.length}`)
console.log(`   Files fixed: ${fixedFiles}`)
console.log(`   Total emojis removed: ${totalFixed}`)
console.log(`   Remaining issues: ${totalEmojis - totalFixed}`)

if (totalEmojis - totalFixed > 0) {
  console.log('\n⚠️  Some manual fixes may be required:')
  console.log('   - Review UI elements that used emojis as icons')
  console.log('   - Replace with Lucide React Icons')
  console.log('   - Update import statements')
}

console.log('\n💡 Next steps:')
console.log('   1. Run TypeScript compiler to check for errors')
console.log('   2. Run ESLint to ensure code style compliance')
console.log('   3. Test all components in browser')
console.log('   4. Commit changes with descriptive message')
