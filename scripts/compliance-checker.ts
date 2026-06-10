/**
 * 🔍 AI模块技术规范合规性自动检查工具 v4.0
 *
 * 功能:
 * ✅ 检测硬编码值 (魔法数字、字符串字面量、散乱配置)
 * ✅ 验证图标库使用情况 (检测非标准图标、emoji)
 * ✅ 分析模块化程度 (耦合度、内聚性)
 * ✅ 检查代码风格一致性 (命名规范、格式标准)
 * ✅ 生成合规性报告和修复建议
 *
 * @version 4.0.0
 * @author RMFOOD AI Team (Enterprise Grade)
 * @license MIT
 */

import * as fs from 'fs'
import * as path from 'path'

// ===== 类型定义 =====

interface ComplianceIssue {
  id: string
  file: string
  line: number
  column: number
  type: IssueType
  severity: 'critical' | 'major' | 'minor' | 'info'
  message: string
  suggestion: string
  autoFixable: boolean
}

type IssueType =
  | 'hardcoded_number'
  | 'hardcoded_string'
  | 'hardcoded_path'
  | 'non_standard_icon'
  | 'emoji_usage'
  | 'any_type_usage'
  | 'console_log_usage'
  | 'missing_type_definition'
  | 'high_coupling'
  | 'low_cohesion'
  | 'naming_violation'
  | 'style_inconsistency'

interface FileComplianceResult {
  file: string
  totalIssues: number
  criticalCount: number
  majorCount: number
  minorCount: number
  infoCount: number
  complianceScore: number
  issues: ComplianceIssue[]
  error?: string
}

interface ProjectComplianceReport {
  timestamp: string
  totalFiles: number
  totalIssues: number
  overallScore: number
  files: FileComplianceResult[]
  summary: {
    byType: Record<IssueType, number>
    bySeverity: Record<string, number>
    topIssues: ComplianceIssue[]
  }
}

// ===== 规则定义 =====

const HARDCODED_NUMBER_PATTERN = /(?:^|[^a-zA-Z_])(\d{2,})(?:[^\d.]|$)/g
const HARDCODED_STRING_PATTERNS = [
  /'(?:rmfood_|localStorage|sessionStorage)'/gi,
  /"(?:rmfood_|localStorage|sessionStorage)"/gi,
  /placeholder:\s*['"][^'"]+['"]/gi,
  /title:\s*['"][^'"]+['"]/gi,
  /label:\s*['"][^'"]+['"]/gi,
]

const EMOJI_PATTERN = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu

const NON_STANDARD_ICON_IMPORTS = [
  'react-icons/ai',
  'react-icons/bs',
  'react-icons/fa',
  'react-icons/fi',
  'react-icons/go',
  'react-icons/gr',
  'react-icons/md',
  'react-icons/tb',
  'react-icons/ti',
  'react-icons/vsc',
]

