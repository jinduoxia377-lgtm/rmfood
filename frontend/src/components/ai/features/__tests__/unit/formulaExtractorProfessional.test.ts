/**
 * formulaExtractorService 专业配方设计卡字段提取测试（四期）
 *
 * 覆盖：
 * - data-table 新列：nature_flavor / active_compound / mechanism
 * - timeline → dosageAdvice（服用周期）
 * - list SOP（variant=number）→ productionSteps
 * - list 参考文献（variant=analysis）→ references
 * - callout 监测与迭代建议 → monitoringAdvice
 */
import { describe, it, expect } from 'vitest'
import { extractFormulaFromContent } from '@/components/ai/features/services/formulaExtractorService'
import type { StructuredContent } from '@/components/ai/features/components/structured/types'

const professionalContent: StructuredContent = {
  responseType: 'recommendation',
  title: '黄芪当归气血双补方',
  blocks: [
    {
      type: 'header',
      data: { title: '黄芪当归气血双补方', description: '益气养血', level: 1 },
    },
    {
      type: 'data-table',
      data: {
        title: '配方组成',
        columns: [
          { key: 'role', label: '角色' },
          { key: 'name', label: '成分' },
          { key: 'dosage', label: '用量(g)' },
          { key: 'nature_flavor', label: '性味归经' },
          { key: 'active_compound', label: '功效成分' },
          { key: 'mechanism', label: '作用机理' },
        ],
        rows: [
          { role: '君', name: '黄芪', dosage: '15', nature_flavor: '甘，微温；归脾、肺经', active_compound: '黄芪多糖', mechanism: '调节免疫' },
          { role: '臣', name: '当归', dosage: '9', nature_flavor: '甘、辛，温', active_compound: '阿魏酸', mechanism: '补血活血' },
        ],
      },
    },
    {
      type: 'timeline',
      data: {
        title: '服用周期',
        duration_days: 28,
        phases: [{ key: '初期', label: '初期', days: [1, 7] }],
        items: [{ day: 1, phase: '初期', title: '适应期', description: '观察消化', dosage: '每日1次，每次1袋' }],
      },
    },
    {
      type: 'list',
      data: {
        title: '制备工艺SOP',
        variant: 'number',
        items: [
          { label: '称量', description: '精确称量各成分' },
          { label: '煎煮', description: '加800ml水，文火30分钟' },
        ],
      },
    },
    {
      type: 'callout',
      data: { variant: 'info', title: '监测与迭代建议', content: '建议2周后复查精力与睡眠；如不适请停用并咨询医师。' },
    },
    {
      type: 'list',
      data: {
        title: '参考文献',
        variant: 'analysis',
        items: [
          { label: '《中国药典》2025年版一部' },
          { label: '黄芪多糖免疫调节机制研究' },
        ],
      },
    },
  ],
}

describe('extractFormulaFromContent 专业字段提取', () => {
  it('提取 data-table 的性味归经/功效成分/作用机理', () => {
    const formula = extractFormulaFromContent(professionalContent)
    expect(formula).not.toBeNull()
    expect(formula!.ingredients[0]).toMatchObject({
      name: '黄芪',
      dosage: '15',
      role: '君',
      natureFlavor: '甘，微温；归脾、肺经',
      activeCompound: '黄芪多糖',
      mechanism: '调节免疫',
    })
    expect(formula!.ingredients[1]).toMatchObject({
      name: '当归',
      activeCompound: '阿魏酸',
      mechanism: '补血活血',
    })
  })

  it('从 timeline 提取服用周期到 dosageAdvice', () => {
    const formula = extractFormulaFromContent(professionalContent)
    expect(formula!.dosageAdvice).toContain('28')
    expect(formula!.dosageAdvice).toContain('每日1次，每次1袋')
  })

  it('从 list 提取工艺 SOP 到 productionSteps', () => {
    const formula = extractFormulaFromContent(professionalContent)
    expect(formula!.productionSteps?.length).toBe(2)
    expect(formula!.productionSteps![0]).toContain('称量')
    expect(formula!.productionSteps![1]).toContain('煎煮')
  })

  it('从 callout 提取监测与迭代建议到 monitoringAdvice', () => {
    const formula = extractFormulaFromContent(professionalContent)
    expect(formula!.monitoringAdvice).toContain('建议2周后复查精力与睡眠')
  })

  it('从 list 参考文献提取 references', () => {
    const formula = extractFormulaFromContent(professionalContent)
    expect(formula!.references).toContain('《中国药典》2025年版一部')
    expect(formula!.references).toContain('黄芪多糖免疫调节机制研究')
  })

  it('旧协议 data-table（仅 name/dosage/function）仍兼容', () => {
    const legacy: StructuredContent = {
      responseType: 'general',
      blocks: [
        {
          type: 'data-table',
          data: {
            columns: [
              { key: 'name', label: '成分' },
              { key: 'dosage', label: '用量(g)' },
              { key: 'function', label: '功效' },
            ],
            rows: [{ name: '枸杞', dosage: '10', function: '滋补肝肾' }],
          },
        },
      ],
    }
    const formula = extractFormulaFromContent(legacy)
    expect(formula!.ingredients[0]).toMatchObject({ name: '枸杞', dosage: '10', function: '滋补肝肾' })
    expect(formula!.ingredients[0].natureFlavor).toBeUndefined()
  })
})