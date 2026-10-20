/**
 * 配方验证工具函数库
 *
 * 提供完整的前端验证规则，用于表单校验和数据完整性检查
 */

import type {
  FieldValidationError,
  ValidationErrorCode,
  FormulaValidationResult,
} from '@/types/formula'
import type { IngredientItem } from '@/types/index'

const ERROR_CODES = {
  REQUIRED: 'REQUIRED' as ValidationErrorCode,
  INVALID_FORMAT: 'INVALID_FORMAT' as ValidationErrorCode,
  OUT_OF_RANGE: 'OUT_OF_RANGE' as ValidationErrorCode,
  SUM_NOT_100: 'SUM_NOT_100' as ValidationErrorCode,
  DUPLICATE_NAME: 'DUPLICATE_NAME' as ValidationErrorCode,
  MIN_LENGTH: 'MIN_LENGTH' as ValidationErrorCode,
  MAX_LENGTH: 'MAX_LENGTH' as ValidationErrorCode,
  INVALID_CHARACTERS: 'INVALID_CHARACTERS' as ValidationErrorCode,
  CUSTOM_RULE_FAILED: 'CUSTOM_RULE_FAILED' as ValidationErrorCode,
}

function createError(
  field: string,
  message: string,
  code: ValidationErrorCode,
): FieldValidationError {
  return { field, message, code }
}

