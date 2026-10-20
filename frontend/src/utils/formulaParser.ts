import { logger } from '@/utils/safeLogger'
export interface Ingredient {
  name: string
  amount: number
  unit: string
  percentage?: number
  role?: string
  efficacyTags?: string[]
  precautions?: { content: string; severity: string; type?: string }[]
}

export interface FormulaTableData {
  name?: string
  ingredients: Ingredient[]
  totalAmount?: number
  description?: string
  confidence?: number
  formatType?: string
}

export interface SynergyRadarData {
  dimension: string
  value: number
  fullMark?: number
  description?: string
}

export enum MessageType {
  TEXT = 'TEXT',
  FORMULA_TABLE = 'FORMULA_TABLE',
  RADAR_CHART = 'RADAR_CHART',
  REPORT_PREVIEW = 'REPORT_PREVIEW'
}

const SYNERGY_DIMENSION_PATTERNS: Record<string, RegExp[]> = {
  synergy: [
    /协同强度[：:\s]*(\d{1,3})/i,
    /协同效应[：:\s]*(\d{1,3})/i,
    /synergy[^0-9]{0,10}(\d{1,3})/i,
    /协同评分[：:\s]*(\d{1,3})/i,
  ],
  bioavailability: [
    /生物利用度[：:\s]*(\d{1,3})/i,
    /吸收率[：:\s]*(\d{1,3})/i,
    /bioavailability[^0-9]{0,10}(\d{1,3})/i,
    /吸收效率[：:\s]*(\d{1,3})/i,
  ],
  efficacy: [
    /功效倍增[：:\s]*(\d{1,3})/i,
    /效果增强[：:\s]*(\d{1,3})/i,
    /efficacy[^0-9]{0,10}(\d{1,3})/i,
    /功效提升[：:\s]*(\d{1,3})/i,
  ],
  safety: [
    /安全性[：:\s]*(\d{1,3})/i,
    /安全指数[：:\s]*(\d{1,3})/i,
    /safety[^0-9]{0,10}(\d{1,3})/i,
    /安全评分[：:\s]*(\d{1,3})/i,
  ],
  stability: [
    /稳定性[：:\s]*(\d{1,3})/i,
    /稳定改善[：:\s]*(\d{1,3})/i,
    /stability[^0-9]{0,10}(\d{1,3})/i,
    /稳定指数[：:\s]*(\d{1,3})/i,
  ],
  taste: [
    /口感[：:\s]*(\d{1,3})/i,
    /味道平衡[：:\s]*(\d{1,3})/i,
    /taste[^0-9]{0,10}(\d{1,3})/i,
    /风味平衡[：:\s]*(\d{1,3})/i,
  ],
}

const DIMENSION_LABELS: Record<string, string> = {
  synergy: '协同强度',
  bioavailability: '生物利用度',
  efficacy: '功效倍增',
  safety: '安全性',
  stability: '稳定性',
  taste: '口感平衡',
}

const XSS_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
const EVENT_HANDLER_PATTERN = /\bon\w+\s*=\s*["'][^"']*["']/gi
const HTML_TAG_PATTERN = /<(?!\/?(br|p|div|span|strong|em|ul|ol|li|table|thead|tbody|tr|th|td|h[1-6])\b)[^>]+>/gi

const MIN_INGREDIENTS_FOR_FORMULA = 2
const DEFAULT_MAX_LENGTH = 10000
const AMOUNT_MAX = 1000
const PERCENTAGE_MAX = 100

