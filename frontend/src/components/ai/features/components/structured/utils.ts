/**
 * Structured Content Block Renderer — 工具函数
 */
import type { StructuredContent, BlockType } from './types'
import { logger } from '@/utils/safeLogger'

/**
 * 规范化 CalloutData：兼容 style（LLM 常用）→ variant（类型定义）字段映射
 */
function normalizeCallout(block: { type: string; data: unknown }): { type: string; data: unknown } {
  const data = (block.data as Record<string, unknown>) || {}
  if (block.type === 'callout') {
    // LLM 可能输出 style 而非 variant
    if (data.style && !data.variant) {
      data.variant = data.style as string
    }
    // 确保 style 字段也保留（渲染层读取）
    if (data.variant && !data.style) {
      data.style = data.variant as string
    }
    return { ...block, data }
  }
  return block
}

/**
 * 规范化 ListItem：兼容平铺字符串数组 → 结构化 ListItem 对象
 */
function normalizeList(block: { type: string; data: unknown }): { type: string; data: unknown } {
  const data = (block.data as Record<string, unknown>) || {}
  if (block.type === 'list') {
    // LLM 可能直接输出字符串数组而非 ListItem[]
    if (Array.isArray(data.items) && data.items.length > 0 && typeof data.items[0] === 'string') {
      data.items = (data.items as string[]).map(text => ({ label: text }))
    }
    // 若无 variant，根据内容推断
    if (!data.variant) {
      const items = data.items as Array<{ label?: string; description?: string } | string>
      const hasDescriptions = items.some(item => {
        if (typeof item === 'string') return false
        return !!item.description
      })
      data.variant = hasDescriptions ? 'analysis' : 'bullet'
    }
    return { ...block, data }
  }
  return block
}

/**
 * 检测消息内容是否为结构化JSON
 *
 * 支持两种格式：
 * 1. 纯JSON：以 { 开头的内容
 * 2. Markdown代码块中的JSON：```json ... ```
 *
 * 在解析后对 block 数据做归一化处理，兼容 LLM 常见变体。
 *
 * @param content 消息内容字符串
 * @returns 解析成功返回 StructuredContent, 失败返回 null
 */
export function detectStructuredContent(content: string): StructuredContent | null {
  if (!content) {
    logger.warn('[detectStructured] empty content')
    return null
  }
  const trimmed = content.trim()
  logger.debug(`[detectStructured] content length=${trimmed.length}, starts="${trimmed[0]}", ends="${trimmed[trimmed.length - 1]}"`)

  // 快速短路 — 纯文本消息不尝试解析
  if (trimmed.length < 10) {
    logger.debug('[detectStructured] too short (<10), returning null')
    return null
  }

  let jsonStr: string | null = null
  let strategy = 'none'

  // ── 策略1: 从 ```json ... ``` 代码块中提取（处理嵌套大括号）──
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    const candidate = codeBlockMatch[1].trim()
    const lastBrace = candidate.lastIndexOf('}')
    if (lastBrace >= 0 && candidate.startsWith('{') && candidate[lastBrace] === '}') {
      jsonStr = candidate.slice(0, lastBrace + 1)
      strategy = 'code-block'
    }
  }

  // ── 策略2: 内容以 { 开头 → 找最后一个匹配的 } ──
  if (!jsonStr && trimmed[0] === '{') {
    const lastBrace = trimmed.lastIndexOf('}')
    if (lastBrace > 0) {
      jsonStr = trimmed.slice(0, lastBrace + 1)
      strategy = 'starts-brace'
    }
  }

  // ── 策略3: 全文就是一段JSON（无代码块包裹）──
  if (!jsonStr && trimmed.startsWith('{') && trimmed.endsWith('}')) {
    jsonStr = trimmed
    strategy = 'full-text'
  }

  // ── 策略4: 扫描内容中第一个 { 到最后一个 } 的区间 ──
  if (!jsonStr) {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = trimmed.slice(firstBrace, lastBrace + 1)
      strategy = 'scan-braces'
    }
  }

  logger.debug(`[detectStructured] strategy=${strategy}, jsonStr.length=${jsonStr ? jsonStr.length : 0}`)

  if (!jsonStr) {
    logger.debug('[detectStructured] no JSON found, returning null')
    return null
  }

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>
    logger.debug(`[detectStructured] JSON parse OK, keys=${Object.keys(parsed).join(',')}, blocks=${Array.isArray(parsed.blocks) ? parsed.blocks.length : 0}`)

    // 验证核心结构
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.blocks)) return null

    // 验证每个 block 都有 type 字段
    const validTypes = new Set<BlockType>([
      'header', 'data-table', 'chart', 'list',
      'callout', 'metrics', 'divider',
      'ingredient-detail', 'synergy-chart', 'timeline',
    ])

    for (const block of parsed.blocks) {
      if (!block || typeof block !== 'object') return null
      if (!block.type || typeof block.type !== 'string') return null
      if (!validTypes.has(block.type as BlockType)) return null
    }

    // ── 归一化：兼容 LLM 常见字段变体 ──
    const normalizedBlocks = parsed.blocks.map((block: { type: string; data: unknown }) => {
      const n = normalizeCallout(block)
      return normalizeList(n)
    })

    // 兼容 LLM 未输出 responseType 的情况，自动补全默认值
    const structured: StructuredContent = {
      responseType: (parsed.responseType as StructuredContent['responseType']) ?? 'general',
      title: (parsed.title as string) || undefined,
      blocks: normalizedBlocks as any,
    }
    return structured
  } catch {
    // JSON 解析失败 → 不是结构化内容
    return null
  }
}

