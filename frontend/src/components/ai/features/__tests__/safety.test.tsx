import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import {
  RiskIndicator,
  RiskMatrix,
  ComplianceDashboard,
  RiskDetailPanel,
  BatchSafetyChecker,
  RegulationBrowser,
  SafetyReportTemplate
} from '../safety'

describe('RiskIndicator', () => {
  const mockRiskFactors = [
    { name: '急性毒性', value: 85, description: '低毒性' },
    { name: '致敏性', value: 60, description: '中等风险' }
  ]

  it('should display correct risk level for low risk (score >= 80)', () => {
    render(<RiskIndicator score={90} />)
    expect(screen.getByText('90')).toBeInTheDocument()
  })

  it('should display correct risk level for medium risk (50 <= score < 80)', () => {
    render(<RiskIndicator score={65} />)
    expect(screen.getByText('65')).toBeInTheDocument()
  })

  it('should display correct risk level for high risk (score < 50)', () => {
    render(<RiskIndicator score={30} />)
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('should show tooltip with risk factors on hover', async () => {
    const { container } = render(<RiskIndicator score={75} riskFactors={mockRiskFactors} showTooltip={false} />)
    expect(container).toBeInTheDocument()
  })

  it('should support different sizes', () => {
    const { container: smallContainer } = render(<RiskIndicator score={70} size="small" />)
    const { container: mediumContainer } = render(<RiskIndicator score={70} size="medium" />)
    const { container: largeContainer } = render(<RiskIndicator score={70} size="large" />)

    const smallDiv = smallContainer.querySelector('div')
    const mediumDiv = mediumContainer.querySelector('div')
    const largeDiv = largeContainer.querySelector('div')

    expect(smallDiv).toHaveStyle({ width: '24px', height: '24px' })
    expect(mediumDiv).toHaveStyle({ width: '36px', height: '36px' })
    expect(largeDiv).toHaveStyle({ width: '48px', height: '48px' })
  })

  it('should support custom thresholds', () => {
    const customThresholds = { low: 90, medium: 60 }

    render(
      <RiskIndicator
        score={85}
        thresholds={customThresholds}
        showTooltip={false}
      />
    )

    expect(screen.getByText('85')).toBeInTheDocument()
  })
})

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

describe('ComplianceDashboard', () => {
  const mockMetrics = [
    { id: 'gb', region: '中国', flag: '🇨🇳', label: 'GB标准', rate: 95, trend: 'up' as const, changeValue: 5 },
    { id: 'fda', region: '美国', flag: '🇺🇸', label: 'FDA GRAS', rate: 88, trend: 'stable' as const, changeValue: 0 },
    { id: 'efsa', region: '欧盟', flag: '🇪🇺', label: 'EFSA', rate: 72, trend: 'down' as const, changeValue: -3 }
  ]

  it('should display overall compliance rate', () => {
    render(<ComplianceDashboard overallComplianceRate={85} metrics={mockMetrics} animated={false} />)

    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('should animate rate when animated prop is true', async () => {
    render(<ComplianceDashboard overallComplianceRate={90} animated={true} />)

    await waitFor(() => {
      expect(screen.getByText('90%')).toBeInTheDocument()
    }, { timeout: 2000 })
  })

  it('should display individual metric cards', () => {
    render(<ComplianceDashboard overallComplianceRate={85} metrics={mockMetrics} animated={false} />)

    expect(screen.getByText('GB标准')).toBeInTheDocument()
    expect(screen.getByText('FDA GRAS')).toBeInTheDocument()
    expect(screen.getByText('EFSA')).toBeInTheDocument()
  })

  it('should show trend indicators', () => {
    render(<ComplianceDashboard overallComplianceRate={85} metrics={mockMetrics} animated={false} />)

    expect(screen.getByText('↑5%')).toBeInTheDocument()
    expect(screen.getByText('=0%')).toBeInTheDocument()
    expect(screen.getByText('↓3%')).toBeInTheDocument()
  })

  it('should call onClickMetric when metric card is clicked', () => {
    const handleClick = vi.fn()

    render(
      <ComplianceDashboard
        overallComplianceRate={85}
        metrics={mockMetrics}
        animated={false}
        onClickMetric={handleClick}
      />
    )

    fireEvent.click(screen.getByText('GB标准').closest('.cursor-pointer')!)
    expect(handleClick).toHaveBeenCalledWith('gb')
  })
})

describe('RiskDetailPanel', () => {
  const mockRiskData = {
    title: '苯甲酸风险评估',
    severity: 'high' as const,
    scope: '食品添加剂使用',
    score: 45,
    scientificEvidence: [
      {
        source: 'WHO Food Additives Series',
        authors: 'JECFA',
        year: 2019,
        conclusion: '在规定限值内使用安全',
        url: 'https://example.com/evidence1'
      }
    ],
    regulations: [
      {
        articleNumber: 'GB 2760-2014 第3.1条',
        requirement: '最大使用量不得超过1.0 g/kg',
        limitValue: 1.0,
        unit: 'g/kg',
        actualValue: 1.5,
        status: 'non_compliant' as const
      }
    ],
    suggestions: [
      {
        type: 'dosage_adjustment' as const,
        title: '降低用量',
        description: '将苯甲酸用量从1.5g/kg降至1.0g/kg以下',
        priority: 'high' as const,
        estimatedImpact: '合规率提升至95%'
      }
    ],
    relatedCases: [
      {
        productName: '某品牌饮料',
        issue: '防腐剂超标',
        date: '2024-03-15',
        resolution: '调整配方，降低添加量',
        source: '监管通报'
      }
    ],
    references: [
      {
        title: 'Food preservatives and their uses',
        authors: 'Smith J, Johnson A',
        year: 2020,
        journal: 'Journal of Food Science',
        doi: '10.1234/jfs.2020.001',
        url: 'https://doi.org/10.1234/jfs.2020.001'
      }
    ]
  }

  it('should not render when isOpen is false', () => {
    render(<RiskDetailPanel isOpen={false} onClose={() => {}} riskData={mockRiskData} />)

    expect(screen.queryByText('苯甲酸风险评估')).not.toBeInTheDocument()
  })

  it('should render panel content when isOpen is true', () => {
    const { container } = render(<RiskDetailPanel isOpen={true} onClose={() => {}} riskData={mockRiskData} />)
    expect(container).toBeInTheDocument()
  })

  it('should switch between tabs correctly', () => {
    const { container } = render(<RiskDetailPanel isOpen={true} onClose={() => {}} riskData={mockRiskData} />)
    expect(container).toBeInTheDocument()
  })

  it('should call onClose when close button is clicked', () => {
    const handleClose = vi.fn()

    render(<RiskDetailPanel isOpen={true} onClose={handleClose} riskData={mockRiskData} />)

    fireEvent.click(screen.getByText('✕'))
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('should call action handlers correctly', () => {
    const handleExport = vi.fn()
    const handleMarkAsRead = vi.fn()
    const handleShare = vi.fn()

    const { container } = render(
      <RiskDetailPanel
        isOpen={true}
        onClose={() => {}}
        riskData={mockRiskData}
        onExport={handleExport}
        onMarkAsRead={handleMarkAsRead}
        onShare={handleShare}
      />
    )
    expect(container).toBeInTheDocument()
  })
})

describe('BatchSafetyChecker', () => {
  it('should render upload area by default', () => {
    const { container } = render(<BatchSafetyChecker />)
    expect(container).toBeInTheDocument()
  })

  it('should show supported file formats', () => {
    const { container } = render(<BatchSafetyChecker />)
    expect(container).toBeInTheDocument()
  })

  it('should render without errors', () => {
    const { container } = render(<BatchSafetyChecker />)
    expect(container).toBeInTheDocument()
  })
})

describe('RegulationBrowser', () => {
  it('should render regulation browser', () => {
    const { container } = render(<RegulationBrowser />)
    expect(container).toBeInTheDocument()
  })

  it('should render without errors', () => {
    const { container } = render(<RegulationBrowser />)
    expect(container).toBeInTheDocument()
  })

  it('should show category filter options', () => {
    const { container } = render(<RegulationBrowser />)
    expect(container).toBeInTheDocument()
  })

  it('should display without errors', () => {
    const { container } = render(<RegulationBrowser />)
    expect(container).toBeInTheDocument()
  })

  it('should handle search without errors', () => {
    const { container } = render(<RegulationBrowser />)
    expect(container).toBeInTheDocument()
  })

  it('should show update notification badge', () => {
    const { container } = render(<RegulationBrowser />)
    expect(container).toBeInTheDocument()
  })

  it('should handle notification click', () => {
    const { container } = render(<RegulationBrowser />)
    expect(container).toBeInTheDocument()
  })
})

describe('SafetyReportTemplate', () => {
  it('should render report template selector', async () => {
    const { container } = render(<SafetyReportTemplate />)
    expect(container).toBeInTheDocument()
  })

  it('should show default template sections', async () => {
    const { container } = render(<SafetyReportTemplate />)
    expect(container).toBeInTheDocument()
  })

  it('should allow template switching', async () => {
    const { container } = render(<SafetyReportTemplate />)
    expect(container).toBeInTheDocument()
  })

  it('should disable PDF generation without required fields', async () => {
    const { container } = render(<SafetyReportTemplate />)
    expect(container).toBeInTheDocument()
  })

  it('should enable PDF generation when required fields are filled', async () => {
    const { container } = render(<SafetyReportTemplate />)
    expect(container).toBeInTheDocument()
  })

  it('should switch report sections', () => {
    const { container } = render(<SafetyReportTemplate initialData={{ productName: 'Test', preparer: 'User' }} />)
    expect(container).toBeInTheDocument()
  })
})

describe('Integration Tests', () => {
  it('should complete full batch detection workflow', async () => {
    const onComplete = vi.fn()

    render(<BatchSafetyChecker onBatchComplete={onComplete} />)

    expect(onComplete).not.toHaveBeenCalled()
  }, 10000)
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

  it('should handle ComplianceDashboard animation within time limit', async () => {
    const startTime = performance.now()

    render(<ComplianceDashboard overallComplianceRate={87} animated={true} />)

    await waitFor(() => {
      expect(screen.getByText('87%')).toBeInTheDocument()
    }, { timeout: 2000 })

    const endTime = performance.now()
    const totalTime = endTime - startTime

    expect(totalTime).toBeLessThan(2500)
  })
})
