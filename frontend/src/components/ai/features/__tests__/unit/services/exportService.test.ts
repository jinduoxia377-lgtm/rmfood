import { describe, it, expect, beforeEach, vi } from 'vitest'
import { exportService } from '../../../services/exportService'
import type { ExportFormat } from '../../../services/exportService'

/** 构造测试消息 */
function makeMessages(count = 2): Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: number }> {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: i % 2 === 0 ? `问题 ${i}` : `回答 ${i}`,
    timestamp: Date.now() + i * 1000,
  }))
}

describe('ExportService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('JSON 导出', () => {
    it('应生成有效的 JSON 字符串', () => {
      const messages = makeMessages(2)
      const json = exportService.exportToJSON(messages)
      const parsed = JSON.parse(json)
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].role).toBe('user')
    })
  })

  describe('CSV 导出', () => {
    it('应包含表头与数据行', () => {
      const csv = exportService.exportToCSV(makeMessages(2))
      const lines = csv.split('\n')
      expect(lines[0]).toContain('ID')
      expect(lines[0]).toContain('角色')
      expect(lines.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('TXT 导出', () => {
    it('应包含消息内容', () => {
      const txt = exportService.exportToTXT(makeMessages(1))
      expect(txt).toContain('问题 0')
    })
  })

  describe('HTML 导出', () => {
    it('应生成完整 HTML 文档', () => {
      const html = exportService.exportToHTML(makeMessages(1))
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('问题 0')
    })
  })

  describe('Markdown 导出', () => {
    it('应生成 Markdown 内容', () => {
      const md = exportService.exportToMarkdown(makeMessages(1))
      expect(md).toContain('# RMFOOD')
      expect(md).toContain('问题 0')
    })
  })

  describe('exportByFormat', () => {
    it('应按格式返回对应内容', () => {
      const messages = makeMessages(1)
      expect(exportService.exportByFormat(messages, 'json')).toContain('"id"')
      expect(exportService.exportByFormat(messages, 'markdown')).toContain('# RMFOOD')
      expect(exportService.exportByFormat(messages, 'csv')).toContain('ID')
      expect(exportService.exportByFormat(messages, 'txt')).toContain('问题 0')
      expect(exportService.exportByFormat(messages, 'html')).toContain('<!DOCTYPE html>')
    })

    it('未知格式回退到 JSON', () => {
      const messages = makeMessages(1)
      const out = exportService.exportByFormat(messages, 'unknown' as ExportFormat)
      expect(() => JSON.parse(out)).not.toThrow()
    })
  })

  describe('exportAsync', () => {
    it('小数据量直接返回结果', async () => {
      const messages = makeMessages(3)
      const result = await exportService.exportAsync(messages, 'json')
      expect(() => JSON.parse(result)).not.toThrow()
    })

    it('应报告进度回调', async () => {
      const messages = makeMessages(3)
      const progressCalls = []
      await exportService.exportAsync(messages, 'markdown', (p) => {
        progressCalls.push(p)
      })
      expect(progressCalls.length).toBeGreaterThan(0)
      expect(progressCalls[progressCalls.length - 1].percentage).toBe(100)
    })
  })

  describe('取消导出', () => {
    it('cancelExport 后不应抛出异常', () => {
      expect(() => exportService.cancelExport()).not.toThrow()
    })
  })

  describe('generateFilename', () => {
    it('应生成带扩展名的文件名', () => {
      const name = exportService.generateFilename('json', 'test')
      expect(name).toMatch(/^test-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/)
    })
  })
})