// @ts-nocheck
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ExportService } from '../../../services/exportService'
import { IExportService, ExportFormat, ExportProgress } from '../../../types'

describe('ExportService', () => {
  let exportService: ExportService

  beforeEach(() => {
    exportService = new ExportService()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('PDF 导出', () => {
    it('应生成有效的 PDF 文件', async () => {
      const blob = await exportService.exportToPDF({
        title: '测试报告',
        messages: [
          { role: 'user', content: '问题', timestamp: Date.now() },
          { role: 'assistant', content: '回答', timestamp: Date.now() }
        ],
        formulas: [],
        metadata: { exportedAt: Date.now() }
      })

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toContain('pdf')
      expect(blob.size).toBeGreaterThan(0)
    })

    it('应包含正确的 PDF 元数据', async () => {
      const spy = jest.spyOn(exportService as any, 'generatePDFMetadata')

      await exportService.exportToPDF({
        title: '元数据测试',
        messages: [],
        formulas: [],
        metadata: { author: '测试用户' }
      })

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          author: '测试用户',
          title: '元数据测试'
        })
      )
    })
  })

  describe('Word 导出', () => {
    it('应生成有效的 Word 文档', async () => {
      const blob = await exportService.exportToWord({
        title: 'Word 报告',
        messages: [
          { role: 'user', content: '用户消息', timestamp: Date.now() }
        ],
        formulas: [],
        metadata: {}
      })

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toContain('wordprocessingml')
    })

    it('应保留 Markdown 格式', async () => {
      const markdownContent = '# 标题\n\n**加粗**文本'
      const blob = await exportService.exportToWord({
        title: 'Markdown 测试',
        messages: [
          { role: 'assistant', content: markdownContent, timestamp: Date.now() }
        ],
        formulas: [],
        metadata: {}
      })

      const text = await blob.text()
      expect(text).toContain('标题')
    })
  })

  describe('Excel 导出', () => {
    it('应生成有效的 Excel 文件', async () => {
      const blob = await exportService.exportToExcel({
        title: '配方数据',
        messages: [],
        formulas: [
          { id: 'f1', name: '配方A', category: '营养', data: { calories: 100 } },
          { id: 'f2', name: '配方B', category: '功能性', data: { protein: 20 } }
        ],
        metadata: {}
      })

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).contains('sheet')
    })

    it('应将配方数据结构化为表格', async () => {
      const formulas = Array.from({ length: 50 }, (_, i) => ({
        id: `f${i}`,
        name: `配方${i}`,
        category: i % 2 === 0 ? '营养' : '功能性',
        data: { value: i * 10 }
      }))

      const blob = await exportService.exportToExcel({
        title: '批量配方',
        messages: [],
        formulas,
        metadata: {}
      })

      expect(blob.size).toBeGreaterThan(0)
    })
  })

  describe('Markdown 导出', () => {
    it('应生成格式正确的 Markdown 文本', async () => {
      const markdown = await exportService.exportToMarkdown({
        title: 'MD 报告',
        messages: [
          { role: 'user', content: 'Q: 什么是活性肽？', timestamp: Date.now() },
          { role: 'assistant', content: 'A: 活性肽是...', timestamp: Date.now() }
        ],
        formulas: [
          { id: 'f1', name: '胶原蛋白肽', category: '功能性成分', data: {} }
        ],
        metadata: { exportedAt: Date.now() }
      })

      expect(markdown).toContain('# MD 报告')
      expect(markdown).toContain('## 对话记录')
      expect(markdown).toContain('> Q: 什么是活性肽？')
      expect(markdown).toContain('**A:** 活性肽是...')
      expect(markdown).toContain('## 配方列表')
      expect(markdown).toContain('- 胶原蛋白肽')
    })

    it('应转义特殊字符', async () => {
      const markdown = await exportService.exportToMarkdown({
        title: '特殊字符测试',
        messages: [
          { role: 'user', content: '包含 <script> & "特殊" 字符', timestamp: Date.now() }
        ],
        formulas: [],
        metadata: {}
      })

      expect(markdown).not.toContain('<script>')
    })
  })

  describe('JSON 导出', () => {
    it('应生成有效的 JSON 数据', async () => {
      const jsonString = await exportService.exportToJSON({
        title: 'JSON 数据',
        messages: [
          { id: 'm1', role: 'user', content: '测试', timestamp: Date.now() }
        ],
        formulas: [],
        metadata: { version: '1.0' }
      })

      const parsed = JSON.parse(jsonString)
      expect(parsed.title).toBe('JSON 数据')
      expect(parsed.messages).toHaveLength(1)
      expect(parsed.metadata.version).toBe('1.0')
    })

    it('应包含完整的导出时间戳', async () => {
      const beforeExport = Date.now()
      const jsonString = await exportService.exportToJSON({
        title: '时间戳测试',
        messages: [],
        formulas: [],
        metadata: {}
      })
      const afterExport = Date.now()

      const parsed = JSON.parse(jsonString)
      expect(parsed.metadata.exportedAt).toBeGreaterThanOrEqual(beforeExport)
      expect(parsed.metadata.exportedAt).toBeLessThanOrEqual(afterExport)
    })
  })

  describe('导出进度跟踪', () => {
    it('应报告导出进度', async () => {
      const progressUpdates: ExportProgress[] = []

      const progressInterval = setInterval(() => {
        const progress = exportService.getExportProgress()
        progressUpdates.push(progress)
      }, 50)

      await exportService.exportToPDF({
        title: '进度测试',
        messages: Array.from({ length: 100 }, (_, i) => ({
          id: `m${i}`,
          role: 'user' as const,
          timestamp: Date.now(),
          content: `消息 ${i}`
        })),
        formulas: [],
        metadata: {}
      })

      clearInterval(progressInterval)

      expect(progressUpdates.length).toBeGreaterThan(0)
      expect(progressUpdates[progressUpdates.length - 1].progress).toBe(100)
      expect(progressUpdates[progressUpdates.length - 1].isExporting).toBe(false)
    })
  })

  describe('取消导出', () => {
    it('应能取消正在进行的导出', async () => {
      const exportPromise = exportService.exportToPDF({
        title: '取消测试',
        messages: Array.from({ length: 1000 }, (_, i) => ({
          id: `m${i}`,
          role: 'user' as const,
          timestamp: Date.now(),
          content: `长消息 ${i}`.repeat(100)
        })),
        formulas: [],
        metadata: {}
      })

      setTimeout(() => {
        exportService.cancelExport()
      }, 10)

      try {
        await exportPromise
        fail('Expected cancellation')
      } catch (error) {
        expect((error as any).message).toContain('cancelled')
      }

      const progress = exportService.getExportProgress()
      expect(progress.isExporting).toBe(false)
    })

    it('取消后应清理临时资源', () => {
      const cleanupSpy = jest.spyOn(exportService as any, 'cleanupTempResources')

      exportService.cancelExport()

      expect(cleanupSpy).toHaveBeenCalled()
    })
  })

  describe('批量导出', () => {
    it('应支持同时导出多种格式', async () => {
      const exportData = {
        title: '多格式测试',
        messages: [{ role: 'user', content: '测试', timestamp: Date.now() }],
        formulas: [],
        metadata: {}
      }

      const [pdf, word, excel, md, json] = await Promise.all([
        exportService.exportToPDF(exportData),
        exportService.exportToWord(exportData),
        exportService.exportToExcel(exportData),
        exportService.exportToMarkdown(exportData),
        exportService.exportToJSON(exportData)
      ])

      expect(pdf).toBeInstanceOf(Blob)
      expect(word).toBeInstanceOf(Blob)
      expect(excel).toBeInstanceOf(Blob)
      expect(typeof md).toBe('string')
      expect(typeof json).toBe('string')
    })
  })

  describe('错误处理', () => {
    it('应处理空数据导出', async () => {
      const pdf = await exportService.exportToPDF({
        title: '',
        messages: [],
        formulas: [],
        metadata: {}
      })

      expect(pdf).toBeInstanceOf(Blob)
    })

    it('应处理超大消息内容', async () => {
      const hugeMessage = 'x'.repeat(10 * 1024 * 1024)

      const pdf = await exportService.exportToPDF({
        title: '大数据测试',
        messages: [{
          role: 'user',
          content: hugeMessage,
          timestamp: Date.now()
        }],
        formulas: [],
        metadata: {}
      })

      expect(pdf.size).toBeGreaterThan(0)
    })
  })
})
