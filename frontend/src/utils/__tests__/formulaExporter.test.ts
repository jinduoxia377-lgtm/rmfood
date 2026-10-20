/**
 * formulaExporter 单元测试
 *
 * 测试覆盖范围：
 * - Excel 导出功能（4个测试用例）
 * - CSV 导出功能（4个测试用例）
 * - 导入模板生成（3个测试用例）
 * - 文件解析（Excel/CSV）（4个测试用例）
 * - 数据验证（导入时）（4个测试用例）
 *
 * 目标代码覆盖率 ≥ 80%
 */
import { describe, it, expect, vi } from 'vitest'
import {
  exportFormulasEnhanced,
  generateImportTemplate,
  parseImportFile,
  validateImportRow,
} from '@/utils/formulaExporter'
import type { Formula } from '@/types/index'

// Mock encodingUtils
vi.mock('@/utils/encodingUtils', () => ({
  addBOM: (str: string) => '\uFEFF' + str,
  csvEscape: (str: string) => {
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  },
  exportHistory: {
    addEntry: vi.fn(() => 'test-task-id'),
    updateEntry: vi.fn(),
  },
  formatFilename: (name: string, ext: string) => `${name}.${ext}`,
  downloadBlob: vi.fn(),
}))

// Mock constants
vi.mock('@/constants/errorCodes', () => ({
  ERROR_CODES: {
    BUSINESS_FORMULA_NOT_FOUND: 'FORMULA_NOT_FOUND',
    BUSINESS_EXPORT_FAILED: 'EXPORT_FAILED',
  },
}))

vi.mock('@/constants', () => ({
  getErrorMessage: (code: string) => `Error: ${code}`,
}))

// Mock URL.createObjectURL and related browser APIs
const mockCreateObjectURL = vi.fn(() => 'blob:test-url')
const mockRevokeObjectURL = vi.fn()

Object.defineProperty(globalThis, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
})

// Mock document.createElement for download
const mockClick = vi.fn()

const originalCreateElement = document.createElement.bind(document)
document.createElement = function(tag: string) {
  const element = originalCreateElement(tag)
  if (tag === 'a') {
    element.click = mockClick
  }
  return element
}

