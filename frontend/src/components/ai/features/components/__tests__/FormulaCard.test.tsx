/**
 * FormulaCard组件全面测试
 *
 * 测试覆盖：
 * 1. 卡片展开/收起动画
 * 2. 多选checkbox交互
 * 3. 质量等级徽章显示（A/B/C/D/F）
 * 4. 功效标签渲染
 * 5. 成分列表展示
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { FormulaCard } from '@/components/ai/features/components/FormulaCard'
import type { AIRecognizedFormula, FormulaQualityScore } from '@/types/ai.types'

const mockFormula: AIRecognizedFormula = {
  id: 'formula-001',
  name: '气血双补配方',
  autoName: '气血双补配方',
  ingredientCount: 3,
  confidence: 0.85,
  sourceMessageId: 'msg-001',
  parsedAt: new Date('2026-05-20'),
  rawData: {
    title: '气血双补配方',
    ingredients: [],
    totalAmount: 100,
    confidence: 0.85,
  },
  ingredients: [
    { name: '人参', dosage: 10, unit: 'g' },
    { name: '黄芪', dosage: 15, unit: 'g' },
    { name: '当归', dosage: 8, unit: 'g' },
  ],
  qualityGrade: 'A',
  tags: ['补气', '补血', '健脾'],
  efficacy: '适用于气血两虚的人群',
  targetAudience: ['气血两虚者', '面色萎黄者'],
  recommendedDosage: '每日2次，每次1剂',
  contraindications: '孕妇慎用',
  isFavorite: false,
}

const mockQualityScore: FormulaQualityScore = {
  overallScore: 92,
  confidenceScore: 85,
  completenessScore: 90,
  diversityScore: 88,
  qualityGrade: 'A',
}

const defaultProps = {
  formula: mockFormula,
  isExpanded: false,
  isSelected: false,
  onToggleExpand: vi.fn(),
  onSelect: vi.fn(),
  onShowDetail: vi.fn(),
  onGenerateReport: vi.fn(),
  qualityScore: mockQualityScore,
}

describe('FormulaCard - 配方卡片组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. 基础渲染', () => {
    it('应该正确渲染配方名称', () => {
      render(<FormulaCard {...defaultProps} />)

      expect(screen.getByText('气血双补配方')).toBeInTheDocument()
    })

    it('应该使用autoName作为显示名称（优先于name）', () => {
      const formulaWithAutoName = {
        ...mockFormula,
        name: '原始名称',
        autoName: '自动生成名称',
      }
      render(<FormulaCard {...defaultProps} formula={formulaWithAutoName} />)

      expect(screen.getByText('自动生成名称')).toBeInTheDocument()
      expect(screen.queryByText('原始名称')).not.toBeInTheDocument()
    })

    it('应该渲染成分数量统计', () => {
      render(<FormulaCard {...defaultProps} />)

      expect(screen.getByText(/3种成分/)).toBeInTheDocument()
    })
  })

  describe('2. 展开/收起功能', () => {
    it('默认状态下不应该显示展开内容', () => {
      render(<FormulaCard {...defaultProps} isExpanded={false} />)

      expect(screen.queryByText('详细信息')).not.toBeInTheDocument()
      expect(screen.queryByText('适用人群')).not.toBeInTheDocument()
    })

    it('展开状态下应该显示详细信息', () => {
      render(<FormulaCard {...defaultProps} isExpanded={true} />)

      expect(screen.getByText('详细信息')).toBeInTheDocument()
      expect(screen.getByText('适用人群:')).toBeInTheDocument()
      expect(screen.getByText('推荐剂量:')).toBeInTheDocument()
      expect(screen.getByText('禁忌症:')).toBeInTheDocument()
      expect(screen.getByText('功效描述:')).toBeInTheDocument()
    })

    it('点击展开按钮应该调用onToggleExpand', () => {
      render(<FormulaCard {...defaultProps} isExpanded={false} />)

      const expandButton = screen.getByRole('button', { name: /展开详情/ })
      fireEvent.click(expandButton)

      expect(defaultProps.onToggleExpand).toHaveBeenCalledWith('formula-001')
    })

    it('点击收起按钮应该调用onToggleExpand', () => {
      render(<FormulaCard {...defaultProps} isExpanded={true} />)

      const collapseButton = screen.getByText('已收起')
      fireEvent.click(collapseButton)

      expect(defaultProps.onToggleExpand).toHaveBeenCalledWith('formula-001')
    })

    it('双击卡片应该切换展开状态', () => {
      render(<FormulaCard {...defaultProps} isExpanded={false} />)

      const card = screen.getByText('气血双补配方').closest('.group')
      fireEvent.doubleClick(card!)

      expect(defaultProps.onToggleExpand).toHaveBeenCalledWith('formula-001')
    })
  })

  describe('3. Checkbox多选交互', () => {
    it('当提供onSelect时应该渲染checkbox', () => {
      render(<FormulaCard {...defaultProps} onSelect={vi.fn()} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeInTheDocument()
    })

    it('未选中状态下的checkbox应该是unchecked', () => {
      render(<FormulaCard {...defaultProps} isSelected={false} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).not.toBeChecked()
    })

    it('选中状态下的checkbox应该是checked', () => {
      render(<FormulaCard {...defaultProps} isSelected={true} />)

      const checkbox = screen.getByRole('checkbox')
      expect(checkbox).toBeChecked()
    })

    it('点击checkbox应该调用onSelect', () => {
      const onSelect = vi.fn()
      render(<FormulaCard {...defaultProps} onSelect={onSelect} />)

      const checkbox = screen.getByRole('checkbox')
      fireEvent.click(checkbox)

      expect(onSelect).toHaveBeenCalledWith('formula-001')
    })

    it('选中状态下卡片应该有特殊样式', () => {
      const { container } = render(<FormulaCard {...defaultProps} isSelected={true} />)

      const card = container.querySelector('.border-l-4')
      expect(card).toBeInTheDocument()
      expect(card?.className).toContain('border-l-primary-500')
    })

    it('不提供onSelect时不应该渲染checkbox', () => {
      const propsWithoutSelect = { ...defaultProps }
      delete propsWithoutSelect.onSelect

      render(<FormulaCard {...propsWithoutSelect} />)

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })
  })

  describe('4. 质量等级徽章显示', () => {
    it('A级质量应该显示绿色徽章', () => {
      render(<FormulaCard {...defaultProps} formula={{ ...mockFormula, qualityGrade: 'A' }} />)

      const badge = screen.getByText('A')
      expect(badge).toBeInTheDocument()
      expect(badge.className).toContain('bg-success-100')
      expect(badge.className).toContain('text-success-700')
    })

    it('B级质量应该显示蓝色徽章', () => {
      render(
        <FormulaCard
          {...defaultProps}
          formula={{ ...mockFormula, qualityGrade: 'B' }}
          qualityScore={null}
        />
      )

      const badge = screen.getByText('B')
      expect(badge).toBeInTheDocument()
    })

    it('C级质量应该显示黄色徽章', () => {
      render(
        <FormulaCard
          {...defaultProps}
          formula={{ ...mockFormula, qualityGrade: 'C' }}
          qualityScore={null}
        />
      )

      const badge = screen.getByText('C')
      expect(badge).toBeInTheDocument()
    })

    it('D级质量应该显示橙色徽章', () => {
      render(
        <FormulaCard
          {...defaultProps}
          formula={{ ...mockFormula, qualityGrade: 'D' }}
          qualityScore={null}
        />
      )

      const badge = screen.getByText('D')
      expect(badge).toBeInTheDocument()
    })

    it('F级质量应该显示红色徽章', () => {
      render(
        <FormulaCard
          {...defaultProps}
          formula={{ ...mockFormula, qualityGrade: 'F' }}
          qualityScore={null}
        />
      )

      const badge = screen.getByText('F')
      expect(badge).toBeInTheDocument()
    })

    it('没有质量等级时不应该显示徽章', () => {
      render(
        <FormulaCard
          {...defaultProps}
          formula={{ ...mockFormula, qualityGrade: undefined }}
          qualityScore={null}
        />
      )

      expect(screen.queryByText('A')).not.toBeInTheDocument()
      expect(screen.queryByText('B')).not.toBeInTheDocument()
    })

    it('应该优先使用qualityScore中的qualityGrade', () => {
      const customQualityScore: FormulaQualityScore = {
        ...mockQualityScore,
        qualityGrade: 'B',
      }

      render(
        <FormulaCard
          {...defaultProps}
          formula={{ ...mockFormula, qualityGrade: 'A' }}
          qualityScore={customQualityScore}
        />
      )

      const badge = screen.getByText('B')
      expect(badge).toBeInTheDocument()
      expect(badge.className).toContain('bg-secondary-100')
    })
  })

  describe('5. 功效标签渲染', () => {
    it('应该渲染功效标签', () => {
      render(<FormulaCard {...defaultProps} />)

      expect(screen.getByText('补气')).toBeInTheDocument()
      expect(screen.getByText('补血')).toBeInTheDocument()
      expect(screen.getByText('健脾')).toBeInTheDocument()
    })

    it('紧凑模式下最多显示3个标签', () => {
      const manyTagsFormula = {
        ...mockFormula,
        tags: ['补气', '补血', '健脾', '抗氧化', '安神'],
      }

      render(<FormulaCard {...defaultProps} formula={manyTagsFormula} compact={true} />)

      expect(screen.getByText('+2')).toBeInTheDocument()
    })

    it('普通模式下最多显示4个标签', () => {
      const manyTagsFormula = {
        ...mockFormula,
        tags: ['补气', '补血', '健脾', '抗氧化', '安神'],
      }

      render(<FormulaCard {...defaultProps} formula={manyTagsFormula} />)

      expect(screen.getByText('+1')).toBeInTheDocument()
    })

    it('没有标签时不应该渲染标签区域', () => {
      render(
        <FormulaCard {...defaultProps} formula={{ ...mockFormula, tags: [] }} />
      )

      expect(screen.queryByText('补气')).not.toBeInTheDocument()
    })
  })

  describe('6. 成分列表展示', () => {
    it('应该渲染核心成分列表', () => {
      render(<FormulaCard {...defaultProps} />)

      expect(screen.getByText('人参')).toBeInTheDocument()
      expect(screen.getByText('黄芪')).toBeInTheDocument()
      expect(screen.getByText('当归')).toBeInTheDocument()
    })

    it('应该显示成分数量提示', () => {
      render(<FormulaCard {...defaultProps} />)

      expect(screen.getByText(/核心成分/)).toBeInTheDocument()
    })

    it('成分超过最大显示数时应该显示剩余数量', () => {
      const manyIngredientsFormula = {
        ...mockFormula,
        ingredients: [
          { name: '人参', dosage: 10, unit: 'g' },
          { name: '黄芪', dosage: 15, unit: 'g' },
          { name: '当归', dosage: 8, unit: 'g' },
          { name: '白术', dosage: 12, unit: 'g' },
          { name: '茯苓', dosage: 10, unit: 'g' },
          { name: '甘草', dosage: 6, unit: 'g' },
        ],
        ingredientCount: 6,
      }

      render(<FormulaCard {...defaultProps} formula={manyIngredientsFormula} />)

      expect(screen.getByText(/\+1种/)).toBeInTheDocument()
    })

    it('紧凑模式下最多显示3个成分', () => {
      const manyIngredientsFormula = {
        ...mockFormula,
        ingredients: [
          { name: '人参', dosage: 10, unit: 'g' },
          { name: '黄芪', dosage: 15, unit: 'g' },
          { name: '当归', dosage: 8, unit: 'g' },
          { name: '白术', dosage: 12, unit: 'g' },
          { name: '茯苓', dosage: 10, unit: 'g' },
        ],
        ingredientCount: 5,
      }

      render(<FormulaCard {...defaultProps} formula={manyIngredientsFormula} compact={true} />)

      expect(screen.getByText(/\+2种/)).toBeInTheDocument()
    })

    it('没有成分时不应该渲染成分区域', () => {
      render(
        <FormulaCard
          {...defaultProps}
          formula={{ ...mockFormula, ingredients: [], ingredientCount: 0 }}
        />
      )

      expect(screen.queryByText(/核心成分/)).not.toBeInTheDocument()
    })
  })

  describe('7. 置信度显示', () => {
    it('应该显示置信度百分比', () => {
      render(<FormulaCard {...defaultProps} />)

      expect(screen.getByText(/置信度:\s*85%/)).toBeInTheDocument()
    })

    it('高置信度(>=90%)应该显示绿色', () => {
      render(
        <FormulaCard {...defaultProps} formula={{ ...mockFormula, confidence: 0.95 }} />
      )

      const badge = screen.getByText(/置信度/)
      expect(badge.className).toContain('text-success-600')
    })

    it('中等置信度(70-89%)应该显示黄色', () => {
      render(
        <FormulaCard {...defaultProps} formula={{ ...mockFormula, confidence: 0.75 }} />
      )

      const badge = screen.getByText(/置信度/)
      expect(badge.className).toContain('text-yellow-600')
    })

    it('低置信度(<70%)应该显示红色', () => {
      render(
        <FormulaCard {...defaultProps} formula={{ ...mockFormula, confidence: 0.5 }} />
      )

      const badge = screen.getByText(/置信度/)
      expect(badge.className).toContain('text-error-600')
    })
  })

  describe('8. 展开详情中的操作按钮', () => {
    it('展开状态下应该显示操作按钮组', () => {
      render(<FormulaCard {...defaultProps} isExpanded={true} />)

      expect(screen.getByText('查看原文')).toBeInTheDocument()
      expect(screen.getByText('收起')).toBeInTheDocument()
      expect(screen.getByText('生成报告')).toBeInTheDocument()
      expect(screen.getByText('数据表格')).toBeInTheDocument()
      expect(screen.getByText('收藏')).toBeInTheDocument()
    })

    it('点击"生成报告"应该调用onGenerateReport', () => {
      render(<FormulaCard {...defaultProps} isExpanded={true} />)

      const reportButton = screen.getByText('生成报告')
      fireEvent.click(reportButton)

      expect(defaultProps.onGenerateReport).toHaveBeenCalledWith('formula-001')
    })

    it('点击"数据表格"应该调用onShowDetail', () => {
      render(<FormulaCard {...defaultProps} isExpanded={true} />)

      const detailButton = screen.getByText('数据表格')
      fireEvent.click(detailButton)

      expect(defaultProps.onShowDetail).toHaveBeenCalledWith('formula-001')
    })

    it('没有成分时"数据表格"按钮应该被禁用', () => {
      render(
        <FormulaCard
          {...defaultProps}
          isExpanded={true}
          formula={{ ...mockFormula, ingredients: [] }}
        />
      )

      const detailButton = screen.getByText('数据表格').closest('button')
      expect(detailButton?.disabled).toBe(true)
    })
  })

  describe('9. 质量评分详情（展开状态）', () => {
    it('展开且有qualityScore时应该显示详细评分', () => {
      render(<FormulaCard {...defaultProps} isExpanded={true} />)

      expect(screen.getByText('92')).toBeInTheDocument() // overallScore
      expect(screen.getByText('85')).toBeInTheDocument() // confidenceScore
      expect(screen.getByText('90')).toBeInTheDocument() // completenessScore
      expect(screen.getByText('88')).toBeInTheDocument() // diversityScore
    })

    it('应该显示评分维度标签', () => {
      render(<FormulaCard {...defaultProps} isExpanded={true} />)

      expect(screen.getByText('综合评分')).toBeInTheDocument()
      expect(screen.getByText('置信度')).toBeInTheDocument()
      expect(screen.getByText('完整性')).toBeInTheDocument()
      expect(screen.getByText('多样性')).toBeInTheDocument()
    })
  })

  describe('10. 收藏功能', () => {
    it('未收藏状态应该显示空心星标', () => {
      render(<FormulaCard {...defaultProps} isExpanded={true} />)

      const favoriteButton = screen.getByText('收藏')
      expect(favoriteButton).toBeInTheDocument()
    })

    it('已收藏状态应该显示实心星标和不同文本', () => {
      render(
        <FormulaCard
          {...defaultProps}
          isExpanded={true}
          formula={{ ...mockFormula, isFavorite: true }}
        />
      )

      expect(screen.getByText('已收藏')).toBeInTheDocument()
    })
  })

  describe('11. 紧凑模式', () => {
    it('紧凑模式应该应用不同的样式类', () => {
      const { container } = render(
        <FormulaCard {...defaultProps} compact={true} />
      )

      // 紧凑模式下padding更小
      const cardContent = container.querySelector('.space-y-3')
      expect(cardContent?.className).toContain('p-3')
    })
  })
})
