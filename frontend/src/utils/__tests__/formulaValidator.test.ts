/**
 * formulaValidator 单元测试
 *
 * 测试覆盖范围：
 * - validateFormulaName: 配方名称验证（7个测试用例）
 * - validateIngredient: 成分验证（5个测试用例）
 * - validateIngredientList: 成分列表验证（7个测试用例）
 * - validateFormulaSteps: 步骤验证（4个测试用例）
 * - validateFormulaEffects: 功效验证（5个测试用例）
 * - validateFullFormula: 完整配方验证（5个测试用例）
 * - getErrorMessage 和 hasFieldError 辅助函数
 *
 * 目标代码覆盖率 ≥ 90%
 */
import { describe, it, expect } from 'vitest'
import {
  validateFormulaName,
  validateIngredient,
  validateIngredientList,
  validateFormulaSteps,
  validateFormulaEffects,
  validateFullFormula,
  getErrorMessage,
  hasFieldError,
} from '@/utils/formulaValidator'

describe('formulaValidator - 配方验证工具函数库', () => {
  // ============================================================
  // 1. validateFormulaName 测试
  // ============================================================
  describe('validateFormulaName - 配方名称验证', () => {
    it('应该通过有效的配方名称', () => {
      const result = validateFormulaName('气血双补配方')
      expect(result).toHaveLength(0)
    })

    it('空字符串应返回 REQUIRED 错误', () => {
      const result = validateFormulaName('')
      expect(result).toHaveLength(1)
      expect(result[0].code).toBe('REQUIRED')
      expect(result[0].field).toBe('name')
    })

    it('只有空格应返回 REQUIRED 错误', () => {
      const result = validateFormulaName('   ')
      expect(result).toHaveLength(1)
      expect(result[0].code).toBe('REQUIRED')
    })

    it('超过100字符应返回 MAX_LENGTH 错误', () => {
      const longName = 'a'.repeat(101)
      const result = validateFormulaName(longName)
      const maxLengthError = result.find(e => e.code === 'MAX_LENGTH')
      expect(maxLengthError).toBeDefined()
      expect(maxLengthError?.field).toBe('name')
    })

    it('恰好100字符应通过', () => {
      const name = 'a'.repeat(100)
      const result = validateFormulaName(name)
      const maxLengthError = result.find(e => e.code === 'MAX_LENGTH')
      expect(maxLengthError).toBeUndefined()
    })

    it('少于2字符应返回 MIN_LENGTH 错误', () => {
      const result = validateFormulaName('a')
      const minLengthError = result.find(e => e.code === 'MIN_LENGTH')
      expect(minLengthError).toBeDefined()
      expect(minLengthError?.field).toBe('name')
    })

    it('包含特殊非法字符应返回 INVALID_CHARACTERS', () => {
      const result = validateFormulaName('配方<test>')
      const invalidCharError = result.find(e => e.code === 'INVALID_CHARACTERS')
      expect(invalidCharError).toBeDefined()
    })

    it('null/undefined 应返回 REQUIRED 错误', () => {
      const result1 = validateFormulaName(null as any)
      const result2 = validateFormulaName(undefined as any)
      expect(result1[0].code).toBe('REQUIRED')
      expect(result2[0].code).toBe('REQUIRED')
    })

    it('包含多种非法字符应返回所有相关错误', () => {
      const name = '<script>alert("xss")</script>'
      const result = validateFormulaName(name)
      expect(result.some(e => e.code === 'INVALID_CHARACTERS')).toBeTruthy()
    })
  })

  // ============================================================
  // 2. validateIngredient 测试
  // ============================================================
  describe('validateIngredient - 成分验证', () => {
    it('有效成分应通过验证', () => {
      const ingredient = { name: '人参', amount: 10, percentage: 50 }
      const result = validateIngredient(ingredient)
      expect(result).toHaveLength(0)
    })

    it('缺少名称应返回 REQUIRED 错误', () => {
      const ingredient = { amount: 10, percentage: 50 }
      const result = validateIngredient(ingredient)
      expect(result.some(e => e.field === 'name' && e.code === 'REQUIRED')).toBeTruthy()
    })

    it('用量为负数应返回 OUT_OF_RANGE', () => {
      const ingredient = { name: '人参', amount: -5, percentage: 50 }
      const result = validateIngredient(ingredient)
      expect(result.some(e => e.field === 'amount' && e.code === 'OUT_OF_RANGE')).toBeTruthy()
    })

    it('比例超过100应返回 OUT_OF_RANGE', () => {
      const ingredient = { name: '人参', amount: 10, percentage: 150 }
      const result = validateIngredient(ingredient)
      expect(result.some(e => e.field === 'percentage' && e.code === 'OUT_OF_RANGE')).toBeTruthy()
    })

    it('比例小于0应返回 OUT_OF_RANGE', () => {
      const ingredient = { name: '人参', amount: 10, percentage: -10 }
      const result = validateIngredient(ingredient)
      expect(result.some(e => e.field === 'percentage' && e.code === 'OUT_OF_RANGE')).toBeTruthy()
    })

    it('用量超出合理范围（>1000000）应返回 OUT_OF_RANGE', () => {
      const ingredient = { name: '人参', amount: 1000001, percentage: 50 }
      const result = validateIngredient(ingredient)
      expect(result.some(e => e.field === 'amount' && e.code === 'OUT_OF_RANGE')).toBeTruthy()
    })

    it('缺少用量应返回 REQUIRED 错误', () => {
      const ingredient = { name: '人参', percentage: 50 }
      const result = validateIngredient(ingredient)
      expect(result.some(e => e.field === 'amount' && e.code === 'REQUIRED')).toBeTruthy()
    })

    it('缺少比例应返回 REQUIRED 错误', () => {
      const ingredient = { name: '人参', amount: 10 }
      const result = validateIngredient(ingredient)
      expect(result.some(e => e.field === 'percentage' && e.code === 'REQUIRED')).toBeTruthy()
    })
  })

  // ============================================================
  // 3. validateIngredientList 测试
  // ============================================================
  describe('validateIngredientList - 成分列表验证', () => {
    it('空数组应返回错误（至少一条成分）', () => {
      const result = validateIngredientList([])
      expect(result.some(e => e.code === 'REQUIRED' && e.field === 'ingredients')).toBeTruthy()
    })

    it('null/undefined 应返回 REQUIRED 错误', () => {
      const result1 = validateIngredientList(null as any)
      const result2 = validateIngredientList(undefined as any)
      expect(result1.some(e => e.code === 'REQUIRED')).toBeTruthy()
      expect(result2.some(e => e.code === 'REQUIRED')).toBeTruthy()
    })

    it('单条成分且比例100%应通过', () => {
      const ingredients = [{ name: '水', percentage: 100 }]
      const result = validateIngredientList(ingredients)
      expect(result.filter(e => e.code === 'SUM_NOT_100')).toHaveLength(0)
    })

    it('多条成分比例总和为100%应通过', () => {
      const ingredients = [
        { name: '人参', percentage: 30 },
        { name: '黄芪', percentage: 40 },
        { name: '当归', percentage: 30 },
      ]
      const result = validateIngredientList(ingredients)
      expect(result.filter(e => e.code === 'SUM_NOT_100')).toHaveLength(0)
    })

    it('比例总和<100%应返回 SUM_NOT_100', () => {
      const ingredients = [
        { name: '人参', percentage: 30 },
        { name: '黄芪', percentage: 40 },
      ]
      const result = validateIngredientList(ingredients)
      expect(result.some(e => e.code === 'SUM_NOT_100')).toBeTruthy()
    })

    it('比例总和>100%应返回 SUM_NOT_100', () => {
      const ingredients = [
        { name: '人参', percentage: 60 },
        { name: '黄芪', percentage: 60 },
      ]
      const result = validateIngredientList(ingredients)
      expect(result.some(e => e.code === 'SUM_NOT_100')).toBeTruthy()
    })

    it('比例总和99.99%（浮点误差范围）应通过', () => {
      const ingredients = [
        { name: '人参', percentage: 33.34 },
        { name: '黄芪', percentage: 33.33 },
        { name: '当归', percentage: 33.33 },
      ]
      const result = validateIngredientList(ingredients)
      expect(result.filter(e => e.code === 'SUM_NOT_100')).toHaveLength(0)
    })

    it('含重复名称成分应返回 DUPLICATE_NAME', () => {
      const ingredients = [
        { name: '人参', percentage: 30 },
        { name: '人参', percentage: 40 },
        { name: '当归', percentage: 30 },
      ]
      const result = validateIngredientList(ingredients)
      expect(result.some(e => e.code === 'DUPLICATE_NAME')).toBeTruthy()
    })

    it('应对每个成分单独验证并返回带索引的错误', () => {
      const ingredients = [
        { name: '', percentage: 50 },
        { name: '黄芪', percentage: 50 },
      ]
      const result = validateIngredientList(ingredients)
      expect(result.some(e => e.field.startsWith('ingredients[0]'))).toBeTruthy()
    })
  })

  // ============================================================
  // 4. validateFormulaSteps 测试
  // ============================================================
  describe('validateFormulaSteps - 步骤验证', () => {
    it('空步骤列表应通过（步骤可选）', () => {
      const result = validateFormulaSteps([])
      expect(result).toHaveLength(0)
    })

    it('null/undefined 步骤应通过', () => {
      const result1 = validateFormulaSteps(null as any)
      const result2 = validateFormulaSteps(undefined as any)
      expect(result1).toHaveLength(0)
      expect(result2).toHaveLength(0)
    })

    it('步骤编号重复应报错', () => {
      const steps = [
        { step_number: 1, description: '第一步' },
        { step_number: 1, description: '重复编号' },
        { step_number: 2, description: '第三步' },
      ]
      const result = validateFormulaSteps(steps)
      expect(result.some(e => e.code === 'DUPLICATE_NAME' && e.field === 'process_steps')).toBeTruthy()
    })

    it('步骤描述为空应报错', () => {
      const steps = [
        { step_number: 1, description: '' },
        { step_number: 2, description: '第二步' },
      ]
      const result = validateFormulaSteps(steps)
      expect(result.some(e => e.code === 'REQUIRED' && e.field.includes('description'))).toBeTruthy()
    })

    it('步骤描述只有空格应报错', () => {
      const steps = [
        { step_number: 1, description: '   ' },
      ]
      const result = validateFormulaSteps(steps)
      expect(result.some(e => e.code === 'REQUIRED')).toBeTruthy()
    })

    it('步骤描述少于5字符应返回 MIN_LENGTH 错误', () => {
      const steps = [
        { step_number: 1, description: '太短' },
      ]
      const result = validateFormulaSteps(steps)
      expect(result.some(e => e.code === 'MIN_LENGTH')).toBeTruthy()
    })

    it('有效步骤列表应通过', () => {
      const steps = [
        { step_number: 1, description: '将药材洗净浸泡三十分钟' },
        { step_number: 2, description: '大火煮沸后转小火煮二十分钟' },
        { step_number: 3, description: '过滤取汁备用' },
      ]
      const result = validateFormulaSteps(steps)
      expect(result).toHaveLength(0)
    })
  })

  // ============================================================
  // 5. validateFormulaEffects 测试
  // ============================================================
  describe('validateFormulaEffects - 功效验证', () => {
    it('空数组应通过（功效可选）', () => {
      const result = validateFormulaEffects([])
      expect(result).toHaveLength(0)
    })

    it('null/undefined 应通过', () => {
      const result1 = validateFormulaEffects(null as any)
      const result2 = validateFormulaEffects(undefined as any)
      expect(result1).toHaveLength(0)
      expect(result2).toHaveLength(0)
    })

    it('含空字符串元素应返回 REQUIRED 错误', () => {
      const effects = ['补气', '', '养血']
      const result = validateFormulaEffects(effects)
      expect(result.some(e => e.code === 'REQUIRED' && e.field === 'effects[1]')).toBeTruthy()
    })

    it('有效功效数组应通过', () => {
      const effects = ['补气', '养血', '安神']
      const result = validateFormulaEffects(effects)
      expect(result.filter(e => e.code !== 'DUPLICATE_NAME' && e.code !== 'MAX_LENGTH')).toHaveLength(0)
    })

    it('重复功效标签应警告 DUPLICATE_NAME', () => {
      const effects = ['补气', '养血', '补气']
      const result = validateFormulaEffects(effects)
      expect(result.some(e => e.code === 'DUPLICATE_NAME' && e.field === 'effects')).toBeTruthy()
    })

    it('超过20个功效标签应返回 MAX_LENGTH 错误', () => {
      const effects = Array.from({ length: 21 }, (_, i) => `功效${i + 1}`)
      const result = validateFormulaEffects(effects)
      expect(result.some(e => e.code === 'MAX_LENGTH' && e.field === 'effects')).toBeTruthy()
    })

    it('恰好20个功效标签应通过', () => {
      const effects = Array.from({ length: 20 }, (_, i) => `功效${i + 1}`)
      const result = validateFormulaEffects(effects)
      expect(result.some(e => e.code === 'MAX_LENGTH')).toBeFalsy()
    })
  })

  // ============================================================
  // 6. validateFullFormula 测试
  // ============================================================
  describe('validateFullFormula - 完整配方验证', () => {
    it('完整有效数据应返回 valid=true, errors=[]', () => {
      const data = {
        name: '气血双补配方',
        ingredients: [
          { name: '人参', amount: 10, percentage: 30 },
          { name: '黄芪', amount: 15, percentage: 40 },
          { name: '当归', amount: 8, percentage: 30 },
        ],
        process_steps: [
          { step_number: 1, description: '将药材洗净浸泡三十分钟' },
        ],
        effects: ['补气', '养血'],
      }

      const result = validateFullFormula(data)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('缺失名称应返回对应字段错误', () => {
      const data = {
        ingredients: [
          { name: '人参', amount: 10, percentage: 100 },
        ],
      }

      const result = validateFullFormula(data)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field === 'name')).toBeTruthy()
    })

    it('多个字段同时有错误应全部返回', () => {
      const data = {
        name: '',
        ingredients: [
          { name: '', amount: -5, percentage: 150 },
        ],
        estimated_cost: -10,
      }

      const result = validateFullFormula(data)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(3)
      expect(result.errors.some(e => e.field === 'name')).toBeTruthy()
      expect(result.errors.some(e => e.field.includes('ingredients'))).toBeTruthy()
      expect(result.errors.some(e => e.field === 'estimated_cost')).toBeTruthy()
    })

    it('warnings 和 errors 应分开返回', () => {
      const data = {
        name: '有效配方名',
        tags: Array.from({ length: 11 }, (_, i) => `标签${i}`),
        description: 'a'.repeat(2001),
        ingredients: [
          { name: '成分A', amount: 10, percentage: 100 },
        ],
      }

      const result = validateFullFormula(data)
      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.errors.length).toBe(0)
      expect(result.warnings.some(e => e.field === 'tags')).toBeTruthy()
      expect(result.warnings.some(e => e.field === 'description')).toBeTruthy()
    })

    it('部分数据（仅名称）应返回 valid=true 但可能有 warnings', () => {
      const data = {
        name: '仅名称的配方',
      }

      const result = validateFullFormula(data)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('预估成本为负数应返回错误', () => {
      const data = {
        name: '测试配方',
        estimated_cost: -100,
      }

      const result = validateFullFormula(data)
      expect(result.errors.some(e => e.field === 'estimated_cost' && e.code === 'OUT_OF_RANGE')).toBeTruthy()
    })
  })

  // ============================================================
  // 7. 辅助函数测试
  // ============================================================
  describe('getErrorMessage - 获取错误消息', () => {
    it('应返回指定字段的第一个错误消息', () => {
      const errors = [
        { field: 'name', message: '名称不能为空', code: 'REQUIRED' as const },
        { field: 'amount', message: '用量不能为负数', code: 'OUT_OF_RANGE' as const },
      ]

      expect(getErrorMessage(errors, 'name')).toBe('名称不能为空')
      expect(getErrorMessage(errors, 'amount')).toBe('用量不能为负数')
    })

    it('字段不存在时应返回 null', () => {
      const errors = [{ field: 'name', message: '错误', code: 'REQUIRED' as const }]
      expect(getErrorMessage(errors, 'nonexistent')).toBeNull()
    })

    it('空错误数组应返回 null', () => {
      expect(getErrorMessage([])).toBeNull()
      expect(getErrorMessage([], 'name')).toBeNull()
    })

    it('不指定字段时返回第一个错误消息', () => {
      const errors = [
        { field: 'name', message: '第一个错误', code: 'REQUIRED' as const },
        { field: 'amount', message: '第二个错误', code: 'OUT_OF_RANGE' as const },
      ]

      expect(getErrorMessage(errors)).toBe('第一个错误')
    })
  })

  describe('hasFieldError - 检查字段是否有错误', () => {
    it('精确匹配字段名应返回 true', () => {
      const errors = [{ field: 'name', message: '错误', code: 'REQUIRED' as const }]
      expect(hasFieldError(errors, 'name')).toBe(true)
    })

    it('前缀匹配（嵌套字段）应返回 true', () => {
      const errors = [
        { field: 'ingredients.name', message: '错误', code: 'REQUIRED' as const },
      ]
      expect(hasFieldError(errors, 'ingredients')).toBe(true)
    })

    it('无匹配字段应返回 false', () => {
      const errors = [{ field: 'name', message: '错误', code: 'REQUIRED' as const }]
      expect(hasFieldError(errors, 'amount')).toBe(false)
    })

    it('空错误数组应返回 false', () => {
      expect(hasFieldError([], 'name')).toBe(false)
    })
  })
})
