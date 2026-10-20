/**
 * formulaExtractorService — 从结构化聊天内容提取配方数据
 *
 * 功能：
 * 1. 从 StructuredContent JSON 中提取配方信息
 * 2. 从 Markdown 文本中解析表格数据
 * 3. 构建完整的 FormulaCandidate 对象
 *
 * 用法：
 * ```ts
 * const formula = extractFormulaFromContent(structuredContent)
 * if (formula) {
 *   await saveFormula(formula)
 * }
 * ```
 */
import { logger } from '@/utils/safeLogger'
import type { StructuredContent } from '../components/structured/types'
import type { AIRecognizedFormula } from '@/types/ai.types'

/** 从 content-block 中提取的配方成分 */
export interface ExtractedIngredient {
  name: string
  dosage: string
  function: string
  role?: '君' | '臣' | '佐' | '使'
}

/** 从结构化内容提取的完整配方 */
export interface ExtractedFormula {
  name: string
  description: string
  ingredients: ExtractedIngredient[]
  /** 多维评分数据 */
  scores?: Record<string, number>
  /** 配伍思路 */
  rationale?: string
  /** 注意事项 */
  precautions?: string[]
  /** 生产工艺 */
  productionSteps?: string[]
  /** 预期功效 */
  expectedEffects?: string[]
  /** 服用建议 */
  dosageAdvice?: string
  /** 来源 block 的原始数据 */
  rawContent?: StructuredContent
}

/**
 * 从 StructuredContent 中提取配方
 *
 * 提取策略：
 * 1. header block → 配方名称 + 描述
 * 2. data-table block → 成分列表
 * 3. metrics block → 多维评分
 * 4. callout blocks → 配伍思路/注意事项/功效
 * 5. list block → 生产工艺步骤
 */
export function extractFormulaFromContent(content: StructuredContent): ExtractedFormula | null {
  if (!content || !Array.isArray(content.blocks) || content.blocks.length === 0) {
    return null
  }

  const formula: ExtractedFormula = {
    name: '',
    description: '',
    ingredients: [],
    scores: {},
    rationale: '',
    precautions: [],
    productionSteps: [],
    expectedEffects: [],
    dosageAdvice: '',
    rawContent: content,
  }

  for (const block of content.blocks) {
    switch (block.type) {
      case 'header': {
        const h = block.data as { title?: string; description?: string }
        if (h.title) formula.name = h.title.replace(/^[🧪💊🍵🥤]?\s*/u, '')
        if (h.description) formula.description = h.description
        break
      }

      case 'data-table': {
        const dt = block.data as {
          columns?: Array<{ key: string; label: string }>
          rows?: Array<Record<string, unknown>>
        }
        if (dt.columns && dt.rows) {
          const nameKey = dt.columns.find(c => c.key === 'name')?.key || 'name'
          const dosageKey = dt.columns.find(c => c.key === 'dosage')?.key || 'dosage'
          const funcKey = dt.columns.find(c => c.key === 'function')?.key || 'function'
          const roleKey = dt.columns.find(c => c.key === 'role')?.key || 'role'

          formula.ingredients = dt.rows
            .filter(row => row[nameKey])
            .map(row => ({
              name: String(row[nameKey] ?? ''),
              dosage: String(row[dosageKey] ?? ''),
              function: String(row[funcKey] ?? ''),
              role: row[roleKey] as ExtractedIngredient['role'],
            }))
        }
        break
      }

      case 'metrics': {
        const m = block.data as { items?: Array<{ label: string; value: number }> }
        if (m.items) {
          formula.scores = Object.fromEntries(
            m.items.map(i => [i.label, typeof i.value === 'number' ? i.value : parseFloat(String(i.value)) || 0])
          )
        }
        break
      }

      case 'callout': {
        const c = block.data as { variant?: string; title?: string; content?: string }
        if (!c.content) break
        const lowerTitle = (c.title || '').toLowerCase()
        const lowerVariant = (c.variant || '').toLowerCase()

        if (lowerTitle.includes('配伍') || lowerTitle.includes('思路')) {
          formula.rationale = c.content
        } else if (lowerTitle.includes('注意') || lowerVariant === 'warning') {
          // 解析注意事项为数组
          const lines = c.content.split(/(?=\d+[.、])/).filter(s => s.trim())
          formula.precautions = lines.map(l => l.trim()).filter(Boolean)
        } else if (lowerTitle.includes('预期') || lowerTitle.includes('功效')) {
          const lines = c.content.split(/[；;。]/).filter(s => s.trim().length > 5)
          formula.expectedEffects = lines.map(l => l.trim()).filter(Boolean)
        } else if (lowerTitle.includes('总结') || lowerVariant === 'summary') {
          // 保存为备选描述
          if (!formula.description) formula.description = c.content
        }
        break
      }

      case 'list': {
        const l = block.data as { variant?: string; items?: Array<{ label: string; description?: string }> }
        if (l.items && l.items.length > 0) {
          const firstLabel = l.items[0].label
          if (firstLabel.includes('原料') || firstLabel.includes('水处理') || firstLabel.includes('溶解')) {
            // 生产工艺
            formula.productionSteps = l.items.map(i => `${i.label}${i.description ? '：' + i.description : ''}`)
          }
        }
        break
      }
    }
  }

  // 如果未从 data-table 提取到成分，尝试从 ingredients detail blocks 提取
  if (formula.ingredients.length === 0) {
    for (const block of content.blocks) {
      if (block.type === 'ingredient-detail') {
        const d = block.data as { name?: string; dosage_range?: string; efficacy?: string }
        if (d.name) {
          formula.ingredients.push({
            name: d.name,
            dosage: d.dosage_range || '',
            function: d.efficacy || '',
          })
        }
      }
    }
  }

  // 基本验证
  if (!formula.name && formula.ingredients.length === 0) {
    logger.warn('[formulaExtractor] 未能从内容中提取有效配方:', content)
    return null
  }

  logger.info('[formulaExtractor] 提取配方成功:', {
    name: formula.name,
    ingredientCount: formula.ingredients.length,
  })

  return formula
}

