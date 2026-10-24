/**
 * useReportGenerator 报告导出真实化测试
 *
 * 验证 exportToPDF / exportToWord / exportToExcel 调用真实后端端点：
 * - POST /reports/explainability/pdf    → 下载 .pdf
 * - POST /reports/explainability/docx   → 下载 .docx
 * - POST /reports/explainability/markdown → 下载 .md（原 Excel 入口）
 * 同时覆盖成分/功效提取辅助函数的缺省兜底行为。
 */
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import api from '@/api/client'
import {
  useReportGenerator,
  extractReportIngredients,
  extractReportTargetEffects,
  parseDosageGrams,
} from '../../hooks/useReportGenerator'
import type { AIRecognizedFormula, ProfessionalReport } from '@/types/ai.types'

// ===== Mock axios 客户端 =====
vi.mock('@/api/client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

const formula: AIRecognizedFormula = {
  id: 'f1',
  name: '补气方',
  ingredientCount: 2,
  confidence: 0.9,
  sourceMessageId: 'm1',
  parsedAt: new Date(),
  rawData: {} as never,
  ingredients: [
    { name: '黄芪', dosage: '15g' },
    { name: '当归', dosage: '10g' },
  ],
  tags: ['补气'],
}

const baseReport: ProfessionalReport = {
  id: 'r1',
  title: '补气方报告',
  generatedAt: new Date(),
  version: '1.0.0',
  sections: [
    { id: 'cover', type: 'cover', title: '封面', content: {}, order: 0 },
    {
      id: 'ingredient-analysis',
      type: 'ingredient-analysis',
      title: '成分分析',
      content: { rows: [] },
      order: 1,
    },
  ],
  metadata: { projectName: '测试项目' },
}

describe('useReportGenerator 导出真实端点', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('exportToPDF 调用 POST /reports/explainability/pdf 并下载 .pdf', async () => {
    const pdfBlob = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' })
    const postMock = vi.mocked(api.post).mockResolvedValue({ data: pdfBlob })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const { result } = renderHook(() => useReportGenerator(new Map([['f1', formula]])))

    await act(async () => {
      await result.current.handleGenerateReport('f1')
    })

    let blob: Blob | undefined
    await act(async () => {
      blob = await result.current.exportToPDF()
    })

    // 调用真实端点，且使用 URLSearchParams 编码表单参数
    expect(postMock).toHaveBeenCalledWith(
      '/reports/explainability/pdf',
      expect.any(URLSearchParams),
      expect.objectContaining({ responseType: 'blob' }),
    )
    const params = postMock.mock.calls[0][1] as URLSearchParams
    expect(params.get('formula_name')).toBe('补气方')
    expect(JSON.parse(params.get('ingredients')!)).toEqual([
      { name: '黄芪', dosage_mg: 15000 },
      { name: '当归', dosage_mg: 10000 },
    ])
    expect(JSON.parse(params.get('target_effects')!)).toEqual(['补气'])

    // 触发浏览器下载
    expect(clickSpy).toHaveBeenCalled()
    expect(blob).toBe(pdfBlob)
  })

  it('exportToWord 调用 POST /reports/explainability/docx 并下载 .docx', async () => {
    const docxBlob = new Blob(['docx-fake'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const postMock = vi.mocked(api.post).mockResolvedValue({ data: docxBlob })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const { result } = renderHook(() => useReportGenerator(new Map([['f1', formula]])))

    await act(async () => {
      await result.current.handleGenerateReport('f1')
    })

    await act(async () => {
      await result.current.exportToWord()
    })

    expect(postMock).toHaveBeenCalledWith(
      '/reports/explainability/docx',
      expect.any(URLSearchParams),
      expect.objectContaining({ responseType: 'blob' }),
    )
    const params = postMock.mock.calls[0][1] as URLSearchParams
    expect(params.get('formula_name')).toBe('补气方')
  })

  it('exportToExcel 调用 POST /reports/explainability/markdown 并下载 .md', async () => {
    const mdResponse = {
      success: true,
      data: { markdown: '# 配方可解释性报告\n\n**配方名称**：补气方', formula_name: '补气方' },
    }
    const postMock = vi.mocked(api.post).mockResolvedValue({ data: mdResponse })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const { result } = renderHook(() => useReportGenerator(new Map([['f1', formula]])))

    await act(async () => {
      await result.current.handleGenerateReport('f1')
    })

    let blob: Blob | undefined
    await act(async () => {
      blob = await result.current.exportToExcel()
    })

    expect(postMock).toHaveBeenCalledWith(
      '/reports/explainability/markdown',
      expect.any(URLSearchParams),
      expect.objectContaining({ headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
    )
    // 返回的是 .md 文本 Blob
    expect(blob!.type).toBe('text/markdown;charset=utf-8')
    expect(await blob!.text()).toContain('# 配方可解释性报告')
  })

  it('没有报告数据时导出应抛出错误', async () => {
    const { result } = renderHook(() => useReportGenerator(new Map()))

    await expect(result.current.exportToPDF()).rejects.toThrow('没有可导出的报告')
    await expect(result.current.exportToWord()).rejects.toThrow('没有可导出的报告')
    await expect(result.current.exportToExcel()).rejects.toThrow('没有可导出的报告')
  })
})

describe('报告导出辅助函数', () => {
  it('parseDosageGrams 解析剂量字符串为克数（区间取上限）', () => {
    expect(parseDosageGrams('10g')).toBe(10)
    expect(parseDosageGrams('10-15g')).toBe(15)
    expect(parseDosageGrams('约15克')).toBe(15)
    expect(parseDosageGrams('')).toBe(0)
  })

  it('extractReportIngredients 优先使用 currentFormula.ingredients 并换算为 mg', () => {
    const ingredients = extractReportIngredients(baseReport, formula)
    expect(ingredients).toEqual([
      { name: '黄芪', dosage_mg: 15000 },
      { name: '当归', dosage_mg: 10000 },
    ])
  })

  it('extractReportIngredients 在缺少 currentFormula 时扫描 sections 尽力提取', () => {
    const reportWithTable: ProfessionalReport = {
      ...baseReport,
      sections: [
        {
          id: 'ingredient-analysis',
          type: 'ingredient-analysis',
          title: '成分分析',
          content: '- 枸杞 10g\n- 菊花 5g',
          order: 0,
        },
      ],
    }
    const ingredients = extractReportIngredients(reportWithTable, null)
    expect(ingredients).toEqual([
      { name: '枸杞', dosage_mg: 10000 },
      { name: '菊花', dosage_mg: 5000 },
    ])
  })

  it('extractReportIngredients 无数据时返回空数组（后端兜底）', () => {
    expect(extractReportIngredients(baseReport, null)).toEqual([])
    expect(extractReportIngredients(null, null)).toEqual([])
  })

  it('extractReportTargetEffects 优先使用 tags，其次 efficacy，缺省空数组', () => {
    expect(extractReportTargetEffects(baseReport, formula)).toEqual(['补气'])
    expect(extractReportTargetEffects(baseReport, { ...formula, tags: [], efficacy: '健脾' })).toEqual(['健脾'])
    expect(extractReportTargetEffects(baseReport, { ...formula, tags: [], efficacy: undefined })).toEqual([])
  })
})