/**
 * 兜底提取结构化 JSON（当 detectStructuredContent 因格式差异返回 null 时使用）。
 *
 * 与 detectStructuredContent 的区别：
 * - 不要求 JSON 位于内容最开头（允许前后有少量说明文字）；
 * - 对 block type 做「白名单过滤」而非「整体拒绝」——未知类型块被丢弃，
 *   只要剩余合法块非空就返回结构化内容，避免在对话中裸显示 JSON。
 */
export function extractStructuredFallback(content: string): StructuredContent | null {
  if (!content) return null
  const trimmed = content.trim()
  if (trimmed.length < 10) return null

  let jsonStr: string | null = null
  // 1) ```json 代码块
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n([\s\S]*?)\n?\s*```/)
  if (codeBlockMatch) {
    const candidate = codeBlockMatch[1].trim()
    const lastBrace = candidate.lastIndexOf('}')
    if (lastBrace >= 0 && candidate.startsWith('{')) {
      jsonStr = candidate.slice(0, lastBrace + 1)
    }
  }
  // 2) 扫描第一个 { 到最后一个 }
  if (!jsonStr) {
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = trimmed.slice(firstBrace, lastBrace + 1)
    }
  }
  if (!jsonStr) return null

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null

    // 情况 A：标准 blocks 协议
    if (Array.isArray(parsed.blocks)) {
      const validTypes = new Set<BlockType>([
        'header', 'data-table', 'chart', 'list',
        'callout', 'metrics', 'divider',
        'ingredient-detail', 'synergy-chart', 'timeline',
      ])
      const blocks = (parsed.blocks as Array<Record<string, unknown>>).filter(
        (b): b is Record<string, unknown> & { type: BlockType; data: unknown } =>
          !!b && typeof b === 'object' && typeof b.type === 'string' && validTypes.has(b.type as BlockType),
      )
      if (blocks.length === 0) return null

      const normalizedBlocks = blocks.map((block) => {
        const n = normalizeCallout(block as { type: string; data: unknown })
        return normalizeList(n)
      })

      return {
        responseType: (parsed.responseType as StructuredContent['responseType']) ?? 'recommendation',
        title: (parsed.title as string) || undefined,
        blocks: normalizedBlocks as any,
      }
    }

    // 情况 B：LLM 输出旧格式配方 JSON（配方名称/配方组分/成分列表…）→ 转换为专业配方卡 blocks
    const legacyBlocks = convertLegacyFormulaBlocks(parsed)
    if (legacyBlocks) {
      return {
        responseType: 'recommendation',
        title: (parsed['配方名称'] || parsed['product_name'] || parsed['name']) as string | undefined,
        blocks: legacyBlocks,
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * 将 LLM 偶尔输出的「旧格式配方 JSON」转换为专业配方设计卡 blocks。
 * 兼容中文键（配方名称/配方组分…）与英文键（product_name/ingredients…）两种变体，
 * 避免前端裸显示 JSON。
 */
function convertLegacyFormulaBlocks(parsed: Record<string, unknown>): Array<{ type: BlockType; data: unknown }> | null {
  // 中文键 + 英文键（LLM 常见变体，尽量宽匹配）
  const name = (parsed['配方名称'] || parsed['product_name'] || parsed['name'] || parsed['方案名称']) as string | undefined
  const audience = (parsed['适用人群'] || parsed['target_audience'] || parsed['适合人群']) as string | undefined
  const goals = (parsed['健康目标'] || parsed['target_health_goals']) as Array<string> | undefined
  const efficacy =
    (parsed['核心功效'] || parsed['核心目标'] || parsed['核心原理'] || parsed['formula_rationale'] || parsed['efficacy'] || parsed['description'] || parsed['作用原理']) as string | undefined
  const ingredientsRaw =
    parsed['配方组分'] || parsed['主配方_单人份_500ml水'] || parsed['主配方'] || parsed['配料表'] || parsed['配方成分'] ||
    parsed['成分列表'] || parsed['成分'] || parsed['原料组成'] || parsed['材料'] || parsed['用料表'] || parsed['组分列表'] ||
    parsed['ingredients'] || parsed['components'] || parsed['composition'] || parsed['raw_materials'] || parsed['herbal_components']
  const steps =
    (parsed['制备建议'] || parsed['制备工艺'] || parsed['制备方法'] || parsed['做法'] || parsed['preparation_instructions'] || parsed['preparation'] || parsed['usage']) as string | undefined
  const taboosRaw =
    parsed['安全与禁忌'] || parsed['禁忌排除说明'] || parsed['注意事项与禁忌'] || parsed['注意事项'] || parsed['禁忌'] ||
    parsed['contraindications_and_warnings'] || parsed['contraindications'] || parsed['taboos'] || parsed['warnings']
  const compliance =
    (parsed['合规说明'] || parsed['安全依据'] || parsed['regulatory_compliance'] || parsed['compliance'] || parsed['safety_basis']) as string | undefined
  const specialGroups = (parsed['特殊人群提示'] || parsed['特殊人群']) as string | undefined
  const dailyCheck = (parsed['每日用量上限校验'] || parsed['每日用量'] || parsed['用量限制']) as string | undefined
  const conflicts = parsed['冲突说明'] as string | Array<string> | undefined

  if (!name && !ingredientsRaw) return null

  const blocks: Array<{ type: BlockType; data: unknown }> = []
  const meta: Array<{ label: string; value: string }> = []
  if (audience) meta.push({ label: '适用人群', value: audience })
  if (Array.isArray(goals) && goals.length > 0) meta.push({ label: '健康目标', value: goals.join('、') })
  if (name || efficacy || meta.length > 0) {
    blocks.push({
      type: 'header',
      data: {
        title: name || '配方方案',
        description: efficacy || '',
        level: 1,
        metadata: meta,
      },
    })
  }

  // 配方组成：兼容数组（[{原料,用量}]）与字符串（多行文本）两种形态
  const tableRows = parseIngredientRows(ingredientsRaw)
  if (tableRows.length > 0) {
    // 优先展示专业六列（角色/成分/用量/性味归经/功效成分/作用机理），旧格式缺失的字段留空
    const hasProfessionalFields = tableRows.some(r => r.nature_flavor || r.active_compound || r.mechanism)
    blocks.push({
      type: 'data-table',
      data: {
        title: '配方组成',
        columns: hasProfessionalFields
          ? [
              { key: 'role', label: '角色' },
              { key: 'name', label: '成分' },
              { key: 'dosage', label: '用量' },
              { key: 'nature_flavor', label: '性味归经' },
              { key: 'active_compound', label: '功效成分' },
              { key: 'mechanism', label: '作用机理' },
            ]
          : [
              { key: 'role', label: '角色' },
              { key: 'name', label: '成分' },
              { key: 'dosage', label: '用量' },
            ],
        rows: tableRows,
      },
    })
  }
  if (typeof steps === 'string' && steps.trim()) {
    blocks.push({
      type: 'list',
      data: { title: '制备建议', variant: 'number', items: steps.split(/[；;\n]/).map(s => ({ label: s.trim() })).filter(i => i.label) },
    })
  }
  if (Array.isArray(taboosRaw) && taboosRaw.length > 0) {
    blocks.push({
      type: 'callout',
      data: { variant: 'warning', title: '安全与禁忌', content: taboosRaw.join('；') },
    })
  }
  if (typeof taboosRaw === 'string' && taboosRaw.trim()) {
    blocks.push({
      type: 'callout',
      data: { variant: 'warning', title: '安全与禁忌', content: taboosRaw },
    })
  }
  if (typeof specialGroups === 'string' && specialGroups.trim()) {
    blocks.push({
      type: 'callout',
      data: { variant: 'warning', title: '特殊人群提示', content: specialGroups },
    })
  }
  if (typeof dailyCheck === 'string' && dailyCheck.trim()) {
    blocks.push({
      type: 'callout',
      data: { variant: 'info', title: '每日用量上限校验', content: dailyCheck },
    })
  }
  if (typeof compliance === 'string' && compliance.trim()) {
    blocks.push({
      type: 'callout',
      data: { variant: 'info', title: '合规说明', content: compliance },
    })
  }
  return blocks.length > 0 ? blocks : null
}

/** 解析配方组成：数组（对象）或字符串（多行「原料 用量」）→ data-table rows */
function parseIngredientRows(raw: unknown): Array<Record<string, string>> {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item: Record<string, unknown>) => ({
        role: String(item['角色'] || item['role'] || item['君臣佐使'] || ''),
        name: String(item['原料'] || item['成分'] || item['name'] || item['ingredient'] || item['材料'] || ''),
        dosage: String(item['剂量'] || item['用量'] || item['dosage'] || item['amount'] || ''),
        nature_flavor: String(item['性味归经'] || item['nature_flavor'] || item['性味'] || ''),
        active_compound: String(item['功效成分'] || item['active_compound'] || item['活性成分'] || ''),
        mechanism: String(item['作用机理'] || item['mechanism'] || item['机理'] || item['药理'] || ''),
        basis: String(item['依据'] || item['basis'] || item['rationale'] || item['说明'] || ''),
      }))
      .filter(r => r.name)
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[\n;；]/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        // 支持「黄芪 10g」「黄芪：10g」「黄芪10g」等形态
        const m = line.match(/^([^：:\s]+)\s*[：:]\s*(.+)$/) || line.match(/^([^\s]+)\s*(.+)$/) || line.match(/^([\u4e00-\u9fa5A-Za-z]+)([\d.]+[gG克毫升mlML]*)$/)
        if (m) {
          return { role: '', name: m[1].trim(), dosage: (m[2] || '').trim(), nature_flavor: '', active_compound: '', mechanism: '', basis: '' }
        }
        return { role: '', name: line, dosage: '', nature_flavor: '', active_compound: '', mechanism: '', basis: '' }
      })
      .filter(r => r.name)
  }
  return []
}

/**
 * 安全获取 block 数据，避免空指针
 */
export function safeBlockData<T>(data: T | undefined | null, fallback: T): T {
  return data ?? fallback
}

/**
 * 格式化数值为百分比字符串
 */
export function formatPercent(value: number, decimals = 0): string {
  return (value * 100).toFixed(decimals) + '%'
}
