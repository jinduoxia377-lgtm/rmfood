/**
 * contentFilter — 对话内容敏感信息过滤机制
 *
 * 过滤规则：
 * 1. 个人身份信息（手机号、身份证、邮箱、银行卡）
 * 2. API Key / Token（JWT、Bearer token、sk-xxx 等）
 * 3. 密码明文
 * 4. 内部 IP 地址
 * 5. 自定义敏感词
 *
 * 输出：
 * - 脱敏后的文本
 * - 警告级别
 * - 被过滤的项列表
 */

export interface FilterResult {
  filtered: string        // 过滤后的文本
  original: string        // 原始文本
  warnings: FilterWarning[]  // 警告列表
  severity: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  blocked: boolean        // 是否应阻止发送
}

export interface FilterWarning {
  type: SensitivityType
  masked: string          // 脱敏后的值
  position: { start: number; end: number }
  rule: string            // 匹配的规则描述
}

export type SensitivityType =
  | 'phone'
  | 'id_card'
  | 'email'
  | 'bank_card'
  | 'api_key'
  | 'jwt_token'
  | 'password'
  | 'internal_ip'
  | 'custom_keyword'

// ===== 规则配置 =====

interface FilterRule {
  type: SensitivityType
  pattern: RegExp
  mask: (match: string) => string
  severity: FilterResult['severity']
  rule: string
  blocking: boolean
}

const FILTER_RULES: FilterRule[] = [
  // 手机号（中国大陆 11 位）
  {
    type: 'phone',
    pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
    mask: (m) => m.substring(0, 3) + '****' + m.substring(7),
    severity: 'high',
    rule: '手机号码',
    blocking: false,
  },
  // 身份证号（18 位）
  {
    type: 'id_card',
    pattern: /(?<![0-9Xx])\d{17}[0-9Xx](?![0-9Xx])/g,
    mask: (m) => m.substring(0, 6) + '********' + m.substring(14),
    severity: 'high',
    rule: '身份证号',
    blocking: false,
  },
  // 邮箱地址
  {
    type: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    mask: (m) => {
      const [local, domain] = m.split('@')
      return local.charAt(0) + '***@' + domain
    },
    severity: 'medium',
    rule: '邮箱地址',
    blocking: false,
  },
  // 银行卡号（16-19 位）
  {
    type: 'bank_card',
    pattern: /(?<!\d)\d{16,19}(?!\d)/g,
    mask: (m) => m.substring(0, 4) + ' **** **** ' + m.substring(m.length - 4),
    severity: 'high',
    rule: '银行卡号',
    blocking: false,
  },
  // API Key（sk-xxx, api_key=xxx 等）
  {
    type: 'api_key',
    pattern: /\b(sk-[a-zA-Z0-9]{20,}|api[_-]?key\s*[=:]\s*['"]?[a-zA-Z0-9_-]{16,}['"]?)\b/gi,
    mask: (m) => m.substring(0, Math.min(8, m.indexOf('=') >= 0 ? m.indexOf('=') + 5 : 8)) + '****',
    severity: 'critical',
    rule: 'API 密钥',
    blocking: true,
  },
  // JWT Token
  {
    type: 'jwt_token',
    pattern: /\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b/g,
    mask: (m) => m.substring(0, 15) + '...***',
    severity: 'critical',
    rule: 'JWT 令牌',
    blocking: true,
  },
  // Bearer Token
  {
    type: 'jwt_token',
    pattern: /\b(Bearer\s+[a-zA-Z0-9_\-.]{20,})\b/gi,
    mask: () => 'Bearer ****',
    severity: 'critical',
    rule: 'Bearer 令牌',
    blocking: true,
  },
  // 密码模式（password=xxx, 密码=xxx）
  {
    type: 'password',
    pattern: /(password|passwd|密码|pwd)\s*[=:]\s*['"]?\S{3,}['"]?/gi,
    mask: (m) => m.replace(/(['"]?\S{3,}['"]?)/g, '****'),
    severity: 'critical',
    rule: '密码明文',
    blocking: true,
  },
  // 内网 IP 地址
  {
    type: 'internal_ip',
    pattern: /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    mask: (m) => m.split('.').map((part, i) => i >= 2 ? '***' : part).join('.'),
    severity: 'low',
    rule: '内网 IP 地址',
    blocking: false,
  },
]

// ===== 主过滤函数 =====

/**
 * 过滤文本中的敏感信息
 * @param text 原始文本
 * @param options 额外选项
 * @returns 过滤结果
 */
export function filterSensitiveContent(
  text: string,
  options?: {
    customKeywords?: string[]    // 自定义敏感词
    customRules?: FilterRule[]   // 自定义规则
    mode?: 'strict' | 'relaxed'  // 严格/宽松模式
  }
): FilterResult {
  if (!text) return { filtered: text, original: text, warnings: [], severity: 'safe', blocked: false }

  const mode = options?.mode ?? 'strict'
  const warnings: FilterWarning[] = []
  let result = text
  let maxSeverity: FilterResult['severity'] = 'safe'
  let blocked = false

  // 合并规则
  const rules = [...FILTER_RULES, ...(options?.customRules || [])]

  // 应用每条规则
  for (const rule of rules) {
    const matches = [...result.matchAll(rule.pattern)]
    for (const match of matches) {
      if (match.index === undefined) continue

      const maskedValue = rule.mask(match[0])
      warnings.push({
        type: rule.type,
        masked: maskedValue,
        position: { start: match.index, end: match.index + match[0].length },
        rule: rule.rule,
      })

      // 升级严重程度
      const sevOrder: Record<string, number> = { safe: 0, low: 1, medium: 2, high: 3, critical: 4 }
      if (sevOrder[rule.severity] > sevOrder[maxSeverity]) {
        maxSeverity = rule.severity
      }

      // 检查是否阻塞
      if (rule.blocking && mode === 'strict') {
        blocked = true
      }

      // 替换文本
      result = result.replace(match[0], maskedValue)
    }
  }

  // 自定义关键词过滤
  if (options?.customKeywords?.length) {
    for (const keyword of options.customKeywords) {
      const idx = result.indexOf(keyword)
      if (idx >= 0) {
        const masked = '*'.repeat(keyword.length)
        warnings.push({
          type: 'custom_keyword',
          masked,
          position: { start: idx, end: idx + keyword.length },
          rule: `自定义关键词: ${keyword}`,
        })
        result = result.replace(keyword, masked)
        if (maxSeverity === 'safe') maxSeverity = 'low'
      }
    }
  }

  return {
    filtered: result,
    original: text,
    warnings,
    severity: maxSeverity,
    blocked,
  }
}

/**
 * 快速检查文本是否包含敏感信息（不做替换）
 */
export function checkSensitiveContent(text: string): {
  hasSensitive: boolean
  types: SensitivityType[]
  severity: FilterResult['severity']
} {
  const result = filterSensitiveContent(text)
  return {
    hasSensitive: result.warnings.length > 0,
    types: [...new Set(result.warnings.map(w => w.type))],
    severity: result.severity,
  }
}

/**
 * 获取过滤规则的摘要信息（用于设置页面展示）
 */
export function getFilterRulesSummary(): Array<{
  type: SensitivityType
  rule: string
  severity: FilterResult['severity']
  blocking: boolean
}> {
  return FILTER_RULES.map(r => ({
    type: r.type,
    rule: r.rule,
    severity: r.severity,
    blocking: r.blocking,
  }))
}