export function parseFormulaTable(text: string): FormulaTableData | null {
  if (!text || typeof text !== 'string') {
    logger.warn('[parseFormulaTable] ⚠️ 输入无效: text 不是有效的字符串', {
      textType: typeof text,
      textValue: text,
    })
    return null
  }

  const trimmedText = text.trim()
  if (trimmedText.length === 0) {
    logger.warn('[parseFormulaTable] ⚠️ 输入文本为空字符串')
    return null
  }

  let result: FormulaTableData | null = null

  try {
    result = tryParseMarkdownTable(trimmedText)
    if (result) {
      logger.log('[parseFormulaTable] ✅ 成功使用 Markdown 表格解析器解析配方')
      return result
    }
  } catch (error) {
    logger.error('[parseFormulaTable] ❌ Markdown 表格解析器异常:', {
      error: error instanceof Error ? error.message : error,
      textLength: trimmedText.length,
    })
  }

  try {
    const listResult = tryParseListFormat(trimmedText)
    if (listResult) {
      const finalResult = Array.isArray(listResult) ? (listResult[0] || null) : listResult
      logger.log('[parseFormulaTable] ✅ 成功使用列表格式解析器解析配方')
      return finalResult || null
    }
  } catch (error) {
    logger.error('[parseFormulaTable] ❌ 列表格式解析器异常:', {
      error: error instanceof Error ? error.message : error,
      textLength: trimmedText.length,
    })
  }

  try {
    result = tryParseNaturalLanguage(trimmedText)
    if (result) {
      logger.log('[parseFormulaTable] ✅ 成功使用自然语言解析器解析配方')
      return result
    }
  } catch (error) {
    logger.error('[parseFormulaTable] ❌ 自然语言解析器异常:', {
      error: error instanceof Error ? error.message : error,
      textLength: trimmedText.length,
    })
  }

  try {
    result = tryParseJSONFormat(trimmedText)
    if (result) {
      logger.log('[parseFormulaTable] ✅ 成功使用 JSON 格式解析器解析配方')
      return result
    }
  } catch (error) {
    logger.error('[parseFormulaTable] ❌ JSON 格式解析器异常:', {
      error: error instanceof Error ? error.message : error,
      textLength: trimmedText.length,
    })
  }

  logger.log('[parseFormulaTable] ℹ️ 所有解析器均未能成功解析文本为配方表格', {
    textLength: trimmedText.length,
    textPreview: trimmedText.substring(0, 100) + (trimmedText.length > 100 ? '...' : ''),
  })

  return null
}

