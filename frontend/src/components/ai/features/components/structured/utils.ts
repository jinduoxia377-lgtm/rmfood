/**
 * Structured Content Block Renderer — 工具函数
 */
import type { StructuredContent, BlockType } from './types'

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
    console.warn('[detectStructured] empty content')
    return null
  }
  const trimmed = content.trim()
  console.log(`[detectStructured] content length=${trimmed.length}, starts="${trimmed[0]}", ends="${trimmed[trimmed.length-1]}"`)

  // 快速短路 — 纯文本消息不尝试解析
  if (trimmed.length < 10) {
    console.log('[detectStructured] too short, returning null')
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

  console.log(`[detectStructured] strategy=${strategy}, jsonStr.length=${jsonStr ? jsonStr.length : 0}, first100="${jsonStr ? jsonStr.substring(0, 100) : 'null'}"`)

  if (!jsonStr) {
    console.warn('[detectStructured] no json found, returning null')
    return null
  }

  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>
    console.log(`[detectStructured] JSON parse OK, keys=${Object.keys(parsed).join(',')}, blocks=${Array.isArray(parsed.blocks) ? parsed.blocks.length : 'N/A'}`)

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
  if (trimmed.length < 10 || !trimmed.includes('"blocks"')) return null

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
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.blocks)) return null

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

    // 复用现有归一化，保证渲染层读取一致
    const normalizedBlocks = blocks.map((block) => {
      const n = normalizeCallout(block as { type: string; data: unknown })
      return normalizeList(n)
    })

    return {
      responseType: (parsed.responseType as StructuredContent['responseType']) ?? 'recommendation',
      title: (parsed.title as string) || undefined,
      blocks: normalizedBlocks as any,
    }
  } catch {
    return null
  }
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