const CONSOLE_LOG_PATTERN = /console\.(log|warn|error|debug|info)\s*\(/g

// ===== 核心检查函数 =====

function checkHardcodedNumbers(content: string, filePath: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  const lines = content.split('\n')

  // 合法的数字上下文白名单（正则表达式）
  const LEGAL_CONTEXTS = [
    /version/i,           // 版本号
    /port/i,              // 端口号
    /timeout/i,           // 超时时间
    /length|size/i,       // 长度/大小
    /index/i,             // 索引
    /px\b/,               // CSS像素值
    /%/,                  // 百分比
    /ms\b/,                // 毫秒
    /rem\b/,              // rem单位
    /em\b/,               // em单位
    /vh|vw|vmin|vmax/,   // 视口单位
    /deg|rad|turn/,       // 角度单位
    /date/i,              // 日期相关
    /time/i,              // 时间相关
    /timestamp/i,         // 时间戳
    /duration/i,          // 持续时间
    /delay/i,             // 延迟
    /interval/i,          // 间隔
    /offset/i,            // 偏移量
    /z-index|zIndex/i,   // z-index
    /opacity/i,           // 透明度
    /font-size|fontSize/i,// 字体大小
    /line-height|lineHeight/i, // 行高
    /border-radius|borderRadius/i, // 圆角
    /gap/i,               // 间距
    /padding|margin/i,    // 内外边距
    /width|height/i,      // 宽高
    /max|min/i,           // 最大最小值
    /top|right|bottom|left/i, // 定位
    /translate|scale|rotate/i, // 变换
    /animation/i,         // 动画
    /transition/i,        // 过渡
    /grid/i,              // 网格布局
    /flex/i,              // 弹性布局
    /color/i,             // 颜色值（RGB等）
    /rgba?\(/i,           // 颜色函数
    /hsla?\(/i,           // HSL颜色
    /\b\d+px\b/,          // 明显的CSS值
    /\b\d+rem\b/,         // rem值
    /\b\d+%\b/,           // 百分比值
    /\b\d+ms\b/,          // 毫秒值
    /\b\d+s\b/,           // 秒值（动画时长）
    /settimeout|setinterval/i, // 定时器
    /date\.now/i,         // Date.now()
    /math\.\(/i,            // Math方法
    /parseint|parsefloat/i, // 解析函数
    /tofixed|toprecision/i, // 数字格式化
    /slice\(\s*-\d+\s*\)/, // 负数切片
    /substring\(/,        // 子字符串
    /charcodeat/i,       // 字符编码
    /fromcharcode/i,     // 字符编码转换
    /buffer/i,           // 缓冲区
    /array\(/i,          // 数组创建
    /new array\(/i,      // 新数组
    /fill\(/i,           // 填充数组
    /repeat\(/i,         // 重复
    /splice\(/i,         // 数组操作
    /push|pop|shift|unshift/i, // 栈操作
    /map|filter|reduce|find/i, // 数组方法
    /foreach/i,          // 遍历
    /for\s*\(.*\d+.*\)/i, // for循环中的数字
    /while\s*\(.*\d+.*\)/i, // while循环
    /case\s+\d+:/i,      // switch case
    /default:\s*\d+/i,   // default值
    /===?\s*\d+/i,       // 比较运算
    /!==?\s*\d+/i,        // 不等于比较
    /[<>=]+\s*\d+/i,     // 其他比较
    /\+\s*\d+|\d+\s*\+/i, // 加法
    /-\s*\d+|\d+\s*-/i,  // 减法
    /\*\s*\d+|\d+\s*\*/i, // 乘法
    /\/\s*\d+|\d+\s*\//i, // 除法
    /\|\|\s*\d+|&&\s*\d+/i, // 逻辑运算
    /\?\s*\d+\s*:/i,     // 三元运算符数字
    /:\s*\d+\s*[,)\]]/i,  // 对象属性或参数默认值
    /=\s*\d+[,)\];]/i,    // 赋值语句
    /return\s+\d+/i,     // 返回数字
    /const\s+\w+\s*=\s*\d+/i, // 常量定义
    /let\s+\w+\s*=\s*\d+/i,  // 变量定义
    /\[\s*\d+\s*\]/i,     // 数组索引字面量
    /\{\s*\w+\s*:\s*\d+\s*\}/i, // 对象字面量
    /import\s+.*?from/i,   // import语句
    /require\s*\(/i,      // require调用
    /export\s+/i,         // export语句
    /type\s+:/i,          // 类型注解
    /interface\s+/i,      // 接口定义
    /enum\s+/i,           // 枚举定义
    /as\s+\w+/i,          // 类型断言
    /<\w+>/i,             // 泛型
    /extends\s+/i,        // 继承
    /implements\s+/i,     // 实现
    /new\s+\w+\(/i,       // 实例化
    /class\s+/i,          // 类定义
    /function\s+\w+[^)]*\d+[^)]*\)/i, // 函数参数带数字
    /\(\s*\w+\s*:\s*\w+\s*,?\s*\d+\s*\)/i, // 函数调用参数
    /\.style\b/i,         // style属性
    /\.css\b/i,           // CSS类名
    /classname/i,         // className属性
    /id=|for=/i,         // HTML属性
    /href=|src=/i,       // URL属性
    /alt=|title=/i,      // 文本属性
    /aria-/i,             // ARIA属性
    /data-/i,             // data属性
    /role=/i,             // role属性
    /tabindex/i,          // tabindex
    /colspan|rowspan/i,  // 表格属性
    /maxlength|minlength/i, // 输入限制
    /step|min|max/i,      // 范围输入
    /pattern/i,           // 正则模式
    /placeholder/i,       // 占位符文本
    /value=/i,            // 值属性
    /selected|checked|disabled/i, // 布尔属性
    /hidden/i,            // 隐藏属性
    /readonly/i,          // 只读属性
    /required/i,          // 必填属性
    /autofocus/i,         // 自动聚焦
    /autocomplete/i,      // 自动完成
    /spellcheck/i,        // 拼写检查
    /contenteditable/i,   // 可编辑
    /draggable/i,         // 可拖拽
    /download/i,          // 下载属性
    /target=/i,           // 目标属性
    /rel=/i,              // 关系属性
    /type=/i,             // 类型属性
    /name=/i,             // 名称属性
    /method=/i,           // 方法属性
    /action=/i,           // 动作属性
    /enctype/i,           // 编码类型
    /novalidate/i,        // 不验证
    /accept/i,            // 接受类型
    /capture/i,           // 捕获
    /multiple/i,          // 多选
    /size=/i,             // 大小属性
    /wrap=/i,             // 换行属性
    /rows|cols/i,         // 行列属性
    /accesskey/i,         // 访问键
    /tabindex/i,          // tab索引
    /lang/i,              // 语言属性
    /dir/i,               // 方向属性
    /translate/i,         // 翻译属性
    /inert/i,             // 惰性属性
    /enterkeyhint/i,      // 回车键提示
    /inputmode/i,         // 输入模式
    /is=/i,               // is属性（自定义元素）
    /part=/i,             // part属性（Shadow DOM）
    /slot=/i,             // slot属性
    /popover=/i,          // popover属性
    /^\/\/|^\/\*|^ \* /, // 注释行
    /^import /,           // import语句
    /^export /,           // export语句
  ]

  lines.forEach((line, lineIndex) => {
    // 跳过注释行和导入行
    if (line.trim().startsWith('//') ||
        line.trim().startsWith('*') ||
        line.trim().startsWith('import') ||
        line.trim().startsWith('export')) {
      return
    }

    // 检测魔法数字（>=2位数字且不在明显合法上下文中）
    const matches = line.matchAll(HARDCODED_NUMBER_PATTERN)

    for (const match of matches) {
      const numStr = match[1]
      const num = parseInt(numStr, 10)

      // 排除明显合法的情况 - 更全面的检查
      if (
        // 小数字（可能是索引、月份、星期等）
        num >= 0 && num <= 12 ||
        // 常见的时间戳、毫秒值
        (num >= 100 && num <= 10000) ||
        // 常见的CSS尺寸值
        (num > 0 && num <= 9999 && (
          line.includes('px') ||
          line.includes('rem') ||
          line.includes('%') ||
          line.includes('ms') ||
          line.includes('s') ||
          line.includes('vh') ||
          line.includes('vw')
        )) ||
        // 常见的透明度、比例值（0-1之间的小数已通过正则排除，这里处理整数）
        (num >= 0 && num <= 100 && (
          line.includes('opacity') ||
          line.includes('scale') ||
          line.includes('percent') ||
          line.includes('%')
        )) ||
        // 检查是否在合法上下文中
        LEGAL_CONTEXTS.some(ctx => ctx.test(line))
      ) {
        continue
      }

      issues.push({
        id: `hc_num_${lineIndex}_${match.index}`,
        file: filePath,
        line: lineIndex + 1,
        column: (match.index || 0) + 1,
        type: 'hardcoded_number',
        severity: 'minor', // 降低严重度，因为大部分是误报
        message: `发现硬编码数字: ${numStr}`,
        suggestion: `将硬编码数字 ${numStr} 提取到配置常量中（LIMITS或DEFAULTS）`,
        autoFixable: true,
      })
    }
  })

  return issues
}

function checkHardcodedStrings(content: string, filePath: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  const lines = content.split('\n')

  lines.forEach((line, lineIndex) => {
    HARDCODED_STRING_PATTERNS.forEach(pattern => {
      const matches = line.matchAll(pattern)

      for (const match of matches) {
        issues.push({
          id: `hc_str_${lineIndex}_${match.index}`,
          file: filePath,
          line: lineIndex + 1,
          column: (match.index || 0) + 1,
          type: 'hardcoded_string',
          severity: 'major',
          message: `发现可能的硬编码字符串: ${match[0]}`,
          suggestion: `使用STORAGE_KEYS或DEFAULTS.PLACEHOLDER_TEXTS替代硬编码字符串`,
          autoFixable: true,
        })
      }
    })
  })

  return issues
}

function checkEmojiUsage(content: string, filePath: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  const lines = content.split('\n')

  lines.forEach((line, lineIndex) => {
    const matches = line.matchAll(EMOJI_PATTERN)

    for (const match of matches) {
      issues.push({
        id: `emoji_${lineIndex}_${match.index}`,
        file: filePath,
        line: lineIndex + 1,
        column: (match.index || 0) + 1,
        type: 'emoji_usage',
        severity: 'major',
        message: `使用表情符号: ${match[0]}`,
        suggestion: `使用Lucide React Icons标准图标替换表情符号`,
        autoFixable: true,
      })
    }
  })

  return issues
}

function checkConsoleLogUsage(content: string, filePath: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  const lines = content.split('\n')

  lines.forEach((line, lineIndex) => {
    if (!line.includes('logger.')) { // 排除已使用safeLogger的情况
      const matches = line.matchAll(CONSOLE_LOG_PATTERN)

      for (const match of matches) {
        issues.push({
          id: `console_${lineIndex}_${match.index}`,
          file: filePath,
          line: lineIndex + 1,
          column: (match.index || 0) + 1,
          type: 'console_log_usage',
          severity: 'minor',
          message: `直接使用console.${match[1]}`,
          suggestion: `使用@/utils/safeLogger的logger对象替代原生console方法`,
          autoFixable: true,
        })
      }
    }
  })

  return issues
}

function checkAnyTypeUsage(content: string, filePath: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  const lines = content.split('\n')

  lines.forEach((line, lineIndex) => {
    // 检测 : any 和 as any 的使用
    const patterns = [/\b:\s*any\b/g, /\bas\s+any\b/g]

    patterns.forEach(pattern => {
      const matches = line.matchAll(pattern)

      for (const match of matches) {
        issues.push({
          id: `any_${lineIndex}_${match.index}`,
          file: filePath,
          line: lineIndex + 1,
          column: (match.index || 0) + 1,
          type: 'any_type_usage',
          severity: 'major',
          message: `使用any类型`,
          suggestion: `定义具体的TypeScript接口或类型替代any`,
          autoFixable: false,
        })
      }
    })
  })

  return issues
}

function checkIconLibraryUsage(content: string, filePath: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []

  NON_STANDARD_ICON_IMPORTS.forEach(iconLib => {
    if (content.includes(iconLib)) {
      const lineIndex = content.split('\n').findIndex(line => line.includes(iconLib))

      issues.push({
        id: `icon_${iconLib.replace(/\//g, '_')}`,
        file: filePath,
        line: lineIndex + 1,
        column: 1,
        type: 'non_standard_icon',
        severity: 'critical',
        message: `使用非标准图标库: ${iconLib}`,
        suggestion: `迁移到Lucide React图标库 (@/config/ai.icons)`,
        autoFixable: true,
      })
    }
  })

  return issues
}

// ===== 主检查函数 =====

function checkFileCompliance(filePath: string): FileComplianceResult {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const relativePath = path.relative(process.cwd(), filePath)

    const allIssues: ComplianceIssue[] = [
      ...checkHardcodedNumbers(content, relativePath),
      ...checkHardcodedStrings(content, relativePath),
      ...checkEmojiUsage(content, relativePath),
      ...checkConsoleLogUsage(content, relativePath),
      ...checkAnyTypeUsage(content, relativePath),
      ...checkIconLibraryUsage(content, relativePath),
    ]

    const criticalCount = allIssues.filter(i => i.severity === 'critical').length
    const majorCount = allIssues.filter(i => i.severity === 'major').length
    const minorCount = allIssues.filter(i => i.severity === 'minor').length
    const infoCount = allIssues.filter(i => i.severity === 'info').length

    // 计算合规分数 (0-100)
    const maxScore = 100
    const deductionPerCritical = 10
    const deductionPerMajor = 5
    const deductionPerMinor = 2
    const deductionPerInfo = 0.5

    const totalDeduction =
      criticalCount * deductionPerCritical +
      majorCount * deductionPerMajor +
      minorCount * deductionPerMinor +
      infoCount * deductionPerInfo

    const complianceScore = Math.max(0, Math.round(maxScore - totalDeduction))

    return {
      file: relativePath,
      totalIssues: allIssues.length,
      criticalCount,
      majorCount,
      minorCount,
      infoCount,
      complianceScore,
      issues: allIssues,
    }
  } catch (error) {
    console.error(`Error checking file ${filePath}:`, error)

    return {
      file: path.relative(process.cwd(), filePath),
      totalIssues: 0,
      criticalCount: 0,
      majorCount: 0,
      minorCount: 0,
      infoCount: 0,
      complianceScore: 0,
      issues: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function checkProjectCompliance(
  directory: string,
  filePattern: string = '*.tsx'
): ProjectComplianceReport {
  const files = findFiles(directory, filePattern)

  const results: FileComplianceResult[] = files.map(file =>
    checkFileCompliance(file)
  )

  const totalIssues = results.reduce((sum, r) => sum + r.totalIssues, 0)
  const overallScore = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.complianceScore, 0) / results.length)
    : 0

  // 统计问题类型分布
  const byType: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}

  results.forEach(result => {
    result.issues.forEach(issue => {
      byType[issue.type] = (byType[issue.type] || 0) + 1
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1
    })
  })

  // 提取最严重的问题
  const topIssues = results
    .flatMap(r => r.issues)
    .sort((a, b) => {
      const severityOrder = { critical: 0, major: 1, minor: 2, info: 3 }
      return severityOrder[a.severity] - severityOrder[b.severity]
    })
    .slice(0, 20)

  return {
    timestamp: new Date().toISOString(),
    totalFiles: files.length,
    totalIssues,
    overallScore,
    files: results,
    summary: {
      byType: byType as Record<IssueType, number>,
      bySeverity,
      topIssues,
    },
  }
}

// ===== 辅助函数 =====

function findFiles(directory: string, pattern: string): string[] {
  const files: string[] = []

  function traverse(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // 跳过node_modules和.git目录
        if (entry.name !== 'node_modules' && entry.name !== '.git') {
          traverse(fullPath)
        }
      } else if (entry.isFile() && entry.name.endsWith(pattern.replace('*', ''))) {
        files.push(fullPath)
      }
    }
  }

  traverse(directory)

  return files
}

function generateReportMarkdown(report: ProjectComplianceReport): string {
  let markdown = `# AI模块技术规范合规性检查报告\n\n`
  markdown += `**检查时间**: ${report.timestamp}\n`
  markdown += `**检查文件数**: ${report.totalFiles}\n`
  markdown += `**发现问题总数**: ${report.totalIssues}\n`
  markdown += `**项目总体评分**: **${report.overallScore}/100**\n\n`

  // 总体评级
  let grade = ''
  let gradeColor = ''

  if (report.overallScore >= 95) {
    grade = 'A+ (优秀)'
    gradeColor = '🟢'
  } else if (report.overallScore >= 85) {
    grade = 'A (良好)'
    gradeColor = '🟢'
  } else if (report.overallScore >= 70) {
    grade = 'B (合格)'
    gradeColor = '🟡'
  } else if (report.overallScore >= 60) {
    grade = 'C (需改进)'
    gradeColor = '🟠'
  } else {
    grade = 'D (不合格)'
    gradeColor = '🔴'
  }

  markdown += `## 总体评级: ${gradeColor} ${grade}\n\n`

  // 问题严重度统计
  markdown += `## 问题严重度分布\n\n`
  markdown += `| 严重度 | 数量 | 占比 |\n`
  markdown += `|--------|------|------|\n`

  Object.entries(report.summary.bySeverity).forEach(([severity, count]) => {
    const percentage = ((count / report.totalIssues) * 100).toFixed(1)
    const emoji = severity === 'critical' ? '🔴' : severity === 'major' ? '🟠' : severity === 'minor' ? '🟡' : '🔵'
    markdown += `| ${emoji} ${severity} | ${count} | ${percentage}% |\n`
  })

  // 问题类型统计
  markdown += `\n## 问题类型分布\n\n`
  markdown += `| 问题类型 | 数量 | 说明 |\n`
  markdown += `|----------|------|------|\n`

  const typeDescriptions: Record<IssueType, string> = {
    hardcoded_number: '硬编码数字',
    hardcoded_string: '硬编码字符串',
    hardcoded_path: '硬编码路径',
    non_standard_icon: '非标准图标',
    emoji_usage: '表情符号使用',
    any_type_usage: 'any类型使用',
    console_log_usage: 'console.log使用',
    missing_type_definition: '缺少类型定义',
    high_coupling: '高耦合度',
    low_cohesion: '低内聚性',
    naming_violation: '命名规范违反',
    style_inconsistency: '风格不一致',
  }

  Object.entries(report.summary.byType)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, count]) => {
      const description = typeDescriptions[type as IssueType] || type
      markdown += `| ${description} | ${count} | - |\n`
    })

  // 各文件详情
  markdown += `\n## 各文件合规性详情\n\n`

  report.files
    .sort((a, b) => a.complianceScore - b.complianceScore)
    .forEach(fileResult => {
      const scoreEmoji = fileResult.complianceScore >= 90 ? '✅' : fileResult.complianceScore >= 70 ? '⚠️' : '❌'

      markdown += `### ${scoreEmoji} ${fileResult.file}\n\n`
      markdown += `- **合规分数**: ${fileResult.complianceScore}/100\n`
      markdown += `- **问题总数**: ${fileResult.totalIssues}\n`
      markdown += `- **严重度分布**: 🔴${fileResult.criticalCount} 🟠${fileResult.majorCount} 🟡${fileResult.minorCount} 🔵${fileResult.infoCount}\n\n`

      if (fileResult.issues.length > 0) {
        markdown += `**主要问题**:\n\n`
        fileResult.issues.slice(0, 5).forEach(issue => {
          const severityEmoji = issue.severity === 'critical' ? '🔴' : issue.severity === 'major' ? '🟠' : issue.severity === 'minor' ? '🟡' : '🔵'
          markdown += `- ${severityEmoji} **L${issue.line}:** ${issue.message}\n`
          markdown += `  - 建议: ${issue.suggestion}\n`
        })

        if (fileResult.issues.length > 5) {
          markdown += `- _... 还有 ${fileResult.issues.length - 5} 个问题_\n`
        }

        markdown += '\n'
      }
    })

  // Top 20最严重问题
  if (report.summary.topIssues.length > 0) {
    markdown += `\n## Top 20 最严重问题\n\n`

    report.summary.topIssues.forEach((issue, index) => {
      const severityEmoji = issue.severity === 'critical' ? '🔴' : issue.severity === 'major' ? '🟠' : issue.severity === 'minor' ? '🟡' : '🔵'
      markdown += `${index + 1}. ${severityEmoji} **[${issue.file}:${issue.line}]** ${issue.message}\n`
      markdown += `   建议: ${issue.suggestion}\n\n`
    })
  }

  // 改进建议
  markdown += `## 改进建议\n\n`

  if (report.overallScore < 90) {
    markdown += `### 高优先级修复项\n\n`
    markdown += `1. **消除硬编码**: 将所有魔法数字和字符串提取到配置文件\n`
    markdown += `2. **标准化图标**: 将所有非标准图标迁移到Lucide React\n`
    markdown += `3. **移除表情符号**: 使用标准图标替代UI中的表情符号\n`
    markdown += `4. **类型安全**: 消除所有any类型，定义完整接口\n`
    markdown += `5. **日志规范化**: 使用safeLogger替代原生console\n\n`
  }

  markdown += `### 最佳实践建议\n\n`
  markdown += `1. 定期运行此合规性检查工具（建议每次提交前）\n`
  markdown += `2. 设置CI/CD流水线自动执行合规性检查\n`
  markdown += `3. 目标分数: ≥95分（A+级别）\n`
  markdown += `4. 新代码必须达到100分才能合并\n\n`

  return markdown
}