function tryParseMarkdownTable(text: string): FormulaTableData | null {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return null
  }

  try {
    const tablePattern = /\|[^\n]+\|\n\|[-:\s|]+\|\n((?:\|[^\n]+\|\n?)+)/i
    const match = tablePattern.exec(text)
    if (!match?.[1]) return null

    const lines = match[1]
      .split('\n')
      .filter(line => line.trim().startsWith('|'))
      .map(line => line.replace(/^\||\|$/g, '').trim())

    if (lines.length < MIN_INGREDIENTS_FOR_FORMULA) {
      logger.log('[tryParseMarkdownTable] 行数不足，跳过 Markdown 表格解析', {
        linesCount: lines.length,
        minRequired: MIN_INGREDIENTS_FOR_FORMULA,
      })
      return null
    }

    const headerLine = /\|([^|\n]+)\|\n\|[-:\s|]+\|/i.exec(text)
    const headers = headerLine && headerLine[1]
      ? headerLine[1].split('|').map(h => h.trim().toLowerCase())
      : []

    const nameColIndex = findColumnIndex(headers, ['成分', '名称', '原料', 'ingredient', 'name', '药材'])
    const amountColIndex = findColumnIndex(headers, ['用量', '剂量', '数量', 'amount', 'dosage', '重量'])

    const ingredients: Ingredient[] = []

    for (const line of lines) {
      const cells = line.split('|').map(cell => cell.trim())
      if (cells.length < 2) continue

      const rawName = nameColIndex !== -1 ? cells[nameColIndex] : cells[0]
      const rawAmount = amountColIndex !== -1 ? cells[amountColIndex] : cells[1]

      if (!rawName || !rawAmount) continue

      const parsedName = rawName.replace(/[*#`]/g, '').trim()
      if (!parsedName) continue

      const amountMatch = /(\d+(?:\.\d+)?)\s*([g克mg千克%％]*)/.exec(rawAmount)
      if (!amountMatch) continue

      const amount = parseFloat(amountMatch[1] || '')
      const unit = normalizeUnit(amountMatch[2] || '')

      if (isNaN(amount) || amount <= 0 || amount > AMOUNT_MAX * 1000) continue

      ingredients.push({
        name: parsedName,
        amount,
        unit,
      })
    }

    if (ingredients.length < MIN_INGREDIENTS_FOR_FORMULA) {
      return null
    }

    return {
      ingredients,
      totalAmount: calculateTotalAmount(ingredients),
      confidence: calculateConfidence(ingredients, 'table'),
      formatType: 'table',
    }
  } catch (error) {
    logger.error('[tryParseMarkdownTable] ❌ Markdown 表格解析异常:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return null
  }
}

function tryParseListFormat(text: string): FormulaTableData | FormulaTableData[] | null {
  if (!text || typeof text !== 'string') {
    logger.warn('[tryParseListFormat] ⚠️ 输入无效: text 不是有效的字符串')
    return null
  }

  const trimmedText = text.trim()
  if (trimmedText.length === 0) {
    return null
  }

  try {
    const multiFormulaPattern = /(?:配方|方案|计划)[一二三四五六七八九十\d]+[：:\s]|(?:Formula|Plan|Scheme)\s*\d+[：:\s]/i
    const hasMultipleFormulas = multiFormulaPattern.test(trimmedText)

    if (hasMultipleFormulas) {
      logger.log('[tryParseListFormat] 检测到多配方格式，将尝试解析多个配方')
      return parseMultipleListFormulas(trimmedText)
    }

    return parseSingleListFormula(trimmedText)
  } catch (error) {
    logger.error('[tryParseListFormat] ❌ 列表格式解析异常:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      textLength: trimmedText.length,
    })
    return null
  }
}

function parseSingleListFormula(text: string): FormulaTableData | null {
  const listPatterns = [
    /^[-•*]\s*(.+?)[：:\s]+(\d+(?:\.\d+)?)\s*([g克mg千克%％]*)/gm,
    /^\d+[.、)]\s*(.+?)[：:\s]+(\d+(?:\.\d+)?)\s*([g克mg千克%％]*)/gm,
    /^(.+?)[：:]\s*(\d+(?:\.\d+)?)\s*([g克mg千克%％]*)$/gm,
  ]

  const ingredients: Ingredient[] = []
  const usedPatterns = new Set<string>()

  for (let patternIdx = 0; patternIdx < listPatterns.length; patternIdx++) {
    const pattern = listPatterns[patternIdx]
    if (!pattern) continue
    let match: RegExpExecArray | null

    while ((match = pattern.exec(text)) !== null) {
      const key = `${patternIdx}-${match.index}`
      if (usedPatterns.has(key)) continue
      usedPatterns.add(key)

      const name = match[1]?.replace(/^[-•*\s\d.、)]+/, '').trim()
      if (!name || name.length > 50) continue

      const amount = parseFloat(match[2] || '')
      if (isNaN(amount) || amount <= 0 || amount > AMOUNT_MAX * 1000) continue

      const unit = normalizeUnit(match[3] || '')
      ingredients.push({ name, amount, unit })
    }
  }

  if (ingredients.length >= MIN_INGREDIENTS_FOR_FORMULA) {
    return {
      ingredients,
      totalAmount: calculateTotalAmount(ingredients),
      confidence: calculateConfidence(ingredients, 'list'),
      formatType: 'list',
    }
  }

  return null
}

function parseMultipleListFormulas(text: string): FormulaTableData[] {
  const separatorPattern = /((?:配方|方案|计划)[一二三四五六七八九十\d]+[：:\s]|(?:Formula|Plan|Scheme)\s*\d+[：:\s])/gi
  const parts: { name: string; content: string }[] = []

  let lastIndex = 0
  let match: RegExpExecArray | null
  let formulaIndex = 0

  while ((match = separatorPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const prevContent = text.substring(lastIndex, match.index).trim()
      if (prevContent) {
        parts.push({
          name: formulaIndex === 0 ? `配方${formulaIndex + 1}` : `配方${formulaIndex}`,
          content: prevContent,
        })
        formulaIndex++
      }
    }

    const formulaName = match[1]?.replace(/[：:\s]+$/, '') || `配方${formulaIndex + 1}`
    const matchLength = match[0]?.length || 0
    lastIndex = match.index + matchLength
    parts.push({ name: formulaName, content: '' })
    formulaIndex++
  }

  if (lastIndex < text.length) {
    const remainingContent = text.substring(lastIndex).trim()
    if (remainingContent && parts.length > 0) {
      const lastPart = parts[parts.length - 1]
      if (lastPart) {
        lastPart.content += (lastPart.content ? '\n' : '') + remainingContent
      }
    } else if (remainingContent) {
      parts.push({ name: `配方${formulaIndex + 1}`, content: remainingContent })
    }
  }

  const results: FormulaTableData[] = []

  for (const part of parts) {
    if (!part.content) continue

    const result = parseSingleListFormula(part.content)
    if (result) {
      results.push({
        ...result,
        name: part.name,
      })
    }
  }

  return results
}