export function validateFormulaName(name: string): FieldValidationError[] {
  const errors: FieldValidationError[] = []

  if (!name || name.trim().length === 0) {
    errors.push(createError('name', '配方名称不能为空', ERROR_CODES.REQUIRED))
    return errors
  }

  if (name.trim().length < 2) {
    errors.push(
      createError(
        'name',
        '配方名称至少需要2个字符',
        ERROR_CODES.MIN_LENGTH,
      ),
    )
  }

  if (name.trim().length > 100) {
    errors.push(
      createError(
        'name',
        '配方名称不能超过100个字符',
        ERROR_CODES.MAX_LENGTH,
      ),
    )
  }

  const invalidCharPattern = /[<>"'\\/]/
  if (invalidCharPattern.test(name)) {
    errors.push(
      createError(
        'name',
        '配方名称包含非法字符（< > " \' \\ /）',
        ERROR_CODES.INVALID_CHARACTERS,
      ),
    )
  }

  return errors
}

export function validateIngredient(
  ingredient: Partial<IngredientItem> & { name?: string; amount?: number; percentage?: number },
): FieldValidationError[] {
  const errors: FieldValidationError[] = []

  if (!ingredient.name || ingredient.name.trim().length === 0) {
    errors.push(createError('name', '成分名称不能为空', ERROR_CODES.REQUIRED))
  } else {
    if (ingredient.name.trim().length < 1) {
      errors.push(createError('name', '成分名称至少需要1个字符', ERROR_CODES.MIN_LENGTH))
    }
    if (ingredient.name.trim().length > 50) {
      errors.push(createError('name', '成分名称不能超过50个字符', ERROR_CODES.MAX_LENGTH))
    }
  }

  if (ingredient.amount === undefined || ingredient.amount === null) {
    errors.push(createError('amount', '用量不能为空', ERROR_CODES.REQUIRED))
  } else if (ingredient.amount < 0) {
    errors.push(createError('amount', '用量不能为负数', ERROR_CODES.OUT_OF_RANGE))
  } else if (ingredient.amount > 1000000) {
    errors.push(createError('amount', '用量超出合理范围', ERROR_CODES.OUT_OF_RANGE))
  }

  if (ingredient.percentage === undefined || ingredient.percentage === null) {
    errors.push(createError('percentage', '比例不能为空', ERROR_CODES.REQUIRED))
  } else if (ingredient.percentage < 0 || ingredient.percentage > 100) {
    errors.push(createError('percentage', '比例必须在 0-100 之间', ERROR_CODES.OUT_OF_RANGE))
  }

  return errors
}

export function validateIngredientList(
  ingredients: { name?: string; percentage?: number }[],
): FieldValidationError[] {
  const errors: FieldValidationError[] = []

  if (!ingredients || ingredients.length === 0) {
    errors.push(createError('ingredients', '至少需要添加一个成分', ERROR_CODES.REQUIRED))
    return errors
  }

  const names = ingredients.map((ing) => ing.name?.trim()).filter(Boolean)
  const uniqueNames = new Set(names)

  if (uniqueNames.size !== names.length) {
    errors.push(
      createError('ingredients', '存在重复的成分名称', ERROR_CODES.DUPLICATE_NAME),
    )
  }

  const totalPercentage = ingredients.reduce((sum, ing) => sum + (ing.percentage ?? 0), 0)

  if (Math.abs(totalPercentage - 100) > 0.01) {
    errors.push(
      createError(
        'ingredients',
        `所有成分比例之和必须等于 100%，当前总和：${totalPercentage.toFixed(2)}%`,
        ERROR_CODES.SUM_NOT_100,
      ),
    )
  }

  ingredients.forEach((ingredient, index) => {
    const ingredientErrors = validateIngredient(ingredient)
    ingredientErrors.forEach((error) => {
      errors.push({
        ...error,
        field: `ingredients[${index}].${error.field}`,
      })
    })
  })

  return errors
}

export function validateFormulaSteps(
  steps: { step_number?: number; description?: string }[],
): FieldValidationError[] {
  const errors: FieldValidationError[] = []

  if (!steps || steps.length === 0) {
    return errors
  }

  const stepNumbers = steps.map((s) => s.step_number).filter(Boolean) as number[]
  const uniqueStepNumbers = new Set(stepNumbers)

  if (uniqueStepNumbers.size !== stepNumbers.length) {
    errors.push(
      createError('process_steps', '存在重复的步骤编号', ERROR_CODES.DUPLICATE_NAME),
    )
  }

  steps.forEach((step, index) => {
    if (!step.description || step.description.trim().length === 0) {
      errors.push(
        createError(
          `process_steps[${index}].description`,
          `步骤 ${step.step_number ?? index + 1} 的描述不能为空`,
          ERROR_CODES.REQUIRED,
        ),
      )
    } else if (step.description.trim().length < 5) {
      errors.push(
        createError(
          `process_steps[${index}].description`,
          `步骤 ${step.step_number ?? index + 1} 的描述至少需要5个字符`,
          ERROR_CODES.MIN_LENGTH,
        ),
      )
    }
  })

  return errors
}

export function validateFormulaEffects(effects: string[]): FieldValidationError[] {
  const errors: FieldValidationError[] = []

  if (!effects || effects.length === 0) {
    return errors
  }

  effects.forEach((effect, index) => {
    if (!effect || effect.trim().length === 0) {
      errors.push(
        createError(
          `effects[${index}]`,
          '效果标签不能为空字符串',
          ERROR_CODES.REQUIRED,
        ),
      )
    }
  })

  const uniqueEffects = new Set(effects.map((e) => e.trim()))
  if (uniqueEffects.size !== effects.length) {
    errors.push(
      createError('effects', '存在重复的效果标签', ERROR_CODES.DUPLICATE_NAME),
    )
  }

  if (effects.length > 20) {
    errors.push(
      createError('effects', '效果标签数量不能超过20个', ERROR_CODES.MAX_LENGTH),
    )
  }

  return errors
}

export interface FormulaValidationInput {
  name?: string
  description?: string
  category?: string
  ingredients?: {
    name?: string
    amount?: number
    unit?: string
    percentage?: number
    role?: string
  }[]
  process_steps?: {
    step_number?: number
    description?: string
  }[]
  effects?: string[]
  estimated_cost?: number
  tags?: string[]
}

export function validateFullFormula(
  data: FormulaValidationInput,
): FormulaValidationResult {
  const errors: FieldValidationError[] = []
  const warnings: FieldValidationError[] = []

  const nameErrors = validateFormulaName(data.name ?? '')
  errors.push(...nameErrors)

  if (data.ingredients && data.ingredients.length > 0) {
    const ingredientErrors = validateIngredientList(data.ingredients)
    errors.push(...ingredientErrors)
  }

  if (data.process_steps && data.process_steps.length > 0) {
    const stepErrors = validateFormulaSteps(data.process_steps)
    errors.push(...stepErrors)
  }

  if (data.effects && data.effects.length > 0) {
    const effectErrors = validateFormulaEffects(data.effects)
    errors.push(...effectErrors)
  }

  if (data.estimated_cost !== undefined && data.estimated_cost !== null) {
    if (data.estimated_cost < 0) {
      errors.push(
        createError(
          'estimated_cost',
          '预估成本不能为负数',
          ERROR_CODES.OUT_OF_RANGE,
        ),
      )
    }
  }

  if (data.tags && data.tags.length > 10) {
    warnings.push(
      createError(
        'tags',
        '标签数量较多，建议控制在10个以内以便于管理',
        ERROR_CODES.CUSTOM_RULE_FAILED,
      ),
    )
  }

  if (data.description && data.description.length > 2000) {
    warnings.push(
      createError(
        'description',
        '描述内容过长，建议精简至2000字以内',
        ERROR_CODES.MAX_LENGTH,
      ),
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export function getErrorMessage(errors: FieldValidationError[], field?: string): string | null {
  if (field) {
    const fieldError = errors.find((e) => e.field === field)
    return fieldError?.message ?? null
  }
  return errors[0]?.message ?? null
}

export function hasFieldError(errors: FieldValidationError[], field: string): boolean {
  return errors.some((e) => e.field === field || e.field.startsWith(`${field}.`))
}
