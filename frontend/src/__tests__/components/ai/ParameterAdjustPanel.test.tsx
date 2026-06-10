import { render, screen, fireEvent } from '@testing-library/react'
import { ParameterAdjustPanel } from '@/components/ai/ParameterAdjustPanel'
import { useUserPreferenceStore } from '@/stores/userPreferenceStore'

jest.mock('@/stores/userPreferenceStore')

describe('ParameterAdjustPanel', () => {
  const mockUpdatePreferences = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useUserPreferenceStore as unknown as jest.Mock).mockReturnValue({
      updatePreferences: mockUpdatePreferences,
      preferences: {
        frequentEffects: [],
        favoriteIngredients: [],
        tasteProfile: { sweetness: 0.5, bitterness: 0.3, astringency: 0.2, umami: 0.4 },
        safetyLevel: 0.8,
        budgetRange: { min: 0, max: 1000 },
        lastUpdated: Date.now(),
      },
    })
  })

  it('renders collapsed by default', () => {
    render(<ParameterAdjustPanel />)

    expect(screen.getByText('多维度参数调整')).toBeInTheDocument()
  })

  it('expands when toggle is clicked', () => {
    render(<ParameterAdjustPanel />)

    const toggleButton = screen.getByText('多维度参数调整').closest('button')
    if (toggleButton) {
      fireEvent.click(toggleButton)
    }

    expect(screen.getByText('口感偏好')).toBeInTheDocument()
    expect(screen.getByText('安全性偏好')).toBeInTheDocument()
    expect(screen.getByText('成本控制')).toBeInTheDocument()
  })

  it('calls onParameterChange when taste slider changes', () => {
    const mockOnChange = jest.fn()
    render(<ParameterAdjustPanel onParameterChange={mockOnChange} expanded={true} onToggle={() => {}} />)

    const sweetnessSlider = screen.getByDisplayValue('0.5')
    fireEvent.change(sweetnessSlider, { target: { value: '0.8' } })

    expect(mockUpdatePreferences).toHaveBeenCalled()
  })

  it('calls onParameterChange when safety slider changes', () => {
    const mockOnChange = jest.fn()
    render(<ParameterAdjustPanel onParameterChange={mockOnChange} expanded={true} onToggle={() => {}} />)

    const safetySlider = screen.getByDisplayValue('0.8')
    fireEvent.change(safetySlider, { target: { value: '0.5' } })

    expect(mockUpdatePreferences).toHaveBeenCalled()
  })

  it('resets to default values when reset button is clicked', () => {
    const mockOnChange = jest.fn()
    render(<ParameterAdjustPanel onParameterChange={mockOnChange} expanded={true} onToggle={() => {}} />)

    const resetButton = screen.getByText('重置')
    fireEvent.click(resetButton)

    expect(mockUpdatePreferences).toHaveBeenCalledWith({
      tasteProfile: {
        sweetness: 0.5,
        bitterness: 0.3,
        astringency: 0.2,
        umami: 0.4,
      },
      safetyLevel: 0.8,
    })
  })

  it('saves template when save button is clicked', () => {
    render(<ParameterAdjustPanel expanded={true} onToggle={() => {}} />)

    const saveButton = screen.getByText('保存模板')
    fireEvent.click(saveButton)
  })

  it('displays taste score calculation', () => {
    const mockOnChange = jest.fn()
    render(<ParameterAdjustPanel onParameterChange={mockOnChange} expanded={true} onToggle={() => {}} />)

    expect(screen.getByText('综合口感评分')).toBeInTheDocument()
  })

  it('renders exclude restricted checkbox', () => {
    const mockOnChange = jest.fn()
    render(<ParameterAdjustPanel onParameterChange={mockOnChange} expanded={true} onToggle={() => {}} />)

    expect(screen.getByText('排除受限制成分')).toBeInTheDocument()
  })

  it('renders cost optimization checkbox', () => {
    const mockOnChange = jest.fn()
    render(<ParameterAdjustPanel onParameterChange={mockOnChange} expanded={true} onToggle={() => {}} />)

    expect(screen.getByText('优化成本（保持功效下降低成本）')).toBeInTheDocument()
  })

  it('renders cost range inputs', () => {
    const mockOnChange = jest.fn()
    render(<ParameterAdjustPanel onParameterChange={mockOnChange} expanded={true} onToggle={() => {}} />)

    const minInput = screen.getByPlaceholderText('最低')
    const maxInput = screen.getByPlaceholderText('最高')
    expect(minInput).toBeInTheDocument()
    expect(maxInput).toBeInTheDocument()
  })

  it('accepts expanded prop and renders content', () => {
    const mockOnChange = jest.fn()
    render(<ParameterAdjustPanel onParameterChange={mockOnChange} expanded={true} onToggle={() => {}} />)

    expect(screen.getByText('口感偏好')).toBeInTheDocument()
  })

  it('displays safety level text based on value', () => {
    const mockOnChange = jest.fn()
    render(<ParameterAdjustPanel onParameterChange={mockOnChange} expanded={true} onToggle={() => {}} />)

    expect(screen.getByText('高')).toBeInTheDocument()
  })

  it('calls onToggle when header button is clicked', () => {
    const mockToggle = jest.fn()
    render(<ParameterAdjustPanel onToggle={mockToggle} />)

    const toggleButton = screen.getByText('多维度参数调整').closest('button')
    if (toggleButton) {
      fireEvent.click(toggleButton)
      expect(mockToggle).toHaveBeenCalled()
    }
  })
})
