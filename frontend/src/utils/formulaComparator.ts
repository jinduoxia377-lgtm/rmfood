/**
 * 配方对比分析工具
 * 支持多个配方的并排对比和差异分析
 */

import type { AIRecognizedFormula } from '@/types/ai.types';

import { logger } from '@/utils/safeLogger';
export interface FormulaComparisonResult {
  formulaIds: string[];
  formulas: AIRecognizedFormula[];

  // 统计信息
  stats: {
    avgIngredientCount: number;
    maxIngredientCount: number;
    minIngredientCount: number;
    totalUniqueIngredients: string[];
    commonIngredients: string[];
  };

  // 成分对比矩阵
  ingredientMatrix: {
    ingredientName: string;
    presence: boolean[]; // 每个配方是否包含该成分
    dosages: (string | null)[]; // 每个配方中的用量（如果有）
  }[];

  // 差异分析
  differences: {
    uniqueToEach: { formulaId: string; ingredients: string[] }[];
    dosageVariations: { ingredient: string; values: (string | null)[] }[];
  };
}

/**
 * 对比多个配方
 * @param formulas - 要对比的配方数组（至少2个）
 * @returns 对比结果
 */
export function compareFormulas(formulas: AIRecognizedFormula[]): FormulaComparisonResult | null {
  if (!formulas || formulas.length < 2) {
    logger.warn('[FormulaComparator] ⚠️ 至少需要2个配方才能进行对比');
    return null;
  }

  try {
    const formulaIds = formulas.map((f) => f.id);

    // 收集所有成分名称
    const allIngredientNames = new Set<string>();
    formulas.forEach((f) => {
      f.ingredients?.forEach((ing) => {
        if (ing.name) allIngredientNames.add(ing.name);
      });
    });

    const uniqueIngredients = Array.from(allIngredientNames);

    // 构建成分对比矩阵
    const ingredientMatrix = uniqueIngredients.map((name) => {
      const presence = formulas.map((f) => f.ingredients?.some((ing) => ing.name === name) || false);

      const dosages = formulas.map((f) => {
        const ing = f.ingredients?.find((i) => i.name === name);
        return ing ? `${ing.dosage}${ing.unit || ''}` : null;
      });

      return { ingredientName: name, presence, dosages };
    });

    // 计算统计信息
    const ingredientCounts = formulas.map((f) => f.ingredientCount || 0);
    const avgIngredientCount = Math.round(ingredientCounts.reduce((sum, count) => sum + count, 0) / formulas.length);

    // 找出共同成分（所有配方都包含的）
    const commonIngredients = uniqueIngredients.filter((name) =>
      formulas.every((f) => f.ingredients?.some((ing) => ing.name === name)),
    );

    // 找出每个配方独有的成分
    const uniqueToEach = formulas.map((f, idx) => ({
      formulaId: f.id,
      ingredients: uniqueIngredients.filter((name) => {
        const inCurrentFormula = f.ingredients?.some((ing) => ing.name === name);
        const inOtherFormulas = formulas
          .filter((_, i) => i !== idx)
          .some((other) => other.ingredients?.some((ing) => ing.name === name));
        return inCurrentFormula && !inOtherFormulas;
      }),
    }));

    // 找出用量差异（同一成分在不同配方中的用量不同）
    const dosageVariations = uniqueIngredients
      .filter((name) => {
        const dosages = formulas.map((f) => {
          const ing = f.ingredients?.find((i) => i.name === name);
          return ing ? `${ing.dosage}${ing.unit || ''}` : null;
        });

        // 过滤掉只在1个配方中出现的成分
        const validDosages = dosages.filter((d) => d !== null);
        return validDosages.length >= 2 && new Set(validDosages).size > 1;
      })
      .map((name) => ({
        ingredient: name,
        values: formulas.map((f) => {
          const ing = f.ingredients?.find((i) => i.name === name);
          return ing ? `${ing.dosage}${ing.unit || ''}` : null;
        }),
      }));

    return {
      formulaIds,
      formulas,
      stats: {
        avgIngredientCount,
        maxIngredientCount: Math.max(...ingredientCounts),
        minIngredientCount: Math.min(...ingredientCounts),
        totalUniqueIngredients: uniqueIngredients,
        commonIngredients,
      },
      ingredientMatrix,
      differences: {
        uniqueToEach,
        dosageVariations,
      },
    };
  } catch (e) {
    logger.error('[FormulaComparator] ❌ 配方对比失败:', e);
    return null;
  }
}

/**
 * 生成对比报告文本
 */
export function generateComparisonReport(result: FormulaComparisonResult): string {
  if (!result) return '';

  const lines = [
    '📊 配方对比分析报告',
    '='.repeat(50),
    '',
    `对比配方数量: ${result.formulas.length}`,
    `平均成分数量: ${result.stats.avgIngredientCount} 种`,
    `成分数量范围: ${result.stats.minIngredientCount}-${result.stats.maxIngredientCount} 种`,
    `总独立成分数: ${result.stats.totalUniqueIngredients.length} 种`,
    `共同成分数: ${result.stats.commonIngredients.length} 种`,
    '',
    '-'.repeat(50),
    '📋 配方列表:',
    ...result.formulas.map(
      (f, i) => `${i + 1}. ${f.name} (${f.ingredientCount}种成分, 置信度${(f.confidence * 100).toFixed(0)}%)`,
    ),
    '',
    '-'.repeat(50),
    result.stats.commonIngredients.length > 0
      ? `✅ 共同成分 (${result.stats.commonIngredients.length}种):\n${result.stats.commonIngredients.join(', ')}`
      : '⚠️ 无共同成分',
    '',
    '-'.repeat(50),
    '🔍 差异分析:',
  ];

  result.differences.uniqueToEach.forEach((unique, idx) => {
    const formula = result.formulas.find((f) => f.id === unique.formulaId);
    if (unique.ingredients.length > 0) {
      lines.push(`\n${formula?.name || '配方' + (idx + 1)} 独有成分:`);
      lines.push(...unique.ingredients.map((ing) => `  - ${ing}`));
    }
  });

  if (result.differences.dosageVariations.length > 0) {
    lines.push('', '⚖️ 用量差异:');
    result.differences.dosageVariations.forEach((variation) => {
      lines.push(`  ${variation.ingredient}:`);
      variation.values.forEach((value, i) => {
        lines.push(`    ${result.formulas[i]?.name || '配方' + (i + 1)}: ${value || '未使用'}`);
      });
    });
  }

  lines.push('', '='.repeat(50));
  lines.push('由 RMFOOD 配方平台自动生成');

  return lines.join('\n');
}
