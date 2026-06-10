/**
 * Structured Content Block Renderer — 工具函数
 */
import type { StructuredContent, BlockType } from './types'

/**
 * 检测消息内容是否为结构化JSON
 *
 * 支持两种格式：
 * 1. 纯JSON：以 { 开头的内容
 * 2. Markdown代码块中的JSON：```json ... ```
 *
 * @param content 消息内容字符串
 * @returns 解析成功返回 StructuredContent, 失败返回 null
 */
export function detectStructuredContent(content: string): StructuredContent | null {
  if (!content) return null
  let trimmed = content.trim()

  // 快速短路 — 纯文本消息不尝试解析
  if (trimmed.length < 10) return null

  // 尝试从 ```json 代码块中提取JSON
  const jsonBlockMatch = trimmed.match(/```(?:json)?\s*\n?({[\s\S]*?})\n?\s*```/)
  if (jsonBlockMatch) {
    trimmed = jsonBlockMatch[1].trim()
  }

  // 必须以 { 开头
  if (trimmed[0] !== '{') return null

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>

    // 验证核心结构
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.blocks)) return null

    // 验证每个 block 都有 type 字段
    const validTypes = new Set<BlockType>([
      'header', 'data-table', 'chart', 'list',
      'callout', 'metrics', 'divider',
    ])

    for (const block of parsed.blocks) {
      if (!block || typeof block !== 'object') return null
      if (!block.type || typeof block.type !== 'string') return null
      if (!validTypes.has(block.type as BlockType)) return null
    }

    return parsed as unknown as StructuredContent
  } catch {
    // JSON 解析失败 → 不是结构化内容
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
