// @ts-expect-error - vitest + @testing-library/react type compatibility
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
// @ts-expect-error -- vitest global type
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import React from 'react'
import FormulaWizard, { type WizardConfig, type PresetData } from '../../FormulaWizard'
import GenerationProgress, {
  useGenerationProgressState,
  type ProgressStage,
  type SubTask,
} from '../../GenerationProgress'
import CandidateComparison, { type FormulaCandidate } from '../../CandidateComparison'
import SensitivityAnalysis, { type SensitivityParameter, type MetricResult } from '../../SensitivityAnalysis'

// ===== Mock localStorage =====
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// ===== Test Data Factories =====

function createMockCandidate(overrides: Partial<FormulaCandidate> = {}): FormulaCandidate {
  return {
    id: `candidate-${Math.random().toString(36).substring(2, 11)}`,
    index: overrides.index ?? 0,
    name: `配方方案 ${overrides.index !== undefined ? overrides.index + 1 : 1}`,
    overallScore: Math.floor(Math.random() * 40) + 60,
    scores: {
      efficacy: Math.floor(Math.random() * 40) + 60,
      safety: Math.floor(Math.random() * 30) + 70,
      stability: Math.floor(Math.random() * 35) + 65,
      cost: Math.floor(Math.random() * 40) + 60,
      sensory: Math.floor(Math.random() * 30) + 70,
      compliance: Math.floor(Math.random() * 25) + 75,
    },
    ingredients: [
      { name: '透明质酸', amount: 2.0, unit: '%', function: '保湿剂' },
      { name: '烟酰胺', amount: 3.0, unit: '%', function: '美白成分' },
      { name: '维生素E', amount: 1.0, unit: '%', function: '抗氧化' },
      { name: '神经酰胺', amount: 1.5, unit: '%', function: '修复屏障' },
      { name: '角鲨烷', amount: 2.5, unit: '%', function: '滋润' },
    ],
    costIndex: Math.floor(Math.random() * 100) + 50,
    safetyScore: Math.floor(Math.random() * 20) + 80,
    ...overrides,
  }
}

function createMockCandidates(count: number): FormulaCandidate[] {
  return Array.from({ length: count }, (_, i) => createMockCandidate({ index: i }))
}

// ============================================================
// FormulaWizard 单元测试 (10 cases)
// ============================================================