function tryParseNaturalLanguage(text: string): FormulaTableData | null {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return null
  }

  try {
    const patterns = [
      /([\u4e00-\u9fa5a-zA-Z]{2,15})\s*(\d+(?:\.\d+)?)\s*[g克]/g,
      /([\u4e00-\u9fa5a-zA-Z]{2,15})(\d+)\s*[g克]/g,
      /(?:用|取|加)\s*([\u4e00-\u9fa5a-zA-Z]{2,15})\s*(\d+(?:\.\d+)?)\s*[g克]/g,
    ]

    const ingredientSet = new Map<string, Ingredient>()

    for (const pattern of patterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1]?.trim()
        const amount = parseFloat(match[2] || '')

        if (!name || name.length > 20 || isNaN(amount) || amount <= 0 || amount > AMOUNT_MAX * 1000) continue

        const normalizedName = name.toLowerCase()
        if (!ingredientSet.has(normalizedName)) {
          ingredientSet.set(normalizedName, { name, amount, unit: 'g' })
        }
      }
    }

    const ingredients = Array.from(ingredientSet.values())

    if (ingredients.length >= MIN_INGREDIENTS_FOR_FORMULA) {
      return {
        ingredients,
        totalAmount: calculateTotalAmount(ingredients),
        confidence: calculateConfidence(ingredients, 'natural'),
        formatType: 'natural',
      }
    }

    return null
  } catch (error) {
    logger.error('[tryParseNaturalLanguage] ❌ 自然语言解析异常:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return null
  }
}

function tryParseJSONFormat(text: string): FormulaTableData | null {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return null
  }

  try {
    const jsonPatterns = [
      /\{[\s\S]*?"ingredients"[\s\S]*?\}/i,
      /\{[\s\S]*?"配方组成"[\s\S]*?\}/i,
      /\{[\s\S]*?"成分"[\s\S]*?\}/i,
    ]

    for (const pattern of jsonPatterns) {
      const match = text.match(pattern)
      if (!match) continue

      try {
        const parsed = JSON.parse(match[0])
        const ingredientsArray = extractIngredientsFromJSON(parsed)

        if (ingredientsArray.length >= MIN_INGREDIENTS_FOR_FORMULA) {
          return {
            name: parsed.name || parsed['配方名称'] || undefined,
            ingredients: ingredientsArray,
            totalAmount: calculateTotalAmount(ingredientsArray),
            description: parsed.description || parsed['描述'] || undefined,
            confidence: calculateConfidence(ingredientsArray, 'json'),
            formatType: 'json',
          }
        }
      } catch (jsonError) {
        logger.warn('[tryParseJSONFormat] ⚠️ JSON 解析失败，尝试下一个模式:', {
          error: jsonError instanceof Error ? jsonError.message : jsonError,
        })
        continue
      }
    }

    return null
  } catch (error) {
    logger.error('[tryParseJSONFormat] ❌ JSON 格式解析异常:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return null
  }
}

function extractIngredientsFromJSON(obj: any): Ingredient[] {
  if (!obj || typeof obj !== 'object') return []

  const ingredients: Ingredient[] = []

  const possibleKeys = ['ingredients', '配方组成', '成分', 'items', 'list']
  for (const key of possibleKeys) {
    const arr = obj[key]
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item !== 'object' || item === null) continue

        const name = item.name || item['名称'] || item.ingredient || item['成分']
        const amount = typeof item.amount === 'number'
          ? item.amount
          : parseFloat(item['用量'] || item.dosage || item.amount || '0')
        const unit = item.unit || item['单位'] || 'g'

        if (name && !isNaN(amount) && amount > 0) {
          ingredients.push({
            name: String(name),
            amount,
            unit: String(unit),
            percentage: item.percentage ?? item['百分比'],
          })
        }
      }
    }
  }

  return ingredients
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const index = headers.findIndex(h => h.includes(candidate))
    if (index !== -1) return index
  }
  return -1
}

