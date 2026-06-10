import { render, screen, fireEvent } from '@testing-library/react'
import { OptimizationAdvisor, ScoreInterpretation } from '@/components/ai/OptimizationAdvisor'

const mockFormula = {
  formulaName: '测试配方',
  effects: ['增强免疫', '降血压'],
  ingredients: [
    { name: '枸杞', dosage: '10g', role: '君药' },
    { name: '黄芪', dosage: '5g', role: '臣药' },
    { name: '山楂', dosage: '3g', role: '佐药' },
  ],
  scores: {
    synergy: 0.75,
    taste: 0.65,
    stability: 0.70,
    safety: 0.85,
    cost: 0.60,
    overall: 0.72,
  },
}

describe('OptimizationAdvisor', () => {
  const mockOnApplySuggestion = jest.fn()
  const mockOnApplyAll = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders optimization advisor with title', () => {
    render(
      <OptimizationAdvisor
        formula={mockFormula}
        onApplySuggestion={mockOnApplySuggestion}
      />
    )

    expect(screen.getByText('智能优化建议')).toBeInTheDocument()
  })

  it('displays suggestion count', () => {
    render(
      <OptimizationAdvisor
        formula={mockFormula}
        onApplySuggestion={mockOnApplySuggestion}
      />
    )

    expect(screen.getByText(/\d+条/)).toBeInTheDocument()
  })

  it('displays high priority count', () => {
    render(
      <OptimizationAdvisor
        formula={mockFormula}
        onApplySuggestion={mockOnApplySuggestion}
      />
    )

    const highPriorityText = screen.getByText(/\d+条高优先级/)
    expect(highPriorityText).toBeInTheDocument()
  })

  it('renders suggestion items', () => {
    render(
      <OptimizationAdvisor
        formula={mockFormula}
        onApplySuggestion={mockOnApplySuggestion}
      />
    )

    expect(screen.getByText(/添加辅助成分增强协同效应/)).toBeInTheDocument()
  })

  it('calls onApplySuggestion when apply button is clicked', () => {
    render(
      <OptimizationAdvisor
        formula={mockFormula}
        onApplySuggestion={mockOnApplySuggestion}
      />
    )

    const applyButton = screen.getAllByText('应用')[0]
    fireEvent.click(applyButton)

    expect(mockOnApplySuggestion).toHaveBeenCalled()
  })

  it('expands suggestion details when clicked', () => {
    render(
      <OptimizationAdvisor
        formula={mockFormula}
        onApplySuggestion={mockOnApplySuggestion}
      />
    )

    const suggestionItem = screen.getByText(/添加辅助成分增强协同效应/).closest('.cursor-pointer')
    if (suggestionItem) {
      fireEvent.click(suggestionItem)
    }

    expect(screen.getByText('优化原理：')).toBeInTheDocument()
  })

  it('shows expected improvement when available', () => {
    render(
      <OptimizationAdvisor
        formula={mockFormula}
        onApplySuggestion={mockOnApplySuggestion}
      />
    )

    const suggestionItem = screen.getByText(/添加辅助成分增强协同效应/).closest('.cursor-pointer')
    if (suggestionItem) {
      fireEvent.click(suggestionItem)
    }

    expect(screen.getByText(/预期提升: \+\d+%/)).toBeInTheDocument()
  })

  it('displays priority badges', () => {
    render(
      <OptimizationAdvisor
        formula={mockFormula}
        onApplySuggestion={mockOnApplySuggestion}
      />
    )

    expect(screen.getByText('高')).toBeInTheDocument()
    expect(screen.getByText('中')).toBeInTheDocument()
    expect(screen.getByText('低')).toBeInTheDocument()
  })

  it('calls onApplyAll when apply all button is clicked', () => {
    render(
      <OptimizationAdvisor
        formula={mockFormula}
        onApplyAll={mockOnApplyAll}
      />
    )

    const applyAllButton = screen.getByText(/应用全部建议/)
    fireEvent.click(applyAllButton)

    expect(mockOnApplyAll).toHaveBeenCalled()
  })

  it('shows optimal state when no suggestions needed', () => {
    const optimalFormula = {
      ...mockFormula,
      scores: {
        synergy: 0.90,
        taste: 0.85,
        stability: 0.88,
        safety: 0.95,
        cost: 0.80,
        overall: 0.88,
      },
    }

    render(
      <OptimizationAdvisor
        formula={optimalFormula}
        onApplySuggestion={mockOnApplySuggestion}
      />
    )

    expect(screen.getByText('当前配方已接近最优')).toBeInTheDocument()
    expect(screen.getByText('暂无明显的优化空间')).toBeInTheDocument()
  })

  it('displays confidence score', () => {
    render(
      <OptimizationAdvisor
        formula={mockFormula}
        onApplySuggestion={mockOnApplySuggestion}
      />
    )

    const suggestionItem = screen.getByText(/添加辅助成分增强协同效应/).closest('.cursor-pointer')
    if (suggestionItem) {
      fireEvent.click(suggestionItem)
    }

    expect(screen.getByText('置信度')).toBeInTheDocument()
  })

  it('displays dosage adjustment when available', () => {
    render(
      <OptimizationAdvisor
        formula={mockFormula}
        onApplySuggestion={mockOnApplySuggestion}
      />
    )

    const suggestionItem = screen.getByText(/优化君药剂量比例/).closest('.cursor-pointer')
    if (suggestionItem) {
      fireEvent.click(suggestionItem)
    }

    expect(screen.getByText('调整建议：')).toBeInTheDocument()
  })
})

describe('ScoreInterpretation', () => {
  it('renders score interpretation correctly', () => {
    render(<ScoreInterpretation scores={mockFormula.scores} />)

    expect(screen.getByText('评分解读')).toBeInTheDocument()
    expect(screen.getByText('协同效应')).toBeInTheDocument()
    expect(screen.getByText('口感风味')).toBeInTheDocument()
    expect(screen.getByText('稳定性')).toBeInTheDocument()
    expect(screen.getByText('安全性')).toBeInTheDocument()
    expect(screen.getByText('成本效益')).toBeInTheDocument()
    expect(screen.getByText('综合评分')).toBeInTheDocument()
  })

  it('displays score levels correctly', () => {
    render(<ScoreInterpretation scores={mockFormula.scores} />)

    expect(screen.getByText('良好')).toBeInTheDocument()
  })

  it('renders optimization suggestions', () => {
    render(<ScoreInterpretation scores={mockFormula.scores} />)

    expect(screen.getByText('优化建议')).toBeInTheDocument()
  })

  it('displays all score values', () => {
    render(<ScoreInterpretation scores={mockFormula.scores} />)

    expect(screen.getByText('0.75')).toBeInTheDocument()
    expect(screen.getByText('0.65')).toBeInTheDocument()
    expect(screen.getByText('0.70')).toBeInTheDocument()
  })
})
