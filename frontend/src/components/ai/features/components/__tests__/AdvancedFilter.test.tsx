/**
 * AdvancedFilter组件全面测试
 *
 * 测试覆盖：
 * 1. 质量等级筛选
 * 2. 置信度范围筛选
 * 3. 时间范围筛选
 * 4. 成分数量范围筛选
 * 5. 标签多选筛选
 * 6. 组合条件筛选
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AdvancedFilter from '@/components/ai/features/components/AdvancedFilter'
import type { AIRecognizedFormula, FormulaFilters } from '@/types/ai.types'

const mockFormulas: AIRecognizedFormula[] = [
  {
    id: 'formula-001',
    name: '配方1',
    ingredientCount: 5,
    confidence: 0.95,
    sourceMessageId: 'msg-001',
    parsedAt: new Date('2026-05-20'),
    rawData: { title: '配方1', ingredients: [], totalAmount: 100 },
    ingredients: [],
    qualityGrade: 'A',
    tags: ['补气', '补血'],
  },
  {
    id: 'formula-002',
    name: '配方2',
    ingredientCount: 8,
    confidence: 0.75,
    sourceMessageId: 'msg-002',
    parsedAt: new Date('2026-05-19'),
    rawData: { title: '配方2', ingredients: [], totalAmount: 200 },
    ingredients: [],
    qualityGrade: 'B',
    tags: ['健脾', '抗氧化'],
  },
  {
    id: 'formula-003',
    name: '配方3',
    ingredientCount: 12,
    confidence: 0.55,
    sourceMessageId: 'msg-003',
    parsedAt: new Date('2026-05-18'),
    rawData: { title: '配方3', ingredients: [], totalAmount: 300 },
    ingredients: [],
    qualityGrade: 'C',
    tags: ['安神', '助眠'],
  },
]

const defaultFilters: FormulaFilters = {}

const defaultProps = {
  filters: defaultFilters,
  onFiltersChange: vi.fn(),
  onReset: vi.fn(),
  allFormulas: mockFormulas,
}

describe('AdvancedFilter - 高级筛选组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. 基础渲染', () => {
    it('应该正确渲染筛选器标题', () => {
      render(<AdvancedFilter {...defaultProps} />)

      expect(screen.getByText('高级筛选')).toBeInTheDocument()
    })

    it('应该渲染所有筛选项区域', () => {
      render(<AdvancedFilter {...defaultProps} />)

      expect(screen.getByText('质量等级')).toBeInTheDocument()
      expect(screen.getByText('置信度范围')).toBeInTheDocument()
      expect(screen.getByText('时间范围')).toBeInTheDocument()
      expect(screen.getByText('成分数量')).toBeInTheDocument()
      expect(screen.getByText('标签')).toBeInTheDocument()
    })

    it('默认状态下不应该显示重置按钮', () => {
      render(<AdvancedFilter {...defaultProps} />)

      expect(screen.queryByText('重置')).not.toBeInTheDocument()
    })
  })

  describe('2. 质量等级筛选', () => {
    it('应该渲染所有质量等级选项', () => {
      render(<AdvancedFilter {...defaultProps} />)

      expect(screen.getByText('A级')).toBeInTheDocument()
      expect(screen.getByText('B级')).toBeInTheDocument()
      expect(screen.getByText('C级')).toBeInTheDocument()
      expect(screen.getByText('D级')).toBeInTheDocument()
      expect(screen.getByText('F级')).toBeInTheDocument()
    })

    it('点击质量等级选项应该切换选中状态', () => {
      render(<AdvancedFilter {...defaultProps} />)

      const gradeA = screen.getByText('A级')
      fireEvent.click(gradeA)

      expect(defaultProps.onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          qualityGrades: ['A'],
        })
      )
    })

    it('应该支持多选质量等级', () => {
      render(<AdvancedFilter {...defaultProps} />)

      fireEvent.click(screen.getByText('A级'))
      fireEvent.click(screen.getByText('B级'))

      const lastCall = defaultProps.onFiltersChange.mock.calls[
        defaultProps.onFiltersChange.mock.calls.length - 1
      ][0]
      expect(lastCall.qualityGrades).toContain('A')
      expect(lastCall.qualityGrades).toContain('B')
    })

    it('再次点击已选中的选项应该取消选择', () => {
      render(<AdvancedFilter {...defaultProps} />)

      // 先选中
      fireEvent.click(screen.getByText('A级'))

      // 再取消
      fireEvent.click(screen.getByText('A级'))

      const lastCall = defaultProps.onFiltersChange.mock.calls[
        defaultProps.onFiltersChange.mock.calls.length - 1
      ][0]
      expect(lastCall.qualityGrades).not.toContain('A')
    })

    it('选中的选项应该有特殊样式', () => {
      const { container } = render(
        <AdvancedFilter
          {...defaultProps}
          filters={{ ...defaultFilters, qualityGrades: ['A'] }}
        />
      )

      const selectedButton = screen.getByText('A级')
      expect(selectedButton.className).toContain('text-green-600')
    })
  })

  describe('3. 置信度范围筛选', () => {
    it('应该渲染置信度范围滑块', () => {
      render(<AdvancedFilter {...defaultProps} />)

      const sliders = screen.getAllByRole('slider')
      expect(sliders).toHaveLength(2) // 最小值和最大值滑块
    })

    it('调整最小值滑块应该更新置信度范围', () => {
      render(<AdvancedFilter {...defaultProps} />)

      const minSlider = screen.getAllByRole('slider')[0]
      fireEvent.change(minSlider, { target: { value: '30' } })

      expect(defaultProps.onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          confidenceRange: expect.objectContaining({ min: 30 }),
        })
      )
    })

    it('调整最大值滑块应该更新置信度范围', () => {
      render(<AdvancedFilter {...defaultProps} />)

      const maxSlider = screen.getAllByRole('slider')[1]
      fireEvent.change(maxSlider, { target: { value: '80' } })

      expect(defaultProps.onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          confidenceRange: expect.objectContaining({ max: 80 }),
        })
      )
    })

    it('最小值不应该超过最大值', () => {
      render(
        <AdvancedFilter
          {...defaultProps}
          filters={{ ...defaultFilters, confidenceRange: { min: 50, max: 80 } }}
        />
      )

      const minSlider = screen.getAllByRole('slider')[0]
      fireEvent.change(minSlider, { target: { value: '90' } }) // 尝试设置最小值为90

      // 应该被限制为不超过最大值
      const lastCall = defaultProps.onFiltersChange.mock.calls[
        defaultProps.onFiltersChange.mock.calls.length - 1
      ][0]
      expect(lastCall.confidenceRange.min).toBeLessThanOrEqual(
        lastCall.confidenceRange.max
      )
    })

    it('应该显示当前置信度范围的数值', () => {
      render(
        <AdvancedFilter
          {...defaultProps}
          filters={{ ...defaultFilters, confidenceRange: { min: 30, max: 70 } }}
        />
      )

      expect(screen.getByText(/30%\s*-\s*70%/)).toBeInTheDocument()
    })
  })

  describe('4. 时间范围筛选', () => {
    it('应该渲染时间范围选项', () => {
      render(<AdvancedFilter {...defaultProps} />)

      expect(screen.getByText('今天')).toBeInTheDocument()
      expect(screen.getByText('本周')).toBeInTheDocument()
      expect(screen.getByText('本月')).toBeInTheDocument()
      expect(screen.getByText('自定义')).toBeInTheDocument()
    })

    it('点击"今天"应该设置为今天的时间范围', () => {
      render(<AdvancedFilter {...defaultProps} />)

      fireEvent.click(screen.getByText('今天'))

      const lastCall = defaultProps.onFiltersChange.mock.calls[
        defaultProps.onFiltersChange.mock.calls.length - 1
      ][0]
      expect(lastCall.dateRange).toBeDefined()
      expect(typeof lastCall.dateRange.start).toBe('number')
      expect(typeof lastCall.dateRange.end).toBe('number')
    })

    it('点击"本周"应该设置为近7天的时间范围', () => {
      render(<AdvancedFilter {...defaultProps} />)

      fireEvent.click(screen.getByText('本周'))

      const lastCall = defaultProps.onFiltersChange.mock.calls[
        defaultProps.onFiltersChange.mock.calls.length - 1
      ][0]
      const rangeMs = lastCall.dateRange.end - lastCall.dateRange.start

      // 应该接近7天（允许一些误差）
      expect(rangeMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000)
      expect(rangeMs).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000)
    })

    it('点击"本月"应该设置为近30天的时间范围', () => {
      render(<AdvancedFilter {...defaultProps} />)

      fireEvent.click(screen.getByText('本月'))

      const lastCall = defaultProps.onFiltersChange.mock.calls[
        defaultProps.onFiltersChange.mock.calls.length - 1
      ][0]
      const rangeMs = lastCall.dateRange.end - lastCall.dateRange.start

      // 应该接近30天（允许一些误差）
      expect(rangeMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
      expect(rangeMs).toBeLessThanOrEqual(31 * 24 * 60 * 60 * 1000)
    })
  })

  describe('5. 成分数量范围筛选', () => {
    it('应该渲染成分数量输入框', () => {
      render(<AdvancedFilter {...defaultProps} />)

      const inputs = screen.getAllByPlaceholderText(/最少|最多/)
      expect(inputs).toHaveLength(2)
    })

    it('输入最小成分数量应该更新筛选条件', () => {
      render(<AdvancedFilter {...defaultProps} />)

      const minInput = screen.getByPlaceholderText('最少')
      fireEvent.change(minInput, { target: { value: '5' } })

      expect(defaultProps.onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredientCountRange: expect.objectContaining({ min: 5 }),
        })
      )
    })

    it('输入最大成分数量应该更新筛选条件', () => {
      render(<AdvancedFilter {...defaultProps} />)

      const maxInput = screen.getByPlaceholderText('最多')
      fireEvent.change(maxInput, { target: { value: '15' } })

      expect(defaultProps.onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          ingredientCountRange: expect.objectContaining({ max: 15 }),
        })
      )
    })

    it('应该显示当前成分数量范围', () => {
      render(
        <AdvancedFilter
          {...defaultProps}
          filters={{
            ...defaultFilters,
            ingredientCountRange: { min: 3, max: 10 },
          }}
        />
      )

      expect(screen.getByText(/3\s*-\s*10\s*种/)).toBeInTheDocument()
    })
  })

  describe('6. 标签筛选', () => {
    it('应该从数据中提取并显示可用标签', () => {
      render(<AdvancedFilter {...defaultProps} />)

      expect(screen.getByText('补气')).toBeInTheDocument()
      expect(screen.getByText('补血')).toBeInTheDocument()
      expect(screen.getByText('健脾')).toBeInTheDocument()
      expect(screen.getByText('抗氧化')).toBeInTheDocument()
      expect(screen.getByText('安神')).toBeInTheDocument()
      expect(screen.getByText('助眠')).toBeInTheDocument()
    })

    it('应该显示可用标签数量', () => {
      render(<AdvancedFilter {...defaultProps} />)

      expect(screen.getByText(/\(6\s*个可用\)/)).toBeInTheDocument()
    })

    it('点击标签应该切换选中状态', () => {
      render(<AdvancedFilter {...defaultProps} />)

      fireEvent.click(screen.getByText('补气'))

      expect(defaultProps.onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['补气'],
        })
      )
    })

    it('应该支持多选标签', () => {
      render(<AdvancedFilter {...defaultProps} />)

      fireEvent.click(screen.getByText('补气'))
      fireEvent.click(screen.getByText('补血'))

      const lastCall = defaultProps.onFiltersChange.mock.calls[
        defaultProps.onFiltersChange.mock.calls.length - 1
      ][0]
      expect(lastCall.tags).toContain('补气')
      expect(lastCall.tags).toContain('补血')
    })

    it('没有标签时应该显示提示信息', () => {
      render(
        <AdvancedFilter
          {...defaultProps}
          allFormulas={[
            {
              id: 'formula-no-tags',
              name: '无标签配方',
              ingredientCount: 0,
              confidence: 0.5,
              sourceMessageId: 'msg-000',
              parsedAt: new Date(),
              rawData: { title: '', ingredients: [], totalAmount: 0 },
              ingredients: [],
            },
          ]}
        />
      )

      expect(
        screen.getByText(/暂无可用标签/)
      ).toBeInTheDocument()
    })

    it('标签超过20个时应该截断显示', () => {
      const manyTagsFormulas: AIRecognizedFormula[] = Array.from(
        { length: 25 },
        (_, i) => ({
          id: `formula-${i}`,
          name: `配方${i}`,
          ingredientCount: i + 1,
          confidence: 0.9,
          sourceMessageId: `msg-${i}`,
          parsedAt: new Date(),
          rawData: { title: `配方${i}`, ingredients: [], totalAmount: 100 },
          ingredients: [],
          tags: [`标签${i}`],
        })
      )

      render(<AdvancedFilter {...defaultProps} allFormulas={manyTagsFormulas} />)

      expect(screen.getByText(/还有.*个标签未显示/)).toBeInTheDocument()
    })
  })

  describe('7. 组合条件筛选', () => {
    it('多个筛选条件应该同时生效', () => {
      render(<AdvancedFilter {...defaultProps} />)

      // 选择质量等级
      fireEvent.click(screen.getByText('A级'))
      fireEvent.click(screen.getByText('B级'))

      // 选择标签
      fireEvent.click(screen.getByText('补气'))

      // 调整置信度
      const minSlider = screen.getAllByRole('slider')[0]
      fireEvent.change(minSlider, { target: { value: '50' } })

      // 最后一次调用应该包含所有条件
      const lastCall = defaultProps.onFiltersChange.mock.calls[
        defaultProps.onFiltersChange.mock.calls.length - 1
      ][0]

      expect(lastCall.qualityGrades).toContain('A')
      expect(lastCall.qualityGrades).toContain('B')
      expect(lastCall.tags).toContain('补气')
      expect(lastCall.confidenceRange.min).toBe(50)
    })
  })

  describe('8. 重置功能', () => {
    it('有活跃筛选条件时应该显示重置按钮', () => {
      render(
        <AdvancedFilter
          {...defaultProps}
          filters={{ ...defaultFilters, qualityGrades: ['A'] }}
        />
      )

      expect(screen.getByText('重置')).toBeInTheDocument()
    })

    it('点击重置应该调用onReset', () => {
      render(
        <AdvancedFilter
          {...defaultProps}
          filters={{ ...defaultFilters, qualityGrades: ['A'] }}
        />
      )

      fireEvent.click(screen.getByText('重置'))
      expect(defaultProps.onReset).toHaveBeenCalledTimes(1)
    })
  })

  describe('9. 应用筛选按钮', () => {
    it('无活跃筛选条件时应用按钮应该被禁用', () => {
      render(<AdvancedFilter {...defaultProps} />)

      const applyButton = screen.getByText('应用筛选').closest('button')
      expect(applyButton?.disabled).toBe(true)
    })

    it('有活跃筛选条件时应用按钮应该可用', () => {
      render(
        <AdvancedFilter
          {...defaultProps}
          filters={{ ...defaultFilters, qualityGrades: ['A'] }}
        />
      )

      const applyButton = screen.getByText('应用筛选')
      expect(applyButton).not.toBeDisabled()
    })

    it('点击应用筛选应该调用onFiltersChange', () => {
      const localFilters = { ...defaultFilters, qualityGrades: ['A'] }
      render(
        <AdvancedFilter
          {...defaultProps}
          filters={localFilters}
        />
      )

      fireEvent.click(screen.getByText('应用筛选'))
      expect(defaultProps.onFiltersChange).toHaveBeenCalled()
    })
  })

  describe('10. 活跃筛选条件计数', () => {
    it('应该正确显示启用的筛选条件数量', () => {
      render(
        <AdvancedFilter
          {...defaultProps}
          filters={{
            ...defaultFilters,
            qualityGrades: ['A', 'B'],
            confidenceRange: { min: 50, max: 100 },
            tags: ['补气'],
          }}
        />
      )

      expect(screen.getByText(/已启用/)).toBeInTheDocument()
      expect(screen.getByText(/个筛选条件/)).toBeInTheDocument()
    })

    it('无筛选条件时应该提示未启用任何筛选', () => {
      render(<AdvancedFilter {...defaultProps} />)

      expect(screen.getByText(/未启用任何筛选条件/)).toBeInTheDocument()
    })
  })
})
