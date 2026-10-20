import { renderHook, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useExportManager } from '../../../hooks/useExportManager'
import { exportService } from '../../../services/exportService'
import { eventBus } from '../../../services/eventBus'
import type { ExportFormat } from '../../../services/exportService'

// 当前 useExportManager 以模块单例方式依赖 exportService / eventBus / chatApi
vi.mock('../../../services/exportService', () => ({
  exportService: {
    generateFilename: vi.fn(() => 'test-export.json'),
    exportAsync: vi.fn().mockResolvedValue('{"exported":true}'),
  },
}))

vi.mock('../../../services/eventBus', () => ({
  eventBus: {
    emit: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}))

vi.mock('@/api/chat', () => ({
  chatApi: {
    exportSession: vi.fn().mockResolvedValue({}),
  },
}))

describe('useExportManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应初始化为非导出状态', () => {
    const { result } = renderHook(() => useExportManager())

    expect(result.current.isExporting).toBe(false)
    expect(result.current.exportProgress).toBe(0)
    expect(result.current.showExportDialog).toBe(false)
    expect(result.current.exportFormat).toBe('json')
    expect(result.current.includeMetadata).toBe(true)
    expect(result.current.currentSessionId).toBeNull()
  })

  it('validateFormat 应识别合法格式并拒绝非法格式', () => {
    const { result } = renderHook(() => useExportManager())

    for (const format of ['json', 'csv', 'txt', 'html', 'markdown'] as ExportFormat[]) {
      expect(result.current.validateFormat(format).valid).toBe(true)
    }

    expect(result.current.validateFormat('pdf' as ExportFormat).valid).toBe(false)
    expect(result.current.validateFormat('excel' as ExportFormat).valid).toBe(false)
  })

  it('setExportFormat 应更新当前导出格式', () => {
    const { result } = renderHook(() => useExportManager())

    act(() => {
      result.current.setExportFormat('csv')
    })

    expect(result.current.exportFormat).toBe('csv')
  })

  it('setIncludeMetadata / setShowExportDialog 应更新对应状态', () => {
    const { result } = renderHook(() => useExportManager())

    act(() => {
      result.current.setIncludeMetadata(false)
      result.current.setShowExportDialog(true)
    })

    expect(result.current.includeMetadata).toBe(false)
    expect(result.current.showExportDialog).toBe(true)
  })

  it('exportMessages 应调用 exportService.exportAsync 并发布开始事件', async () => {
    const messages = [
      { id: '1', role: 'user', content: '你好', timestamp: 1 },
    ]

    const { result } = renderHook(() => useExportManager())

    await act(async () => {
      await result.current.exportMessages(messages as never, { includeMetadata: false })
    })

    expect(exportService.exportAsync).toHaveBeenCalledWith(
      expect.any(Array),
      'json',
      expect.any(Function),
    )
    expect(eventBus.emit).toHaveBeenCalledWith(
      'export:started',
      expect.objectContaining({ format: 'json' }),
    )
    expect(result.current.isExporting).toBe(false)
    expect(result.current.exportProgress).toBe(100)
  })

  it('空消息不应触发导出', async () => {
    const { result } = renderHook(() => useExportManager())

    await act(async () => {
      await result.current.exportMessages([])
    })

    expect(exportService.exportAsync).not.toHaveBeenCalled()
    expect(result.current.isExporting).toBe(false)
  })

  it('cancelExport 应结束导出状态', () => {
    const { result } = renderHook(() => useExportManager())

    act(() => {
      result.current.cancelExport()
    })

    expect(result.current.isExporting).toBe(false)
  })

  it('onExportProgress / onExportComplete 应返回退订函数', () => {
    const { result } = renderHook(() => useExportManager())

    const unsubscribeProgress = result.current.onExportProgress(() => {})
    const unsubscribeComplete = result.current.onExportComplete(() => {})

    expect(typeof unsubscribeProgress).toBe('function')
    expect(typeof unsubscribeComplete).toBe('function')
  })
})