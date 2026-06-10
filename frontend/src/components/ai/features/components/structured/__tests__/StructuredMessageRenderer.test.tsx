/**
 * StructuredMessageRenderer — 单元测试
 */
import { detectStructuredContent } from '../utils'

describe('detectStructuredContent', () => {
  it('should parse valid structured JSON', () => {
    const input = JSON.stringify({
      responseType: 'analysis_report',
      blocks: [
        { type: 'header', data: { title: '测试', description: 'desc' } },
        { type: 'data-table', data: { columns: [{ key: 'a', label: 'A' }], rows: [{ a: 1 }] } },
      ],
    })
    const result = detectStructuredContent(input)
    expect(result).not.toBeNull()
    expect(result!.responseType).toBe('analysis_report')
    expect(result!.blocks).toHaveLength(2)
    expect(result!.blocks[0].type).toBe('header')
    expect(result!.blocks[1].type).toBe('data-table')
  })

  it('should return null for plain text', () => {
    expect(detectStructuredContent('Hello world')).toBeNull()
    expect(detectStructuredContent('')).toBeNull()
    expect(detectStructuredContent('   ')).toBeNull()
  })

  it('should return null for invalid JSON', () => {
    expect(detectStructuredContent('{ invalid json }')).toBeNull()
    expect(detectStructuredContent('{"key": "value"}')).toBeNull() // no blocks array
  })

  it('should return null for JSON without blocks array', () => {
    const input = JSON.stringify({ responseType: 'test', data: {} })
    expect(detectStructuredContent(input)).toBeNull()
  })

  it('should return null for blocks with unknown type', () => {
    const input = JSON.stringify({
      responseType: 'test',
      blocks: [{ type: 'unknown-type', data: {} }],
    })
    expect(detectStructuredContent(input)).toBeNull()
  })

  it('should handle short strings efficiently', () => {
    expect(detectStructuredContent('a')).toBeNull()
    expect(detectStructuredContent('{}')).toBeNull()
  })

  it('should handle Markdown content correctly (not parse)', () => {
    const markdown = '# Hello\n\nThis is **markdown** content.\n\n| col1 | col2 |\n|------|------|\n| val1 | val2 |'
    expect(detectStructuredContent(markdown)).toBeNull()
  })

  it('should handle mixed block types from the reference design', () => {
    const input = JSON.stringify({
      responseType: 'analysis_report',
      blocks: [
        { type: 'header', data: { title: '配方分析报告', description: '基于AI的多维度分析', level: 1, metadata: [{ label: '模型', value: 'GPT-4' }] } },
        { type: 'data-table', data: { title: '成分表', columns: [{ key: 'name', label: '名称' }, { key: 'dosage', label: '用量', type: 'number' }], rows: [{ name: '黄芪', dosage: 15 }, { name: '当归', dosage: 10 }] } },
        { type: 'chart', data: { chartType: 'radar', title: '多维评分', data: { synergy: 0.85, taste: 0.72, stability: 0.91, safety: 0.88 } } },
        { type: 'list', data: { variant: 'analysis', items: [{ label: '协同作用显著', status: 'positive' }, { label: '口感需优化', status: 'negative' }] } },
        { type: 'callout', data: { variant: 'summary', title: '总结', content: '该配方整体表现优秀', details: ['君药黄芪用量合理', '臣药当归需微调'] } },
        { type: 'divider', data: { variant: 'dashed' } },
        { type: 'metrics', data: { title: '关键指标', items: [{ label: '综合评分', value: 0.88, unit: '%', trend: 'up' }, { label: '安全性', value: 0.95, unit: '%', trend: 'stable' }] } },
      ],
    })
    const result = detectStructuredContent(input)
    expect(result).not.toBeNull()
    expect(result!.blocks).toHaveLength(7)
    expect(result!.blocks.map(b => b.type)).toEqual([
      'header', 'data-table', 'chart', 'list', 'callout', 'divider', 'metrics',
    ])
  })

  it('should extract JSON from markdown code blocks (LLM output format)', () => {
    const input = '好的，这是为您设计的配方：\n\n```json\n{\n  "responseType": "analysis_report",\n  "blocks": [\n    { "type": "header", "data": { "title": "测试配方" } },\n    { "type": "metrics", "data": { "items": [] } }\n  ]\n}\n```\n\n如有需要请随时告诉我。'
    const result = detectStructuredContent(input)
    expect(result).not.toBeNull()
    expect(result!.blocks).toHaveLength(2)
    expect(result!.blocks[0].type).toBe('header')
    expect(result!.blocks[1].type).toBe('metrics')
  })

  it('should extract JSON from ```json code block without extra text', () => {
    const input = '```json\n{"responseType":"analysis_report","blocks":[{"type":"header","data":{"title":"测试"}}]}\n```'
    const result = detectStructuredContent(input)
    expect(result).not.toBeNull()
    expect(result!.blocks).toHaveLength(1)
    expect(result!.blocks[0].type).toBe('header')
  })
})
