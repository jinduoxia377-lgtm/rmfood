/**
 * 配方成分输入组件工具函数
 */

import type { FormulaIngredient, ValidationError, FormulaTemplate, IngredientParameter } from './types';


import { logger } from '@/utils/safeLogger';
// 生成唯一ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// 验证数值范围
export const validateNumberRange = (
  value: number | null,
  min: number,
  max: number,
  fieldName: string
): ValidationError | null => {
  if (value === null) return null;
  if (value < min) {
    return {
      field: fieldName,
      message: `${fieldName}值小于最小值`,
      suggestion: `请输入${min}到${max}之间的值`,
    };
  }
  if (value > max) {
    return {
      field: fieldName,
      message: `${fieldName}值大于最大值`,
      suggestion: `请输入${min}到${max}之间的值`,
    };
  }
  return null;
};

// 验证必填参数
export const validateRequiredParameters = (
  ingredient: FormulaIngredient
): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  for (const param of ingredient.parameters) {
    if (param.required && (param.value === null || param.value === undefined)) {
      errors.push({
        field: `${ingredient.name}-${param.name}`,
        message: `${ingredient.name}的${param.name}为必填项`,
        suggestion: `请输入${ingredient.name}的${param.name}值`,
      });
    }
  }
  
  return errors;
};

// 验证比例总和
export const validateRatioSum = (ingredients: FormulaIngredient[]): ValidationError | null => {
  const totalRatio = ingredients.reduce((sum, ing) => sum + ing.ratio, 0);
  
  if (Math.abs(totalRatio - 100) > 0.01) {
    return {
      field: 'ratio_sum',
      message: `比例总和不为100%，当前总和为${totalRatio.toFixed(2)}%`,
      suggestion: '请调整各成分比例，确保总和为100%',
    };
  }
  return null;
};

// 验证成分数量
export const validateIngredientCount = (
  ingredients: FormulaIngredient[]
): ValidationError | null => {
  if (ingredients.length === 0) {
    return {
      field: 'ingredient_count',
      message: '未添加任何成分',
      suggestion: '请至少添加一种成分',
    };
  }
  if (ingredients.length > 50) {
    return {
      field: 'ingredient_count',
      message: '成分数量超过限制',
      suggestion: '最多支持50种成分',
    };
  }
  return null;
};

// 完整验证
export const validateForm = (ingredients: FormulaIngredient[]): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  // 验证成分数量
  const countError = validateIngredientCount(ingredients);
  if (countError) errors.push(countError);
  
  // 验证比例总和
  const ratioError = validateRatioSum(ingredients);
  if (ratioError) errors.push(ratioError);
  
  // 验证每个成分的必填参数
  for (const ingredient of ingredients) {
    const paramErrors = validateRequiredParameters(ingredient);
    errors.push(...paramErrors);
    
    // 验证比例范围
    const ratioRangeError = validateNumberRange(
      ingredient.ratio,
      0,
      100,
      `${ingredient.name}比例`
    );
    if (ratioRangeError) errors.push(ratioRangeError);
  }
  
  return errors;
};

// 计算各成分实际克数
export const calculateDosages = (
  ingredients: FormulaIngredient[],
  totalWeight: number
): FormulaIngredient[] => {
  return ingredients.map((ing) => ({
    ...ing,
    dosage: Math.round((ing.ratio / 100) * totalWeight * 10) / 10,
  }));
};

// 单位转换：百分比转质量
export const percentageToMass = (percentage: number, totalWeight: number): number => {
  return (percentage / 100) * totalWeight;
};

// 单位转换：质量转百分比
export const massToPercentage = (mass: number, totalWeight: number): number => {
  if (totalWeight === 0) return 0;
  return (mass / totalWeight) * 100;
};

// localStorage 存储键
const STORAGE_KEY = 'rmfood-formula-ingredients';
const TEMPLATES_KEY = 'rmfood-formula-templates';

