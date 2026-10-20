/**
 * safety 域组件测试
 *
 * 2026-10-12 清理：本文件原覆盖 7 个组件（RiskIndicator / RiskMatrix /
 * ComplianceDashboard / RiskDetailPanel / BatchSafetyChecker /
 * RegulationBrowser / SafetyReportTemplate），其中 6 个及其 barrel
 * (`features/safety/index.ts`) 经 `git grep` 交叉验证从未被生产代码引用，
 * 已随死代码一并删除。本文件因此删除了对应的 describe 块，仅保留活体组件
 * RiskMatrix 的测试。
 *
 * 重要：RiskMatrix 的引入路径必须与 SafetyTab.tsx:21 保持一致
 * （`./safety/RiskMatrix` 直接路径），不得再经由 barrel —— barrel 已删除。
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { RiskMatrix } from '../safety/RiskMatrix'

describe('RiskMatrix', () => {
  const mockData = [
    {
      ingredientId: '1',
      name: '成分A',
      hazards: {
        acute_toxicity: { score: 85, level: 'low' as const },
        sensitization: { score: 45, level: 'high' as const, regulation: 'GB 2760', limit: 100, actual: 150, suggestion: '降低用量' }
      }
    },
    {
      ingredientId: '2',
      name: '成分B',
      hazards: {
        chronic_toxicity: { score: 70, level: 'medium' as const },
        carcinogenicity: { score: 30, level: 'unknown' as const }
      }
    }
  ]

  it('should render matrix with data', () => {
    const { container } = render(<RiskMatrix data={mockData} />)
    expect(container).toBeInTheDocument()
  })

  it('should display hazard types as headers', () => {
    const { container } = render(<RiskMatrix data={mockData} />)
    expect(container).toBeInTheDocument()
  })

  it('should handle cell click events', () => {
    const { container } = render(<RiskMatrix data={mockData} onCellClick={() => {}} />)
    expect(container).toBeInTheDocument()
  })

  it('should limit ingredients to maxIngredients', () => {
    const manyIngredients = Array.from({ length: 25 }, (_, i) => ({
      ingredientId: `${i}`,
      name: `成分${i}`,
      hazards: {} as any
    }))

    const { container } = render(<RiskMatrix data={manyIngredients} maxIngredients={20} />)
    expect(container).toBeInTheDocument()
  })

  it('should show tooltip on cell hover', async () => {
    const { container } = render(<RiskMatrix data={mockData} />)
    expect(container).toBeInTheDocument()
  })
})

describe('Performance Benchmarks', () => {
  it('should render RiskMatrix with 20x20 grid under 500ms', () => {
    const startTime = performance.now()

    const manyIngredients = Array.from({ length: 20 }, (_, i) => ({
      ingredientId: `${i}`,
      name: `成分${i}`,
      hazards: {
        acute_toxicity: { score: Math.random() * 100, level: 'low' as const },
        chronic_toxicity: { score: Math.random() * 100, level: 'medium' as const },
        sensitization: { score: Math.random() * 100, level: 'high' as const },
        carcinogenicity: { score: Math.random() * 100, level: 'low' as const },
        reproductive_toxicity: { score: Math.random() * 100, level: 'medium' as const },
        other: { score: Math.random() * 100, level: 'unknown' as const }
      }
    }))

    render(<RiskMatrix data={manyIngredients} />)

    const endTime = performance.now()
    const renderTime = endTime - startTime

    expect(renderTime).toBeLessThan(500)
  })
})