function normalizeUnit(unit: string): string {
  const normalized = (unit || 'g').toLowerCase().trim()
  const unitMap: Record<string, string> = {
    '': 'g',
    'g': 'g',
    '克': 'g',
    'mg': 'mg',
    '毫克': 'mg',
    'kg': 'kg',
    '千克': 'kg',
    '%': '%',
    '％': '%',
  }
  return unitMap[normalized] || normalized
}

function calculateTotalAmount(ingredients: Ingredient[]): number | undefined {
  const gramIngredients = ingredients.filter(
    ing => ing.unit === 'g' && typeof ing.amount === 'number',
  )
  if (gramIngredients.length === 0) return undefined
  return gramIngredients.reduce((sum, ing) => sum + ing.amount, 0)
}

function calculateConfidence(ingredients: Ingredient[], formatType: string): number {
  if (!ingredients || ingredients.length === 0) return 0

  let score = 0.3

  if (ingredients.length >= 5) score += 0.3
  else if (ingredients.length >= 3) score += 0.2
  else if (ingredients.length >= 2) score += 0.1

  if (formatType === 'table') score += 0.3
  else if (formatType === 'json') score += 0.25
  else if (formatType === 'list') score += 0.2
  else if (formatType === 'natural') score += 0.15

  const validIngredients = ingredients.filter(ing =>
    ing.name && ing.amount && String(ing.amount).trim() !== '',
  )
  score += (validIngredients.length / ingredients.length) * 0.2

  return Math.min(Math.max(score, 0), 1)
}

export function parseSynergyData(text: string): SynergyRadarData[] | null {
  if (!text || typeof text !== 'string') return null

  const trimmedText = text.trim()
  if (trimmedText.length === 0) return null

  const results: SynergyRadarData[] = []

  for (const [dimensionKey, patterns] of Object.entries(SYNERGY_DIMENSION_PATTERNS)) {
    for (const pattern of patterns) {
      const match = trimmedText.match(pattern)
      if (match && match[1]) {
        let value = parseInt(match[1], 10)

        if (value > 100) value = Math.min(value, 999)
        value = Math.max(0, Math.min(value, 100))

        const dimensionLabel = DIMENSION_LABELS[dimensionKey] || dimensionKey
        results.push({
          dimension: dimensionLabel,
          value,
          fullMark: 100,
        })
        break
      }
    }
  }

  if (results.length < 3) return null

  return results
}

export function detectContentType(message: string): MessageType {
  if (!message || typeof message !== 'string') return MessageType.TEXT

  const trimmedMessage = message.trim()

  if (isFormulaTableContent(trimmedMessage)) return MessageType.FORMULA_TABLE

  if (isSynergyAnalysisContent(trimmedMessage)) return MessageType.RADAR_CHART

  if (isReportPreviewContent(trimmedMessage)) return MessageType.REPORT_PREVIEW

  return MessageType.TEXT
}

function isFormulaTableContent(text: string): boolean {
  const formulaIndicators = [
    /[\u4e00-\u9fa5a-zA-Z]{2,}\s*\d+\.?\d*\s*[g克mg]/,
    /[-•*]\s*.*?[：:]\s*\d+/,
    /\|.*\|.*\d+.*/m,
    /【?.*配.?方?.*】/,
    /成分?\s*[:：]/,
    /用量\s*[:：]/,
    /剂量\s*[:：]/,
  ]

  let matchCount = 0
  for (const pattern of formulaIndicators) {
    if (pattern.test(text)) matchCount++
  }

  const ingredientMatches = text.match(/[\u4e00-\u9fa5a-zA-Z]{2,}\s*\d+\.?\d*\s*[g克mg]/g)
  if (ingredientMatches && ingredientMatches.length >= MIN_INGREDIENTS_FOR_FORMULA) {
    return true
  }

  return matchCount >= 2
}

