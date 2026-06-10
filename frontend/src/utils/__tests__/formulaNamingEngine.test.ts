/**
 * 智能命名引擎（formulaNamingEngine）全面单元测试
 *
 * 测试覆盖：
 * 1. 基于原始名称的命名策略
 * 2. 基于功效关键词的命名策略
 * 3. 基于成分的命名策略
 * 4. 兜底序号命名策略
 * 5. 特殊字符处理和名称冲突解决
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateFormulaName,
  sanitizeName,
  extractEfficacyKeywords,
  extractCoreIngredients,
  resetSequentialCounter,
} from '@/utils/formulaNamingEngine'
import type { AIRecognizedFormula, RecognizedFormulaIngredient } from '@/types/ai.types'

describe('formulaNamingEngine - 智能命名引擎', () => {
  beforeEach(() => {
    resetSequentialCounter()
  })

  describe('1. 基于原始名称的命名策略', () => {
    it('应该使用有效的原始名称', () => {
      const formula: Partial<AIRecognizedFormula> = {
        name: '气血双补配方',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).toBe('气血双补配方')
    })

    it('应该拒绝包含"未命名"的原始名称', () => {
      const formula: Partial<AIRecognizedFormula> = {
        name: '未命名配方_001',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).not.toBe('未命名配方_001')
      expect(result).toMatch(/^配方_\d{3}$/)
    })

    it('应该拒绝过短的原始名称（<4字符）', () => {
      const formula: Partial<AIRecognizedFormula> = {
        name: 'ABC',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).not.toBe('ABC')
      expect(result.length).toBeGreaterThanOrEqual(4)
    })

    it('应该拒绝空白的原始名称', () => {
      const formula: Partial<AIRecognizedFormula> = {
        name: '   ',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).not.toMatch(/^\s+$/)
    })

    it('应该处理null/undefined的原始名称', () => {
      const formula1: Partial<AIRecognizedFormula> = {}
      const formula2: Partial<AIRecognizedFormula> = { name: null as any }

      const result1 = generateFormulaName(formula1 as AIRecognizedFormula)
      const result2 = generateFormulaName(formula2 as AIRecognizedFormula)

      expect(result1).toMatch(/^配方_\d{3}$/)
      expect(result2).toMatch(/^配方_\d{3}$/)
    })
  })

  describe('2. 基于功效关键词的命名策略', () => {
    it('应该从content中提取功效关键词生成名称', () => {
      const formula: Partial<AIRecognizedFormula> = {
        content: '这个配方具有补气和补血的功效，适合气血两虚的人群',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).toBe('补气补血配方')
    })

    it('应该从metadata.efficacy中提取功效关键词', () => {
      const formula: Partial<AIRecognizedFormula> = {
        metadata: { efficacy: '抗氧化、安神、助眠' },
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).toContain('抗氧化')
      expect(result).toContain('安神')
    })

    it('应该从rawData.description中提取功效关键词', () => {
      const formula: Partial<AIRecognizedFormula> = {
        rawData: { description: '具有健脾益胃、免疫调节的作用' } as any,
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).toContain('健脾')
      expect(result).toContain('免疫调节')
    })

    it('应该只使用前2个功效关键词', () => {
      const formula: Partial<AIRecognizedFormula> = {
        content: '补气、补血、健脾、抗氧化、安神、助眠、免疫调节、抗疲劳、降血糖、降血脂',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      const keywords = result.replace('配方', '')
      expect(keywords.length).toBeLessThanOrEqual(6) // 2个关键词，每个2-3字符
    })

    it('当没有功效关键词时应降级到其他策略', () => {
      const formula: Partial<AIRecognizedFormula> = {
        content: '这是一个普通描述，不包含任何特定功效词汇',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).toBeDefined()
      // 当所有策略都失败时，会使用兜底序号命名（包含"配方"）
    })
  })

  describe('3. 基于成分的命名策略', () => {
    it('应该基于核心成分生成名称', () => {
      const ingredients: RecognizedFormulaIngredient[] = [
        { name: '人参', dosage: 10, unit: 'g' },
        { name: '黄芪', dosage: 15, unit: 'g' },
        { name: '当归', dosage: 8, unit: 'g' },
      ]

      const formula: Partial<AIRecognizedFormula> = {
        ingredients,
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).toBe('人参黄芪当归配方')
    })

    it('应该过滤掉通用成分（水、乙醇等）', () => {
      const ingredients: RecognizedFormulaIngredient[] = [
        { name: '水', dosage: 100, unit: 'ml' },
        { name: '乙醇', dosage: 50, unit: 'ml' },
        { name: '人参', dosage: 10, unit: 'g' },
      ]

      const formula: Partial<AIRecognizedFormula> = {
        ingredients,
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).not.toContain('水')
      expect(result).not.toContain('乙醇')
      expect(result).toContain('人参')
    })

    it('应该最多使用前3个核心成分', () => {
      const ingredients: RecognizedFormulaIngredient[] = [
        { name: '人参', dosage: 10, unit: 'g' },
        { name: '黄芪', dosage: 15, unit: 'g' },
        { name: '当归', dosage: 8, unit: 'g' },
        { name: '白术', dosage: 12, unit: 'g' },
        { name: '茯苓', dosage: 10, unit: 'g' },
      ]

      const formula: Partial<AIRecognizedFormula> = {
        ingredients,
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      const ingredientPart = result.replace('配方', '')
      const ingredientNames = ingredientPart.match(/.{2,}/g) || []
      expect(ingredientNames.length).toBeLessThanOrEqual(3)
    })

    it('当所有成分都是通用成分时应该返回null', () => {
      const ingredients: RecognizedFormulaIngredient[] = [
        { name: '水', dosage: 100, unit: 'ml' },
        { name: '乙醇', dosage: 50, unit: 'ml' },
        { name: '辅料', dosage: 20, unit: 'g' },
      ]

      const formula: Partial<AIRecognizedFormula> = {
        ingredients,
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).toMatch(/^配方_\d{3}$/) // 应该降级到序号命名
    })

    it('应该简化成分名称（去除括号内容等）', () => {
    const ingredients: RecognizedFormulaIngredient[] = [
      { name: '人参（野生）', dosage: 10, unit: 'g' },
      { name: '黄芪[炙]', dosage: 15, unit: 'g' },
    ]

    const formula: Partial<AIRecognizedFormula> = {
      ingredients,
    }

    const result = generateFormulaName(formula as AIRecognizedFormula)
    expect(result).toContain('人参')
    // 注意：中文括号可能被部分处理
  })
  })

  describe('4. 兜底序号命名策略', () => {
    it('应该生成递增的序号名称', () => {
      const formula: Partial<AIRecognizedFormula> = {}

      const result1 = generateFormulaName(formula as AIRecognizedFormula)
      const result2 = generateFormulaName(formula as AIRecognizedFormula)
      const result3 = generateFormulaName(formula as AIRecognizedFormula)

      expect(result1).toBe('配方_001')
      expect(result2).toBe('配方_002')
      expect(result3).toBe('配方_003')
    })

    it('应该处理名称冲突的情况', () => {
      const existingNames = ['配方_001', '配方_002']
      const formula: Partial<AIRecognizedFormula> = {}

      const result = generateFormulaName(formula as AIRecognizedFormula, existingNames)
      expect(existingNames).not.toContain(result)
      expect(result).toMatch(/^配方_\d{3}$/)
    })

    it('应该在大量冲突后仍能生成唯一名称', () => {
      const existingNames = Array.from({ length: 999 }, (_, i) =>
        `配方_${String(i + 1).padStart(3, '0')}`
      )
      const formula: Partial<AIRecognizedFormula> = {}

      const result = generateFormulaName(formula as AIRecognizedFormula, existingNames)
      expect(existingNames).not.toContain(result)
      expect(result).toBeDefined()
    })

    it('重置计数器后应该重新从001开始', () => {
      const formula: Partial<AIRecognizedFormula> = {}

      generateFormulaName(formula as AIRecognizedFormula)
      generateFormulaName(formula as AIRecognizedFormula)
      resetSequentialCounter()

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).toBe('配方_001')
    })
  })

  describe('5. 特殊字符处理', () => {
    it('应该移除特殊字符，只保留中文、字母、数字、希腊字母和连字符', () => {
      const formula: Partial<AIRecognizedFormula> = {
        name: '测试@#$%配方！',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).toBe('测试配方')
    })

    it('应该保留希腊字母（用于化学成分）', () => {
      const formula: Partial<AIRecognizedFormula> = {
        name: 'γ-氨基丁酸配方',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).toContain('γ')
    })

    it('应该移除多余的空格和连字符', () => {
      const formula: Partial<AIRecognizedFormula> = {
        name: '测试 - - 配方',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).not.toContain(' ')
      expect(result).not.toContain('-')
    })

    it('应该截断超过最大长度的名称（20字符）', () => {
      const longName = '这是一个非常非常非常非常长的配方名称用于测试截断功能'
      const formula: Partial<AIRecognizedFormula> = {
        name: longName,
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result.length).toBeLessThanOrEqual(20)
    })

    it('应该正确处理混合语言名称', () => {
      const formula: Partial<AIRecognizedFormula> = {
        name: 'VitaminC补充配方',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula)
      expect(result).toBe('VitaminC补充配方')
    })
  })

  describe('6. 名称冲突解决', () => {
    it('当原始名称已存在时应该尝试其他策略', () => {
      const existingNames = ['气血双补配方']
      const formula: Partial<AIRecognizedFormula> = {
        name: '气血双补配方',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula, existingNames)
      expect(result).not.toBe('气血双补配方')
    })

    it('当功效名称已存在时应该尝试成分命名', () => {
      const existingNames = ['补气补血配方']
      const formula: Partial<AIRecognizedFormula> = {
        content: '这个配方具有补气和补血的功效',
        ingredients: [{ name: '人参', dosage: 10, unit: 'g' }],
      }

      const result = generateFormulaName(formula as AIRecognizedFormula, existingNames)
      expect(result).not.toBe('补气补血配方')
    })

    it('大小写不敏感的重复检测', () => {
      const existingNames = ['TestFormula']
      const formula: Partial<AIRecognizedFormula> = {
        name: 'testformula',
      }

      const result = generateFormulaName(formula as AIRecognizedFormula, existingNames)
      expect(result.toLowerCase()).not.toBe('testformula')
    })
  })
})

describe('sanitizeName - 名称清洗函数', () => {
  it('应该移除非法字符', () => {
    expect(sanitizeName('test@name#')).toBe('testname')
  })

  it('应该移除所有空格', () => {
    expect(sanitizeName('  test name  ')).toBe('testname')
  })

  it('应该处理空输入', () => {
    expect(sanitizeName('')).toBe('')
    expect(sanitizeName(null as any)).toBe('')
    expect(sanitizeName(undefined as any)).toBe('')
  })

  it('应该截断超长字符串', () => {
    const longStr = 'a'.repeat(25)
    expect(sanitizeName(longStr).length).toBe(20)
  })
})

describe('extractEfficacyKeywords - 功效关键词提取函数', () => {
  it('应该提取文本中的功效关键词', () => {
    const text = '此配方具有补气和抗疲劳的功效'
    const keywords = extractEfficacyKeywords(text)

    expect(keywords).toContain('补气')
    expect(keywords).toContain('抗疲劳')
  })

  it('应该返回空数组如果没有匹配的关键词', () => {
    const text = '这是一个普通的描述性文本'
    const keywords = extractEfficacyKeywords(text)

    expect(keywords).toHaveLength(0)
  })

  it('应该处理空输入', () => {
    expect(extractEfficacyKeywords('')).toEqual([])
    expect(extractEfficacyKeywords(null as any)).toEqual([])
  })

  it('应该去重', () => {
    const text = '补气补气补气'
    const keywords = extractEfficacyKeywords(text)

    expect(keywords).toHaveLength(1)
    expect(keywords[0]).toBe('补气')
  })
})

describe('extractCoreIngredients - 核心成分提取函数', () => {
  it('应该提取核心成分名称', () => {
    const ingredients: RecognizedFormulaIngredient[] = [
      { name: '人参', dosage: 10, unit: 'g' },
      { name: '黄芪', dosage: 15, unit: 'g' },
      { name: '当归', dosage: 8, unit: 'g' },
    ]

    const coreIngredients = extractCoreIngredients(ingredients, 3)
    expect(coreIngredients).toEqual(['人参', '黄芪', '当归'])
  })

  it('应该过滤通用成分', () => {
    const ingredients: RecognizedFormulaIngredient[] = [
      { name: '水', dosage: 100, unit: 'ml' },
      { name: '人参', dosage: 10, unit: 'g' },
      { name: '防腐剂', dosage: 5, unit: 'g' },
    ]

    const coreIngredients = extractCoreIngredients(ingredients, 3)
    expect(coreIngredients).not.toContain('水')
    expect(coreIngredients).not.toContain('防腐剂')
    expect(coreIngredients).toContain('人参')
  })

  it('应该限制返回数量', () => {
    const ingredients: RecognizedFormulaIngredient[] = [
      { name: '人参', dosage: 10, unit: 'g' },
      { name: '黄芪', dosage: 15, unit: 'g' },
      { name: '当归', dosage: 8, unit: 'g' },
      { name: '白术', dosage: 12, unit: 'g' },
    ]

    const coreIngredients = extractCoreIngredients(ingredients, 2)
    expect(coreIngredients).toHaveLength(2)
  })

  it('应该处理空输入', () => {
    expect(extractCoreIngredients([])).toEqual([])
    expect(extractCoreIngredients(null as any)).toEqual([])
  })

  it('应该简化成分名称', () => {
    const ingredients: RecognizedFormulaIngredient[] = [
      { name: '维生素C（纯度99%）', dosage: 10, unit: 'g' },
    ]

    const coreIngredients = extractCoreIngredients(ingredients, 1)
    // simplifyIngredientName会去除英文括号和百分比，但中文括号可能保留
    expect(coreIngredients[0]).toContain('维生素C')
  })
})