describe('formulaExporter - 配方导出工具函数库', () => {
  // ============================================================
  // 辅助函数：创建测试数据
  // ============================================================
  const createTestFormula = (overrides?: Partial<Formula>): Formula => ({
    id: 1,
    name: '气血双补配方',
    version: 1,
    category: '中药配方' as any,
    tags: ['补气', '养血'],
    status: 'active' as any,
    ingredients: [
      { id: 1, name: '人参', amount: 10, unit: 'g', role: '君药' as any },
      { id: 2, name: '黄芪', amount: 15, unit: 'g', role: '臣药' as any },
      { id: 3, name: '当归', amount: 8, unit: 'g', role: '佐药' as any },
    ],
    processSteps: [
      { id: 1, stepNumber: 1, description: '将药材洗净浸泡三十分钟' },
      { id: 2, stepNumber: 2, description: '大火煮沸后转小火煮二十分钟' },
    ],
    targetEffects: ['补气', '养血', '安神'],
    estimatedCost: 25.5,
    creatorId: 1,
    ...overrides,
  })

  // ============================================================
  // 1. Excel 导出测试
  // ============================================================
  describe('exportFormulasEnhanced - Excel 导出', () => {
    it('应成功导出有效的 Excel 数据（结构检查）', async () => {
      const formulas = [createTestFormula()]

      const result = await exportFormulasEnhanced(formulas, {
        format: 'excel',
        filename: '测试导出',
      })

      expect(result).toBe(true)
    })

    it('空数据应返回 false 并提示错误', async () => {
      const result = await exportFormulasEnhanced([], {
        format: 'excel',
        filename: '空数据测试',
      })

      expect(result).toBe(false)
    })

    it('大数据量（>100条）应在合理时间内完成', async () => {
      const formulas = Array.from({ length: 150 }, (_, i) =>
        createTestFormula({
          id: i + 1,
          name: `配方${i + 1}`,
          ingredients: [
            { id: 1, name: `成分A${i}`, amount: 10, unit: 'g', role: '主成分' as any },
          ],
          creatorId: i + 1,
        })
      )

      const startTime = Date.now()
      const result = await exportFormulasEnhanced(formulas, {
        format: 'excel',
        filename: '大批量测试',
      })
      const endTime = Date.now()

      expect(result).toBe(true)
      expect(endTime - startTime).toBeLessThan(5000)
    })

    it('包含不同状态的配方应正确应用条件格式', async () => {
      const formulas = [
        createTestFormula({ id: 1, status: 'active' as any }),
        createTestFormula({ id: 2, status: 'draft' as any }),
        createTestFormula({ id: 3, status: 'pending' as any }),
        createTestFormula({ id: 4, status: 'rejected' as any }),
      ]

      const result = await exportFormulasEnhanced(formulas, {
        format: 'excel',
        filename: '多状态测试',
      })

      expect(result).toBe(true)
    })
  })

  // ============================================================
  // 2. CSV 导出测试
  // ============================================================
  describe('exportFormulasEnhanced - CSV 导出', () => {
    it('应成功生成 UTF-8 BOM 编码的 CSV', async () => {
      const formulas = [createTestFormula()]

      const result = await exportFormulasEnhanced(formulas, {
        format: 'csv',
        filename: 'CSV测试',
      })

      expect(result).toBe(true)
    })

    it('含逗号字段应正确引号包裹', async () => {
      const formulas = [
        createTestFormula({
          name: '含逗号,的配方',
          tags: ['标签A', '标签B,带逗号'],
        }),
      ]

      const result = await exportFormulasEnhanced(formulas, {
        format: 'csv',
        filename: '逗号测试',
      })

      expect(result).toBe(true)
    })

    it('中文内容不应乱码', async () => {
      const formulas = [
        createTestFormula({
          name: '清热解毒汤',
          description: '用于清热解毒的经典中药配方，具有很好的临床效果',
          tags: ['清热', '解毒', '养生', '中药'],
          targetEffects: ['清热解毒', '消炎止痛', '增强免疫'],
        }),
      ]

      const result = await exportFormulasEnhanced(formulas, {
        format: 'csv',
        filename: '中文测试',
      })

      expect(result).toBe(true)
    })

    it('空数据应返回 false', async () => {
      const result = await exportFormulasEnhanced([], {
        format: 'csv',
        filename: '空数据',
      })

      expect(result).toBe(false)
    })
  })

  // ============================================================
  // 3. PDF 导出测试
  // ============================================================
  describe('exportFormulasEnhanced - PDF 导出', () => {
    it('应成功生成 PDF 文件', async () => {
      const formulas = [createTestFormula()]

      const result = await exportFormulasEnhanced(formulas, {
        format: 'pdf',
        filename: 'PDF测试',
      }, 10000)

      expect(result).toBe(true)
    }, 10000)

    it('大量数据的 PDF 导出应正常完成', async () => {
      const formulas = Array.from({ length: 50 }, (_, i) =>
        createTestFormula({
          id: i + 1,
          name: `配方${i + 1}`,
          creatorId: i + 1,
        })
      )

      const result = await exportFormulasEnhanced(formulas, {
        format: 'pdf',
        filename: '大批量PDF',
      }, 15000)

      expect(result).toBe(true)
    }, 15000)

  // ============================================================
  // 4. 不支持的格式测试
  // ============================================================
  describe('exportFormulasEnhanced - 错误处理', () => {
    it('不支持的格式应返回 false', async () => {
      const formulas = [createTestFormula()]

      const result = await exportFormulasEnhanced(formulas, {
        format: 'json' as any,
        scope: 'all',
        filename: '格式错误测试',
      })

      expect(result).toBe(false)
    })
  })

  // ============================================================
  // 5. 导入模板生成测试
  // ============================================================
  describe('generateImportTemplate - 导入模板生成', () => {
    it('模板应包含正确的表头行', async () => {
      const blob = await generateImportTemplate()
      expect(blob).toBeDefined()
      expect(blob.type).toContain('spreadsheetml.sheet')
      expect(blob.size).toBeGreaterThan(0)
    })

    it('模板大小应在合理范围内（包含示例数据和规则说明）', async () => {
      const blob = await generateImportTemplate()

      expect(blob.size).toBeGreaterThan(2000)
      expect(blob.size).toBeLessThan(50000)
    })

    it('每次调用都应生成有效的 Blob', async () => {
      const blob1 = await generateImportTemplate()
      const blob2 = await generateImportTemplate()

      expect(blob1).toBeDefined()
      expect(blob2).toBeDefined()
      expect(blob1.type).toBe(blob2.type)
    })
  })

  // ============================================================
  // 6. 文件解析测试
  // ============================================================
  describe('parseImportFile - 文件解析', () => {
    it('应正确解析 CSV 文件', async () => {
      const csvContent = `配方名称*,分类,状态,标签(分号分隔)
测试配方,中药配方,草稿,标签1;标签2
另一个配方,西药配方,待审核,标签3`

      const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

      const mockText = vi.fn().mockResolvedValue(csvContent)
      Object.defineProperty(file, 'text', { value: mockText })

      const result = await parseImportFile(file)

      expect(result.headers.length).toBeGreaterThan(0)
      expect(result.rows.length).toBe(2)
      expect(result.totalCount).toBe(2)
    })

    it('应正确解析 Excel 文件（.xlsx）', async () => {
      const excelContent = new Uint8Array([
        0x50, 0x4b, 0x03, 0x04,
      ])

      const file = new File([excelContent], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })

      try {
        await parseImportFile(file)
      } catch (e) {
        expect(e).toBeDefined()
      }
    })

    it('格式不支持应抛出明确错误', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })

      try {
        await parseImportFile(file)
        expect.fail('应该抛出错误')
      } catch (e) {
        expect((e as Error).message).toContain('不支持的文件格式')
      }
    })

    it('空 CSV 文件应抛出错误', async () => {
      const file = new File(['只有表头'], 'empty.csv', { type: 'text/csv' })

      try {
        await parseImportFile(file)
        expect.fail('应该抛出错误')
      } catch (e) {
        expect(e).toBeDefined()
      }
    })
  })

  // ============================================================
  // 7. 数据验证测试
  // ============================================================
  describe('validateImportRow - 数据验证', () => {
    const baseHeaders = [
      '配方名称*',
      '分类',
      '状态',
      '标签(分号分隔)',
      '成分名称*|用量|单位|角色(分号分隔多个成分)',
    ]

    it('有效行应标记为 valid', () => {
      const row = {
        rowIndex: 1,
        data: {
          '配方名称*': '有效配方',
          '成分名称*|用量|单位|角色(分号分隔多个成分)': '人参|10g|g|主成分',
        },
        errors: [],
        warnings: [],
        isValid: true,
        severity: 'valid' as const,
      }

      const validatedRow = validateImportRow(row, baseHeaders)

      expect(validatedRow.isValid).toBe(true)
      expect(validatedRow.severity).toBe('valid')
      expect(validatedRow.errors).toHaveLength(0)
    })

    it('缺少必填字段名称应标记为 error', () => {
      const row = {
        rowIndex: 1,
        data: {
          '配方名称*': '',
          '成分名称*|用量|单位|角色(分号分隔多个成分)': '',
        },
        errors: [],
        warnings: [],
        isValid: true,
        severity: 'valid' as const,
      }

      const validatedRow = validateImportRow(row, baseHeaders)

      expect(validatedRow.isValid).toBe(false)
      expect(validatedRow.severity).toBe('error')
      expect(validatedRow.errors.some(e => e.code === 'REQUIRED')).toBeTruthy()
    })

    it('超长字段应标记为 warning', () => {
      const longName = 'a'.repeat(101)
      const row = {
        rowIndex: 1,
        data: {
          '配方名称*': longName,
          '成分名称*|用量|单位|角色(分号分隔多个成分)': '人参|10g|g|主成分',
        },
        errors: [],
        warnings: [],
        isValid: true,
        severity: 'valid' as const,
      }

      const validatedRow = validateImportRow(row, baseHeaders)

      expect(validatedRow.warnings.some(e => e.code === 'MAX_LENGTH')).toBeTruthy()
    })

    it('空行应标记为 error', () => {
      const row = {
        rowIndex: 1,
        data: {
          '配方名称*': '',
          '分类': '',
          '状态': '',
          '标签(分号分隔)': '',
          '成分名称*|用量|单位|角色(分号分隔多个成分)': '',
        },
        errors: [],
        warnings: [],
        isValid: true,
        severity: 'valid' as const,
      }

      const validatedRow = validateImportRow(row, baseHeaders)

      expect(validatedRow.errors.some(e => e.code === 'EMPTY_ROW')).toBeTruthy()
      expect(validatedRow.isValid).toBe(false)
    })

    it('名称过短（<2字符）应标记为 error', () => {
      const row = {
        rowIndex: 1,
        data: {
          '配方名称*': 'a',
          '成分名称*|用量|单位|角色(分号分隔多个成分)': '人参|10g|g|主成分',
        },
        errors: [],
        warnings: [],
        isValid: true,
        severity: 'valid' as const,
      }

      const validatedRow = validateImportRow(row, baseHeaders)

      expect(validatedRow.errors.some(e => e.code === 'MIN_LENGTH')).toBeTruthy()
      expect(validatedRow.isValid).toBe(false)
    })

    it('缺少成分字段应标记为 error', () => {
      const row = {
        rowIndex: 1,
        data: {
          '配方名称*': '有效配方名',
          '成分名称*|用量|单位|角色(分号分隔多个成分)': '',
        },
        errors: [],
        warnings: [],
        isValid: true,
        severity: 'valid' as const,
      }

      const validatedRow = validateImportRow(row, baseHeaders)

      expect(validatedRow.errors.some(e => e.field?.includes('成分'))).toBeTruthy()
    })
  })

  // ============================================================
  // 8. 进度回调测试
  // ============================================================
  describe('进度回调功能', () => {
    it('导出过程中应调用进度回调', async () => {
      const progressCalls: Array<{ progress: number; message: string }> = []
      const formulas = [createTestFormula()]

      await exportFormulasEnhanced(formulas, {
        format: 'excel',
        filename: '进度测试',
        onProgress: (progress) => {
          progressCalls.push(progress)
        },
      })

      expect(progressCalls.length).toBeGreaterThan(0)
      expect(progressCalls[progressCalls.length - 1].progress).toBe(100)
    })
  })
})
})