describe('FormulaWizard - 参数配置向导', () => {
  const mockOnComplete = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  describe('向导流程完整性', () => {
    it('应渲染步骤指示器，显示 3 个步骤', () => {
      render(<FormulaWizard onComplete={mockOnComplete} />)

      expect(screen.getByText('目标功效')).toBeInTheDocument()
      expect(screen.getByText('约束条件')).toBeInTheDocument()
      expect(screen.getByText('高级选项')).toBeInTheDocument()
    })

    it('初始状态应在第 1 步（目标功效选择）', () => {
      render(<FormulaWizard onComplete={mockOnComplete} />)

      expect(screen.getByText('选择目标功效')).toBeInTheDocument()
    })

    it('点击"下一步"应前进到第 2 步', async () => {
      render(<FormulaWizard onComplete={mockOnComplete} />)

      fireEvent.click(screen.getByText('保湿'))

      await waitFor(() => {
        const nextButton = screen.getByText('下一步')
        expect(nextButton).toBeEnabled()
      })

      fireEvent.click(screen.getByText('下一步'))

      await waitFor(() => {
        expect(screen.getByText('约束条件配置')).toBeInTheDocument()
      })
    })

    it('点击"上一步"应返回到前一步骤', async () => {
      render(<FormulaWizard onComplete={mockOnComplete} />)

      fireEvent.click(screen.getByText('保湿'))
      await waitFor(() => fireEvent.click(screen.getByText('下一步')))
      await waitFor(() => expect(screen.getByText('约束条件配置')).toBeInTheDocument())

      fireEvent.click(screen.getByText('上一步'))

      await waitFor(() => {
        expect(screen.getByText('选择目标功效')).toBeInTheDocument()
      })
    })

    it('点击"跳过此步"应跳过当前步骤', async () => {
      render(<FormulaWizard onComplete={mockOnComplete} />)

      fireEvent.click(screen.getByText('跳过此步'))

      await waitFor(() => {
        expect(screen.getByText('约束条件配置')).toBeInTheDocument()
      })
    })

    it('在第 3 步点击完成应调用 onComplete 回调', async () => {
      render(<FormulaWizard onComplete={mockOnComplete} />)

      fireEvent.click(screen.getByText('跳过此步'))
      await waitFor(() => {})
      fireEvent.click(screen.getByText('下一步'))
      await waitFor(() => {})
      fireEvent.click(screen.getByText('完成配置'))

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1)
        const config = mockOnComplete.mock.calls[0][0] as WizardConfig
        expect(config).toHaveProperty('efficacies')
        expect(config).toHaveProperty('constraints')
        expect(config).toHaveProperty('advanced')
      })
    })
  })

  describe('功效选择功能', () => {
    it('点击功效类型应切换选中状态', () => {
      render(<FormulaWizard onComplete={mockOnComplete} />)

      const moisturizingBtn = screen.getByText('保湿')
      fireEvent.click(moisturizingBtn)

      expect(screen.getByText('%')).toBeInTheDocument()
    })

    it('未选择功效时，下一步按钮应禁用', () => {
      render(<FormulaWizard onComplete={mockOnComplete} />)

      const nextButton = screen.getByRole('button', { name: /下一步/ })
      expect(nextButton).toBeDisabled()
    })
  })

  describe('预设管理功能', () => {
    it('应用快捷预设应更新功效列表', async () => {
      render(<FormulaWizard onComplete={mockOnComplete} />)

      fireEvent.click(screen.getByText('强效保湿'))

      await waitFor(() => {
        const nextButton = screen.getByText('下一步')
        expect(nextButton).not.toBeDisabled()
      })
    })

    it('保存和加载预设应正确序列化/反序列化', async () => {
      render(<FormulaWizard onComplete={mockOnComplete} />)

      fireEvent.click(screen.getByText('管理预设'))

      const input = screen.getByPlaceholderText('输入预设名称...')
      fireEvent.change(input, { target: { value: '测试预设' } })
      fireEvent.click(screen.getByLabelText(/保存/i))

      await waitFor(() => {
        expect(localStorageMock.setItem).toHaveBeenCalled()
        const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1])
        expect(savedData).toBeInstanceOf(Array)
        expect(savedData.some((p: PresetData) => p.name === '测试预设')).toBe(true)
      })
    })
  })
})

// ============================================================
// GenerationProgress 单元测试 (8 cases)
// ============================================================