function isSynergyAnalysisContent(text: string): boolean {
  const synergyKeywords = [
    '协同', 'synergy', '雷达图', 'radar', '六维',
    '维度分析', '综合评估', '多维度',
  ]
  const hasSynergyKeyword = synergyKeywords.some(keyword => text.includes(keyword))

  if (!hasSynergyKeyword) return false

  let dimensionCount = 0
  for (const [, patterns] of Object.entries(SYNERGY_DIMENSION_PATTERNS)) {
    const hasDimension = patterns.some(pattern => pattern.test(text))
    if (hasDimension) dimensionCount++
  }

  return dimensionCount >= 3
}

function isReportPreviewContent(text: string): boolean {
  const reportKeywords = [
    '报告', 'report', '导出', 'export', '文档', 'document',
    'PDF', 'Word', 'Excel', '总结报告', '分析报告',
    '学术报告', '研究报告',
  ]

  const reportPatternKeywords = reportKeywords.filter(keyword =>
    new RegExp(keyword, 'i').test(text),
  )

  const hasStructureIndicators =
    /第[一二三四五六七八九十]+[章节部分]/.test(text) ||
    /\d+\.\s*[^\n]{10,}/.test(text.length > 200 ? text.substring(0, 200) : text)

  return reportPatternKeywords.length >= 2 ||
    (reportPatternKeywords.length >= 1 && hasStructureIndicators)
}

export function sanitizeInput(input: string, maxLength: number = DEFAULT_MAX_LENGTH): string {
  if (typeof input !== 'string') return ''

  let sanitized = input

  sanitized = sanitized.replace(XSS_PATTERN, '')
  sanitized = sanitized.replace(EVENT_HANDLER_PATTERN, '')
  sanitized = sanitized.replace(HTML_TAG_PATTERN, '')

  sanitized = sanitized.replace(/\t/g, ' ')
  sanitized = sanitized.replace(/[ ]{2,}/g, ' ')
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n')

  sanitized = sanitized.trim()

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength).trim() + '...'
  }

  return sanitized
}

export function validateIngredient(ingredient: Partial<Ingredient>): boolean {
  if (!ingredient || typeof ingredient !== 'object') return false

  const errors: string[] = []

  if (!ingredient.name || typeof ingredient.name !== 'string' || ingredient.name.trim().length === 0) {
    errors.push('name is required and must be a non-empty string')
  } else if (ingredient.name.trim().length > 50) {
    errors.push('name must be 50 characters or less')
  }

  if (ingredient.amount === undefined || ingredient.amount === null) {
    errors.push('amount is required')
  } else if (typeof ingredient.amount !== 'number' || isNaN(ingredient.amount)) {
    errors.push('amount must be a valid number')
  } else if (ingredient.amount <= 0) {
    errors.push('amount must be greater than 0')
  } else if (ingredient.amount > AMOUNT_MAX) {
    errors.push(`amount must not exceed ${AMOUNT_MAX}`)
  }

  if (ingredient.percentage !== undefined && ingredient.percentage !== null) {
    if (typeof ingredient.percentage !== 'number' || isNaN(ingredient.percentage)) {
      errors.push('percentage must be a valid number')
    } else if (ingredient.percentage < 0 || ingredient.percentage > PERCENTAGE_MAX) {
      errors.push(`percentage must be between 0 and ${PERCENTAGE_MAX}`)
    }
  }

  if (ingredient.unit !== undefined && ingredient.unit !== null) {
    if (typeof ingredient.unit !== 'string') {
      errors.push('unit must be a string')
    } else {
      const validUnits = ['g', 'mg', 'kg', 'ml', 'l', '%', '克', '毫克', '千克']
      if (!validUnits.includes(ingredient.unit.toLowerCase())) {
        errors.push(`unit must be one of: ${validUnits.join(', ')}`)
      }
    }
  }

  return errors.length === 0
}

/**
 * 生成配方唯一标识符
 * 基于配方名称的哈希值和时间戳组合，确保ID的唯一性和可追溯性
 *
 * @param name - 配方名称（用于生成哈希值）
 * @param timestamp - 可选的时间戳（默认使用当前时间）
 * @returns 唯一的配方ID字符串，格式为 "FMT-{hash}-{timestamp}"
 *
 * @example
 * ```ts
 * // 使用当前时间
 * const id1 = generateFormulaId('气血双补配方')
 * // 输出类似: 'FMT-1a2b3c-xyz123'
 *
 * // 指定时间戳
 * const id2 = generateFormulaId('抗氧化配方', new Date('2026-01-01'))
 * ```
 */