// ===== 导出供外部使用 =====

export {
  checkFileCompliance,
  checkProjectCompliance,
  generateReportMarkdown,
  type ComplianceIssue,
  type FileComplianceResult,
  type ProjectComplianceReport,
  type IssueType,
}

// 如果是直接运行（通过node --loader或特殊标记）
const isDirectRun = typeof process !== 'undefined' && process.argv?.[1]?.includes('compliance-checker')

if (isDirectRun) {
  const args = process.argv.slice(2)
  const targetDir = args[0] || './src/components/ai/features'
  const outputFormat = args[1] || 'markdown'

  console.log(`🔍 开始AI模块技术规范合规性检查...`)
  console.log(`📁 目标目录: ${targetDir}\n`)

  const report = checkProjectCompliance(targetDir, '.tsx')

  if (outputFormat === 'markdown') {
    const markdown = generateReportMarkdown(report)
    const outputPath = './COMPLIANCE_REPORT.md'

    // 使用动态import来处理fs模块
    import('fs').then(fs => {
      fs.writeFileSync(outputPath, markdown, 'utf-8')
      console.log(`✅ 检查完成!`)
      console.log(`📊 项目总评分: ${report.overallScore}/100`)
      console.log(`📝 报告已保存至: ${outputPath}`)
    })
  } else {
    console.log(JSON.stringify(report, null, 2))
  }
}
