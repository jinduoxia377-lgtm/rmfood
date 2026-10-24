/**
 * extractStructuredFallback 结构化渲染兜底测试（task-20）
 *
 * 覆盖：
 * - ```json 代码块包裹的 blocks JSON → 成功提取
 * - 无代码块但有前后说明文字的 JSON → 扫描提取成功
 * - 未知 block type 被过滤，仅保留合法块
 * - 非 JSON / 无 blocks → null
 */
import { describe, it, expect } from 'vitest'
import { extractStructuredFallback } from '@/components/ai/features/components/structured/utils'

const validBlocksJson = JSON.stringify({
  responseType: 'recommendation',
  title: '测试配方',
  blocks: [
    { type: 'header', data: { title: '测试配方', level: 1 } },
    { type: 'data-table', data: { title: '配方组成', columns: [], rows: [] } },
    { type: 'timeline', data: { title: '服用周期', duration_days: 28, phases: [], items: [] } },
  ],
})

describe('extractStructuredFallback', () => {
  it('从 ```json 代码块中提取 blocks JSON', () => {
    const content = '```json\n' + validBlocksJson + '\n```\n以上是配方。'
    const result = extractStructuredFallback(content)
    expect(result).not.toBeNull()
    expect(result!.blocks.length).toBe(3)
    expect(result!.title).toBe('测试配方')
  })

  it('无代码块但有前后说明文字时扫描提取', () => {
    const content = '根据您的需求，推荐以下配方：\n' + validBlocksJson + '\n（请遵医嘱）'
    const result = extractStructuredFallback(content)
    expect(result).not.toBeNull()
    expect(result!.blocks.length).toBe(3)
  })

  it('过滤未知 block type，仅保留合法块', () => {
    const content = JSON.stringify({
      blocks: [
        { type: 'header', data: { title: '配方' } },
        { type: 'unknown-block', data: {} },
        { type: 'metrics', data: { items: [] } },
      ],
    })
    const result = extractStructuredFallback(content)
    expect(result).not.toBeNull()
    expect(result!.blocks.length).toBe(2)
    expect(result!.blocks.every((b: any) => !['unknown-block'].includes(b.type))).toBe(true)
  })

  it('非 JSON 内容返回 null', () => {
    expect(extractStructuredFallback('纯文本内容，没有 blocks')).toBeNull()
    expect(extractStructuredFallback('')).toBeNull()
    expect(extractStructuredFallback(null as unknown as string)).toBeNull()
  })

  it('JSON 无 blocks 数组返回 null', () => {
    expect(extractStructuredFallback('{"foo":"bar"}')).toBeNull()
  })
})