// 保存配方到本地存储
export const saveToLocalStorage = (data: {
  ingredients: FormulaIngredient[];
  totalWeight: number;
}): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    logger.error('Failed to save to localStorage:', error);
  }
};

// 从本地存储加载配方
export const loadFromLocalStorage = (): {
  ingredients: FormulaIngredient[];
  totalWeight: number;
} | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Failed to load from localStorage:', error);
  }
  return null;
};

// 保存自定义模板到本地存储
export const saveTemplate = (template: Omit<FormulaTemplate, 'id' | 'createdAt' | 'isSystem'>): void => {
  try {
    const existing = loadTemplates();
    const newTemplate: FormulaTemplate = {
      ...template,
      id: generateId(),
      createdAt: new Date().toISOString(),
      isSystem: false,
    };
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify([...existing, newTemplate]));
  } catch (error) {
    logger.error('Failed to save template:', error);
  }
};

// 加载所有模板（包括系统预设和用户自定义）
export const loadTemplates = (): FormulaTemplate[] => {
  try {
    const customTemplates = localStorage.getItem(TEMPLATES_KEY);
    const custom = customTemplates ? JSON.parse(customTemplates) : [];
    return custom;
  } catch (error) {
    logger.error('Failed to load templates:', error);
    return [];
  }
};

// 删除自定义模板
export const deleteTemplate = (templateId: string): void => {
  try {
    const templates = loadTemplates();
    const filtered = templates.filter((t) => t.id !== templateId);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(filtered));
  } catch (error) {
    logger.error('Failed to delete template:', error);
  }
};

// 创建新成分
export const createNewIngredient = (): FormulaIngredient => {
  const { DEFAULT_PARAMETERS } = require('./types');
  return {
    id: generateId(),
    name: '',
    nameCn: '',
    ratio: 0,
    unit: 'percentage',
    dosage: 0,
    parameters: DEFAULT_PARAMETERS.map((p: Omit<IngredientParameter, 'id' | 'value'>) => ({
      ...p,
      id: generateId(),
      value: null,
    })),
  };
};

// 复制成分
export const duplicateIngredient = (ingredient: FormulaIngredient): FormulaIngredient => {
  return {
    ...ingredient,
    id: generateId(),
    name: `${ingredient.name} (副本)`,
    parameters: ingredient.parameters.map((p) => ({
      ...p,
      id: generateId(),
    })),
  };
};

// 生成NSGA-II算法输入格式
export const formatForNSGAII = (
  ingredients: FormulaIngredient[],
  totalWeight: number
): {
  ingredients: Array<{
    id: string;
    name: string;
    dosage: number;
    parameters: Record<string, number | null>;
  }>;
  total_weight: number;
} => {
  const calculated = calculateDosages(ingredients, totalWeight);
  
  return {
    ingredients: calculated.map((ing) => ({
      id: ing.id,
      name: ing.nameCn || ing.name,
      dosage: ing.dosage,
      parameters: ing.parameters.reduce((acc, p) => {
        acc[p.nameEn] = p.value;
        return acc;
      }, {} as Record<string, number | null>),
    })),
    total_weight: totalWeight,
  };
};

// 计算各成分的平均参数值
export const calculateAverageParameters = (
  ingredients: FormulaIngredient[]
): Record<string, number> => {
  const paramSums: Record<string, number> = {};
  const paramCounts: Record<string, number> = {};
  
  for (const ing of ingredients) {
    for (const param of ing.parameters) {
      if (param.value !== null) {
        paramSums[param.nameEn] = (paramSums[param.nameEn] || 0) + param.value;
        paramCounts[param.nameEn] = (paramCounts[param.nameEn] || 0) + 1;
      }
    }
  }
  
  const averages: Record<string, number> = {};
  for (const [key, sum] of Object.entries(paramSums)) {
    averages[key] = sum / paramCounts[key];
  }
  
  return averages;
};
