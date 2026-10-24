/**
 * FormulaValidationModal 测试
 *
 * 覆盖：
 * - CRITICAL 阻断时「确认保存」禁用，只能取消
 * - 有 warnings 未阻断时可确认保存
 * - open=false 时不渲染
 */
import '@testing-library/jest-dom'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FormulaValidationModal } from '@/components/ai/features/components/FormulaValidationModal'

const criticalResult = {
  valid: false,
  blocked_by_critical: true,
  risk_score: 88,
  alerts: [
    {
      level: 'critical',
      ingredient: '人参',
      message: '人参用量 30g 超过每日限量 3g',
      recommendation: '减量至 3g 以内',
      blocking: true,
    },
  ],
  ingredients: [
    {
      name: '人参',
      recognized: true,
      food_homology: false,
      toxicity_class: '低毒',
      dosage_status: '超上限',
      safe_dose_range: { min_g: 1, max_g: 3 },
      contraindications: ['孕妇慎用'],
    },
  ],
  recommendations: ['请移除违禁成分'],
}

const warningResult = {
  valid: true,
  blocked_by_critical: false,
  risk_score: 45,
  alerts: [
    {
      level: 'warning',
      ingredient: '甘草',
      message: '甘草用量接近限量',
      recommendation: '建议控制在 6g 以内',
      blocking: false,
    },
  ],
  recommendations: ['甘草用量建议控制在 6g 以内'],
}

describe('FormulaValidationModal', () => {
  it('CRITICAL 阻断时确认保存按钮禁用，取消按钮可关闭', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <FormulaValidationModal
        open
        result={criticalResult}
        formulaName="补气方"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByTestId('formula-validation-modal')).toBeInTheDocument()
    expect(screen.getByText(/校验未通过（CRITICAL）/)).toBeInTheDocument()
    expect(screen.getByText(/人参用量 30g 超过每日限量 3g/)).toBeInTheDocument()

    const confirmButton = screen.getByTestId('validation-confirm-save')
    expect(confirmButton).toBeDisabled()

    fireEvent.click(screen.getByText('取消'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('有 warnings 未阻断时确认保存按钮可用，点击触发 onConfirm', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <FormulaValidationModal
        open
        result={warningResult}
        formulaName="补气方"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByText(/校验通过/)).toBeInTheDocument()
    expect(screen.getByText(/甘草用量接近限量/)).toBeInTheDocument()

    const confirmButton = screen.getByTestId('validation-confirm-save')
    expect(confirmButton).not.toBeDisabled()

    fireEvent.click(confirmButton)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('open=false 或 result 为空时不渲染', () => {
    const { container } = render(
      <FormulaValidationModal open={false} result={null} onConfirm={() => {}} onCancel={() => {}} />,
    )
    expect(container.querySelector('[data-testid="formula-validation-modal"]')).toBeNull()
  })
})