/**
 * 从 Markdown 文本中解析配方表格
 * 兼容旧版 Markdown 格式输出
 */
export function extractFormulaFromMarkdown(text: string): ExtractedFormula | null {
  const formula: ExtractedFormula = {
    name: '',
    description: '',
    ingredients: [],
    scores: {},
    rationale: '',
    precautions: [],
    productionSteps: [],
    expectedEffects: [],
    dosageAdvice: '',
  }

  // 提取配方名称（标题行）
  const titleMatch = text.match(/^#\s+(.+)$/m)
  if (titleMatch) {
    formula.name = titleMatch[1].replace(/^[🧪💊🍵🥤]?\s*/u, '').trim()
  }

  // 解析表格
  const tableLines = text.match(/\|(.+)\|[\s\S]*?\|(?:[-:| ]+)\|([\s\S]*?)(?=\n\s*\|.*?:|$)/)
  if (tableLines) {
    const rows = tableLines[2].split('\n').filter(l => l.trim().startsWith('|'))
    for (const row of rows) {
      const cells = row.split('|').filter(c => c.trim())
      if (cells.length >= 3) {
        formula.ingredients.push({
          name: cells[0]?.trim() || '',
          dosage: cells[1]?.trim() || '',
          function: cells[2]?.trim() || '',
        })
      }
    }
  }

  // 提取注意事项
  const warningMatch = text.match(/####\s*注意事项[\s\S]*?(?=####|$)/)
  if (warningMatch) {
    const lines = warningMatch[0].split('\n').filter(l => l.trim().startsWith('-') || l.trim().match(/^\d+\./))
    formula.precautions = lines.map(l => l.replace(/^[-\d.]+\s*/, '').trim()).filter(Boolean)
  }

  return formula.ingredients.length > 0 ? formula : null
}

/**
 * 将提取的配方转换为 AIRecognizedFormula 格式
 * 以便直接保存到 formulaIndex
 */
export function toAIRecognizedFormula(extracted: ExtractedFormula): AIRecognizedFormula {
  return {
    id: '',
    name: extracted.name || '未命名配方',
    ingredientCount: extracted.ingredients.length,
    confidence: extracted.ingredients.length > 0 ? 0.9 : 0.5,
    sourceMessageId: '',
    parsedAt: new Date(),
    rawData: {} as any,
    ingredients: extracted.ingredients.map(i => ({
      name: i.name,
      dosage: i.dosage,
      role: i.role,
    })),
  }
}

/**
 * 生成配方的唯一 ID
 */
export function generateFormulaId(name: string, timestamp: number = Date.now()): string {
  const slug = name
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '-')
    .slice(0, 20)
    .toLowerCase()
  return `formula_${slug}_${timestamp}`
}