let lastAutoTime = ''
let autoCounter = 0

export function generateFormulaId(name: string, timestamp?: Date): string {
  const time = timestamp || new Date()
  const timeStr = time.getTime().toString(36)

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }

  // 显式传入时间戳时保持确定性（同一 name + timestamp 生成相同 ID，供测试与可复现场景使用）
  if (timestamp) {
    return `FMT-${hash.toString(36)}-${timeStr}`
  }

  // 未指定时间戳（真实解析场景）时，同一毫秒内追加自增序号，
  // 避免同名（如空名）配方在同一毫秒内解析产生重复 ID。
  if (timeStr === lastAutoTime) {
    autoCounter += 1
  } else {
    lastAutoTime = timeStr
    autoCounter = 0
  }

  return `FMT-${hash.toString(36)}-${timeStr}${autoCounter > 0 ? `x${autoCounter}` : ''}`
}

export interface ParsedFormula {
  id: string
  name: string
  ingredientCount: number
  confidence: number
  sourceMessageId: string
  parsedAt: Date
  rawData: FormulaTableData
  ingredients: Ingredient[]
}

export function extractAllFormulas(text: string, messageId = ''): ParsedFormula[] {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return []
  }

  const trimmedText = text.trim()

  if (trimmedText.length === 0) {
    return []
  }

  const MAX_TEXT_LENGTH = 10000

  if (trimmedText.length > MAX_TEXT_LENGTH) {
    logger.warn(`[extractAllFormulas] ⚠️ 输入文本过长 (${trimmedText.length} 字符), 将进行分块处理以提高性能`, {
      messageId,
      textLength: trimmedText.length,
      maxLength: MAX_TEXT_LENGTH,
    })
  }

  const allFormulas: ParsedFormula[] = []
  const seenNames = new Set<string>()

  const parsers = [
    { name: 'table', fn: tryParseMarkdownTable },
    { name: 'list', fn: tryParseListFormat },
    { name: 'json', fn: tryParseJSONFormat },
    { name: 'natural', fn: tryParseNaturalLanguage },
  ]

  for (const parser of parsers) {
    try {
      const result = parser.fn(trimmedText)

      if (result) {
        const formulas = Array.isArray(result) ? result : [result]

        for (const formula of formulas) {
          if (!formula?.ingredients || !Array.isArray(formula.ingredients) || formula.ingredients.length === 0) {
            logger.warn(`[extractAllFormulas] ${parser.name} 解析器返回了无效的配方对象`, {
              messageId,
              parserName: parser.name,
              formula,
            })
            continue
          }

          const formulaName = formula.name || ''

          if (!seenNames.has(formulaName) && (formulaName || formula.ingredients?.length > 0)) {
            seenNames.add(formulaName)

            const parsedFormula: ParsedFormula = {
              id: generateFormulaId(formulaName),
              name: formulaName,
              ingredientCount: formula.ingredients.length,
              confidence: formula.confidence || 0.5,
              sourceMessageId: messageId,
              parsedAt: new Date(),
              rawData: formula,
              ingredients: formula.ingredients,
            }

            if (!parsedFormula.id || parsedFormula.ingredientCount <= 0) {
              logger.warn(`[extractAllFormulas] 生成的配方对象缺少必需字段`, {
                messageId,
                formulaId: parsedFormula.id,
                formulaName: parsedFormula.name,
                ingredientCount: parsedFormula.ingredientCount,
              })
              continue
            }

            allFormulas.push(parsedFormula)
          }
        }
      }
    } catch (error) {
      logger.error(`[extractAllFormulas] ❌ ${parser.name} 解析器发生异常:`, {
        messageId,
        parserName: parser.name,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      })
    }
  }

  logger.log(`[extractAllFormulas] ✅ 解析完成`, {
    messageId,
    totalFormulasFound: allFormulas.length,
    parsersAttempted: parsers.length,
  })

  return allFormulas
}
