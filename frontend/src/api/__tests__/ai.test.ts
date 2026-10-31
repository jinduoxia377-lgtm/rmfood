/**
 * AI 配方校验 / 药材知识检索 API 测试
 *
 * 验证：
 * - validateAiFormula 调用 POST /api/v1/ai/formula/validate（axios 实例 baseURL=/api/v1，路径相对 /api/v1）
 * - retrieveHerbKnowledge 调用 POST /api/v1/ai/formula/knowledge
 * - repairStructuredFormula 调用 POST /api/v1/ai/formula/repair-structured
 * - submitFormulaFeedback 调用 POST /api/v1/ai/formula/feedback
 * - getFormulaFeedback 调用 GET /api/v1/ai/formula/{formula_id}/feedback
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import api from '@/api/client'
import {
  validateAiFormula,
  retrieveHerbKnowledge,
  repairStructuredFormula,
  submitFormulaFeedback,
  getFormulaFeedback,
} from '@/api/ai'

vi.mock('@/api/client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

describe('AI 配方智能校验/知识检索 API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('validateAiFormula 应 POST /ai/formula/validate 并携带成分 payload', async () => {
    const mockResponse = {
      data: {
        valid: true,
        blocked_by_critical: false,
        risk_score: 12,
        alerts: [],
        recommendations: ['整体安全性良好，可正常使用。'],
      },
    }
    vi.mocked(api.post).mockResolvedValue(mockResponse)

    const result = await validateAiFormula({
      formula_name: '补气方',
      ingredients: [
        { name: '黄芪', dosage_g: 15 },
        { name: '当归', dosage_g: 10 },
      ],
      target_effects: ['补气'],
    })

    expect(api.post).toHaveBeenCalledWith(
      '/ai/formula/validate',
      {
        formula_name: '补气方',
        ingredients: [
          { name: '黄芪', dosage_g: 15 },
          { name: '当归', dosage_g: 10 },
        ],
        target_effects: ['补气'],
      },
    )
    expect(result.blocked_by_critical).toBe(false)
    expect(result.valid).toBe(true)
  })

  it('retrieveHerbKnowledge 应 POST /ai/formula/knowledge 并返回 items', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        query: '枸杞',
        total: 1,
        items: [
          {
            name_cn: '枸杞',
            name_latin: 'Lycium barbarum',
            effects: ['滋补肝肾', '益精明目'],
            active_ingredients: ['枸杞多糖'],
            safe_dose_range: { min_g: 6, max_g: 12 },
            contraindications: ['外邪实热者慎用'],
            food_homology: true,
            source: '平台原料库',
          },
        ],
      },
    })

    const result = await retrieveHerbKnowledge('枸杞')

    expect(api.post).toHaveBeenCalledWith('/ai/formula/knowledge', { query: '枸杞' })
    expect(result.total).toBe(1)
    expect(result.items[0].name_cn).toBe('枸杞')
    expect(result.items[0].food_homology).toBe(true)
  })
})

describe('AI 结构化修复 / 反馈闭环 API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('repairStructuredFormula 应 POST /ai/formula/repair-structured 并携带 content 与 formula_name', async () => {
    const mockResponse = {
      data: {
        success: true,
        structured: {
          blocks: [
            { type: 'header', data: { title: '补气方' } },
            { type: 'data-table', data: { columns: [], rows: [] } },
          ],
        },
      },
    }
    vi.mocked(api.post).mockResolvedValue(mockResponse)

    const result = await repairStructuredFormula('黄芪15g、当归10g', '补气方')

    expect(api.post).toHaveBeenCalledWith('/ai/formula/repair-structured', {
      content: '黄芪15g、当归10g',
      formula_name: '补气方',
    })
    expect(result.success).toBe(true)
    expect(result.structured?.blocks).toHaveLength(2)
    expect(result.structured?.blocks[0].type).toBe('header')
  })

  it('repairStructuredFormula 未传 formula_name 时 payload 只含 content', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: false, structured: null, message: 'LLM 不可用' } })

    const result = await repairStructuredFormula('纯文本配方内容')

    expect(api.post).toHaveBeenCalledWith('/ai/formula/repair-structured', {
      content: '纯文本配方内容',
    })
    expect(result.success).toBe(false)
    expect(result.message).toBe('LLM 不可用')
    expect(result.structured).toBeNull()
  })

  it('submitFormulaFeedback 应 POST /ai/formula/feedback 并携带完整 payload', async () => {
    const mockResponse = {
      data: {
        success: true,
        feedback: {
          id: 9,
          formula_id: 42,
          rating: 4,
          symptom_change: '睡眠有所改善',
          metric_updates: [
            { metric_name: '空腹血糖', baseline_value: '7.2', current_value: '6.1', unit: 'mmol/L' },
          ],
          notes: '持续服用两周',
          created_at: '2026-10-22T08:00:00Z',
        },
      },
    }
    vi.mocked(api.post).mockResolvedValue(mockResponse)

    const result = await submitFormulaFeedback({
      formula_id: 42,
      rating: 4,
      symptom_change: '睡眠有所改善',
      metric_updates: [
        { metric_name: '空腹血糖', baseline_value: '7.2', current_value: '6.1', unit: 'mmol/L' },
      ],
      notes: '持续服用两周',
    })

    expect(api.post).toHaveBeenCalledWith('/ai/formula/feedback', {
      formula_id: 42,
      rating: 4,
      symptom_change: '睡眠有所改善',
      metric_updates: [
        { metric_name: '空腹血糖', baseline_value: '7.2', current_value: '6.1', unit: 'mmol/L' },
      ],
      notes: '持续服用两周',
    })
    expect(result.success).toBe(true)
    expect(result.feedback?.id).toBe(9)
    expect(result.feedback?.rating).toBe(4)
  })

  it('getFormulaFeedback 应 GET /ai/formula/{formula_id}/feedback 并返回 items', async () => {
    const mockResponse = {
      data: {
        items: [
          {
            id: 1,
            formula_id: 42,
            rating: 5,
            symptom_change: '效果明显',
            created_at: '2026-10-01T08:00:00Z',
          },
        ],
      },
    }
    vi.mocked(api.get).mockResolvedValue(mockResponse)

    const result = await getFormulaFeedback(42)

    expect(api.get).toHaveBeenCalledWith('/ai/formula/42/feedback')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].rating).toBe(5)
    expect(result.items[0].symptom_change).toBe('效果明显')
  })
})