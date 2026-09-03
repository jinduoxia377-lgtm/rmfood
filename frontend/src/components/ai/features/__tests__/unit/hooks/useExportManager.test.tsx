// @ts-nocheck
import { renderHook, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { useExportManager } from '../../../hooks/useExportManager'
import { createMockExportService, createMockEventBus } from '../../helpers/mockServices'
import { ExportFormat } from '../../../types'

describe('useExportManager', () => {
  let mockExportService: ReturnType<typeof createMockExportService>
  let mockEventBus: ReturnType<typeof createMockEventBus>

  beforeEach(() => {
    mockExportService = createMockExportService()
    mockEventBus = createMockEventBus()
  })

  describe('初始化状态', () => {
    it('应初始化为非导出状态', () => {
      const { result } = renderHook(() =>
        useExportManager(mockExportService, mockEventBus)
      )

      expect(result.current.isExporting).toBe(false)
      expect(result.current.exportProgress).toBe(0)
      expect(result.current.currentFormat).toBeNull()
      expect(result.current.lastError).toBeNull()
    })
  })

  describe('导出流程', () => {
    it('应成功执行 PDF 导出', async () => {
      const exportData = {
        title: 'PDF 测试报告',
        messages: [],
        formulas: [],
        metadata: {}
      }

      const { result } = renderHook(() =>
        useExportManager(mockExportService, mockEventBus)
      )

      await act(async () => {
        await result.current.startExport(exportData, ExportFormat.PDF)
      })

      expect(mockExportService.exportToPDF).toHaveBeenCalledWith(exportData)
      expect(result.current.isExporting).toBe(false)
      expect(result.current.exportProgress).toBe(100)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'EXPORT_COMPLETE',
        expect.objectContaining({ format: ExportFormat.PDF })
      )
    })

    it('应支持所有 5 种导出格式', async () => {
      const formats = [
        ExportFormat.PDF,
        ExportFormat.WORD,
        ExportFormat.EXCEL,
        ExportFormat.MARKDOWN,
        ExportFormat.JSON
      ]

      for (const format of formats) {
        const exportData = {
          title: `${format} 测试`,
          messages: [],
          formulas: [],
          metadata: {}
        }

        const { result } = renderHook(() =>
          useExportManager(mockExportService, mockEventBus)
        )

        await act(async () => {
          await result.current.startExport(exportData, format)
        })

        expect(result.current.lastExportFormat).toBe(format)
      }
    })

    it('应在导出过程中跟踪进度', async () => {
      const progressCallback: ((progress: number) => void) | null = null

      mockExportService.exportToPDF.mockImplementation(async () => {
        return new Promise((resolve) => {
          let progress = 0
          const interval = setInterval(() => {
            progress += 25
            progressCallback?.(progress)
            if (progress >= 100) {
              clearInterval(interval)
              resolve(new Blob())
            }
          }, 50)
        })
      })

      const { result } = renderHook(() =>
        useExportManager(mockExportService, mockEventBus)
      )

      const exportPromise = act(async () => {
        await result.current.startExport(
          { title: '进度测试', messages: [], formulas: [], metadata: {} },
          ExportFormat.PDF
        )
      })

      expect(result.current.isExporting).toBe(true)
      expect(result.current.exportProgress).toBeGreaterThan(0)

      await exportPromise
      expect(result.current.exportProgress).toBe(100)
    })
  })

  describe('取消导出', () => {
    it('应能取消正在进行的导出', async () => {
      mockExportService.exportToPDF.mockImplementation(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cancelled')), 10000))
      )

      const { result } = renderHook(() =>
        useExportManager(mockExportService, mockEventBus)
      )

      const exportPromise = act(async () => {
        result.current.startExport(
          { title: '取消测试', messages: [], formulas: [], metadata: {} },
          ExportFormat.PDF
        )
      })

      act(() => {
        result.current.cancelCurrentExport()
      })

      expect(mockExportService.cancelExport).toHaveBeenCalled()

      try {
        await exportPromise
      } catch (error) {
        expect((error as any).message).toContain('cancelled')
      }

      expect(result.current.isExporting).toBe(false)
      expect(mockEventBus.emit).toHaveBeenCalledWith('EXPORT_CANCELLED', expect.anything())
    })
  })

  describe('错误处理', () => {
    it('应处理导出过程中的错误', async () => {
      const error = new Error('Export failed')
      mockExportService.exportToWord.mockRejectedValueOnce(error)

      const { result } = renderHook(() =>
        useExportManager(mockExportService, mockEventBus)
      )

      await act(async () => {
        try {
          await result.current.startExport(
            { title: '错误测试', messages: [], formulas: [], metadata: {} },
            ExportFormat.WORD
          )
        } catch (e) {
          // Expected
        }
      })

      expect(result.current.lastError).toEqual(error)
      expect(result.current.isExporting).toBe(false)
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'EXPORT_ERROR',
        expect.objectContaining({ error })
      )
    })

    it('应防止重复导出', async () => {
      mockExportService.exportToPDF.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      )

      const { result } = renderHook(() =>
        useExportManager(mockExportService, mockEventBus)
      )

      act(() => {
        result.current.startExport(
          { title: '测试', messages: [], formulas: [], metadata: {} },
          ExportFormat.PDF
        )
      })

      const secondAttempt = result.current.startExport(
        { title: '重复', messages: [], formulas: [], metadata: {} },
        ExportFormat.PDF
      )

      await expect(secondAttempt).rejects.toThrow(/already exporting/i)
      expect(mockExportService.exportToPDF).toHaveBeenCalledTimes(1)
    })
  })

  describe('导出历史记录', () => {
    it('应记录最近的导出操作', async () => {
      const { result } = renderHook(() =>
        useExportManager(mockExportService, mockEventBus)
      )

      await act(async () => {
        await result.current.startExport(
          { title: '第一次导出', messages: [], formulas: [], metadata: {} },
          ExportFormat.PDF
        )
      })

      expect(result.current.exportHistory).toHaveLength(1)
      expect(result.current.exportHistory[0]).toEqual(
        expect.objectContaining({
          format: ExportFormat.PDF,
          title: '第一次导出',
          timestamp: expect.any(Number),
          status: 'success'
        })
      )

      await act(async () => {
        await result.current.startExport(
          { title: '第二次导出', messages: [], formulas: [], metadata: {} },
          ExportFormat.EXCEL
        )
      })

      expect(result.current.exportHistory).toHaveLength(2)
    })
  })
})