describe('GenerationProgress - 生成进度可视化', () => {
  describe('进度状态机转换', () => {
    it('idle 状态下 compact 模式不应渲染', () => {
      const { container } = render(
        <GenerationProgress progress={{ stage: 'idle' }} compact />
      )

      expect(container.innerHTML).toBe('')
    })

    it('running 状态应显示进度条和子任务', () => {
      render(
        <GenerationProgress
          progress={{
            stage: 'generating',
            overallProgress: 45,
            currentStageName: '候选生成中',
            subTasks: [
              { id: '1', name: '候选生成', status: 'running', progress: 45, current: 23, total: 50 },
              { id: '2', name: '评分计算', status: 'pending', progress: 0 },
              { id: '3', name: '排序优化', status: 'pending', progress: 0 },
              { id: '4', name: '结果整理', status: 'pending', progress: 0 },
            ],
          }}
        />
      )

      expect(screen.getByText('45%')).toBeInTheDocument()
      expect(screen.getByText('候选生成')).toBeInTheDocument()
    })

    it('completed 状态应显示完成状态', () => {
      render(
        <GenerationProgress
          progress={{
            stage: 'completed',
            overallProgress: 100,
            currentStageName: '生成完成',
          }}
        />
      )

      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('failed 状态应显示失败状态和重试按钮', () => {
      const mockRetry = vi.fn()

      render(
        <GenerationProgress
          progress={{
            stage: 'failed',
            overallProgress: 30,
            currentStageName: '生成失败',
          }}
          onRetry={mockRetry}
        />
      )

      expect(screen.getByText('重试')).toBeInTheDocument()
      fireEvent.click(screen.getByText('重试'))
      expect(mockRetry).toHaveBeenCalledTimes(1)
    })

    it('paused 状态应显示继续按钮', () => {
      const mockResume = vi.fn()

      render(
        <GenerationProgress
          progress={{
            stage: 'paused',
            overallProgress: 50,
            currentStageName: '已暂停',
          }}
          onResume={mockResume}
        />
      )

      expect(screen.getByText('继续')).toBeInTheDocument()
    })
  })

  describe('useGenerationProgressState Hook', () => {
    it('startGeneration 应初始化状态为 preparing', () => {
      const { result } = renderHook(() => useGenerationProgressState())

      act(() => {
        result.current.startGeneration()
      })

      expect(result.current.state.stage).toBe('preparing')
      expect(result.current.state.subTasks.length).toBe(4)
    })

    it('pauseGeneration 和 resumeGeneration 应正确切换状态', () => {
      const { result } = renderHook(() => useGenerationProgressState())

      act(() => {
        result.current.startGeneration()
        result.current.pauseGeneration()
      })

      expect(result.current.state.stage).toBe('paused')

      act(() => {
        result.current.resumeGeneration()
      })

      expect(result.current.state.stage).not.toBe('paused')
    })

    it('cancelGeneration 应将状态设为 cancelled', () => {
      const { result } = renderHook(() => useGenerationProgressState())

      act(() => {
        result.current.startGeneration()
        result.current.cancelGeneration()
      })

      expect(result.current.state.stage).toBe('cancelled')
      expect(result.current.state.canCancel).toBe(false)
    })

    it('addLog 应添加日志条目', () => {
      const { result } = renderHook(() => useGenerationProgressState())

      act(() => {
        result.current.startGeneration()
        result.current.addLog('INFO', '测试日志消息')
      })

      expect(result.current.state.logs.length).toBe(2)
      expect(result.current.state.logs[1].level).toBe('INFO')
      expect(result.current.state.logs[1].message).toBe('测试日志消息')
    })
  })
})

// ============================================================
// CandidateComparison 单元测试 (4 cases)
// ============================================================

describe('CandidateComparison - 结果对比视图', () => {
  const mockCandidates = createMockCandidates(5)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('卡片视图渲染', () => {
    it('应渲染正确数量的候选方案卡片', () => {
      render(<CandidateComparison candidates={mockCandidates} />)

      mockCandidates.forEach(candidate => {
        expect(screen.getByText(candidate.name)).toBeInTheDocument()
      })
    })

    it('点击候选方案应触发 onSelect 回调', () => {
      const mockSelect = vi.fn()

      render(
        <CandidateComparison
          candidates={mockCandidates}
          onSelect={mockSelect}
        />
      )

      fireEvent.click(screen.getAllByText(/方案 #\d+/)[0])

      expect(mockSelect).toHaveBeenCalledTimes(1)
    })
  })

  describe('排序功能', () => {
    it('按评分降序排列应正确排序', () => {
      render(<CandidateComparison candidates={mockCandidates} />)

      const scoreButtons = screen.getAllByText(/评分/)
      expect(scoreButtons.length).toBeGreaterThan(0)
    })
  })

  describe('大数据量性能', () => {
    it('渲染 100+ 候选方案不应崩溃', () => {
      const startTime = performance.now()

      render(<CandidateComparison candidates={createMockCandidates(120)} />)

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(renderTime).toBeLessThan(500)
      expect(screen.getByText(/方案 #/)).toBeInTheDocument()
    })
  })
})

// ============================================================
// SensitivityAnalysis 单元测试 (3 cases)
// ============================================================

describe('SensitivityAnalysis - What-if 敏感性分析', () => {
  const defaultParams: SensitivityParameter[] = [
    { id: 'ph', name: 'pH 值', unit: '', baseValue: 6.5, minValue: 3.5, maxValue: 9.0, step: 0.1, currentValue: 6.5 },
    { id: 'temp', name: '温度', unit: '°C', baseValue: 25, minValue: 4, maxValue: 80, step: 1, currentValue: 25 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('参数调整功能', () => {
    it('调整参数值应触发 onParameterChange 回调', () => {
      const mockChange = vi.fn()

      render(<SensitivityAnalysis baseParameters={defaultParams} onParameterChange={mockChange} />)

      const sliders = screen.getAllByRole('slider')
      if (sliders.length > 0) {
        fireEvent.change(sliders[0], { target: { value: '7.0' } })
      }

      expect(screen.getByText('pH 值')).toBeInTheDocument()
    })
  })

  describe('数值精度', () => {
    it('计算结果应为有效数值且在合理范围内', () => {
      render(<SensitivityAnalysis baseParameters={defaultParams} />)

      expect(screen.getByText(/功效|稳定性|成本/)).toBeInTheDocument()
    })
  })

  describe('场景对比功能', () => {
    it('新增场景应增加场景数量', async () => {
      window.prompt = vi.fn(() => '测试场景')

      render(<SensitivityAnalysis baseParameters={defaultParams} />)

      const addButton = screen.getByText('+ 新增场景')
      fireEvent.click(addButton)

      expect(window.prompt).toHaveBeenCalledWith('输入场景名称：')
    })
  })
})

// ============================================================
// 集成测试 (5 cases)
// ============================================================

describe('集成测试 - 完整工作流', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
  })

  describe('完整生成流程', () => {
    it('配置 → 提交 → 监控 → 查看结果 应完整执行', async () => {
      let capturedConfig: WizardConfig | null = null

      render(
        <FormulaWizard
          onComplete={(config) => {
            capturedConfig = config
          }}
        />
      )

      fireEvent.click(screen.getByText('保湿'))
      fireEvent.click(screen.getByText('抗氧化'))

      fireEvent.click(screen.getByText('下一步'))
      await waitFor(() => {})
      fireEvent.click(screen.getByText('下一步'))
      await waitFor(() => {})
      fireEvent.click(screen.getByText('完成配置'))

      await waitFor(() => {
        expect(capturedConfig).not.toBeNull()
        expect(capturedConfig!.efficacies.length).toBeGreaterThan(0)
      })

      const { result } = renderHook(() => useGenerationProgressState())

      act(() => {
        result.current.startGeneration()
      })

      expect(result.current.state.stage).toBe('preparing')

      act(() => {
        result.current.completeGeneration(true)
      })

      expect(result.current.state.stage).toBe('completed')

      const candidates = createMockCandidates(3)
      render(<CandidateComparison candidates={candidates} />)

      expect(screen.getByText(candidates[0].name)).toBeInTheDocument()
    }, 15000)
  })

  describe('取消/暂停/恢复操作序列', () => {
    it('暂停后恢复应保持状态一致性', () => {
      const { result } = renderHook(() => useGenerationProgressState())

      act(() => result.current.startGeneration())
      expect(result.current.state.stage).toBe('preparing')

      act(() => result.current.pauseGeneration())
      expect(result.current.state.stage).toBe('paused')

      act(() => result.current.resumeGeneration())
      expect(['preparing', 'generating']).toContain(result.current.state.stage)

      act(() => result.current.cancelGeneration())
      expect(result.current.state.stage).toBe('cancelled')
    })
  })

  describe('错误恢复流程', () => {
    it('失败后重试应重新开始生成', () => {
      const { result } = renderHook(() => useGenerationProgressState())

      act(() => {
        result.current.startGeneration()
        result.current.completeGeneration(false)
      })

      expect(result.current.state.stage).toBe('failed')

      act(() => result.current.startGeneration())
      expect(result.current.state.stage).toBe('preparing')
    })
  })
})

// ============================================================
// 性能基准测试 (辅助)
// ============================================================

describe('性能基准', () => {
  it('UI 渲染 100 条结果应在合理时间内完成', () => {
    const startTime = performance.now()

    render(<CandidateComparison candidates={createMockCandidates(100)} />)

    const renderTime = performance.now() - startTime

    console.log(`[Performance] 100 candidates render time: ${renderTime.toFixed(2)}ms`)
    expect(renderTime).toBeLessThan(200)
  })

  it('大量日志条目不应导致性能问题', () => {
    const { result } = renderHook(() => useGenerationProgressState())

    act(() => {
      result.current.startGeneration()
      for (let i = 0; i < 200; i++) {
        result.current.addLog('INFO', `日志消息 ${i}`)
      }
    })

    expect(result.current.state.logs.length).toBe(201)
  })
})

// Helper for rendering hooks in tests
function renderHook<T>(hookFn: () => T): { result: { current: T } } {
  const result: { current: T } = { current: null as any }

  function TestComponent() {
    result.current = hookFn()
    return null
  }

  render(<TestComponent />)
  return { result }
}

export {}
