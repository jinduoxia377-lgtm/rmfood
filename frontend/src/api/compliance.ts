/**
 * 合规检查 API 客户端
 */

export interface Ingredient {
  name: string;
  dosage_mg: number;
}

export interface ComplianceViolation {
  ingredient: string;
  type: 'exceeds_limit' | 'prohibited_combo' | 'child_forbidden' | 'not_in_directory';
  message: string;
  max_allowed?: number;
  actual_value?: number;
}

export interface ComplianceResult {
  score: number;
  status: 'compliant' | 'warning' | 'non_compliant';
  violations: ComplianceViolation[];
  warnings: string[];
  suggestions: string[];
}

export interface RealtimeFeedback {
  current_score: number;
  new_score: number;
  score_delta: number;
  status: string;
  new_violations: ComplianceViolation[];
  suggestions: string[];
}

export interface AutoFixResult {
  original_score: number;
  fixed_score: number;
  original_status: string;
  fixed_status: string;
  fixes: Array<{
    ingredient: string;
    old_dosage_mg: number;
    new_dosage_mg: number;
    action: string;
  }>;
  remaining_violations: ComplianceViolation[];
  fixed_ingredients: Ingredient[];
}

const BASE = '/api/v1/compliance';

export const complianceApi = {
  /** 实时合规检查（配方编辑时调用） */
  realtimeCheck(
    ingredients: Ingredient[],
    options: { newIngredient?: Ingredient; population?: string } = {},
  ): Promise<{ success: boolean; data: ComplianceResult | RealtimeFeedback }> {
    return fetch(`${BASE}/check/realtime`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_ingredients: ingredients,
        new_ingredient: options.newIngredient,
        population: options.population ?? 'adults',
      }),
    }).then(r => r.json());
  },

  /** 批量合规检查 */
  bulkCheck(
    ingredients: Ingredient[],
    population = 'adults',
  ): Promise<{ success: boolean; data: ComplianceResult }> {
    return fetch(`${BASE}/check/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients, population }),
    }).then(r => r.json());
  },

  /** 自动修复配方 */
  autoFix(
    ingredients: Ingredient[],
    population = 'adults',
  ): Promise<{ success: boolean; data: AutoFixResult }> {
    return fetch(`${BASE}/fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredients, population }),
    }).then(r => r.json());
  },

  /** 查询药食同源目录限量 */
  getLimits(): Promise<{ success: boolean; data: { limits: Record<string, number> } }> {
    return fetch(`${BASE}/limits`).then(r => r.json());
  },

  /** 查询禁忌搭配 */
  getProhibited(): Promise<{ success: boolean; data: { combinations: Array<{ pair: string[]; rule: string }> } }> {
    return fetch(`${BASE}/prohibited`).then(r => r.json());
  },

  /** 查询GB 2760食品添加剂使用标准 */
  getGB2760(): Promise<{ success: boolean; data: { source: string; additives: Array<{ name: string; max_usage: string; categories: string[] }> } }> {
    return fetch(`${BASE}/gb2760`).then(r => r.json());
  },

  /** 查询GB 14880营养强化剂使用标准 */
  getGB14880(): Promise<{ success: boolean; data: { source: string; enrichers: Array<{ name: string; min: string; max: string; categories: string[] }> } }> {
    return fetch(`${BASE}/gb14880`).then(r => r.json());
  },

  /** 查询中国食品安全禁用品清单 */
  getGBProhibited(): Promise<{ success: boolean; data: { source: string; items: string[] } }> {
    return fetch(`${BASE}/gb-prohibited`).then(r => r.json());
  },

  /** 查询食品安全国家标准目录（支持分类筛选） */
  getStandards(category?: string): Promise<{ success: boolean; data: { source: string; count: number; standards: any[] } }> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return fetch(`${BASE}/standards${params}`).then(r => r.json());
  },

  /** 查询药食同源目录完整信息 */
  getFoodHomology(name?: string): Promise<{ success: boolean; data: { source: string; count: number; materials: any[] } }> {
    const params = name ? `?name=${encodeURIComponent(name)}` : '';
    return fetch(`${BASE}/food-homology${params}`).then(r => r.json());
  },

  /** 查询新食品原料目录 */
  getNewFoodMaterials(name?: string): Promise<{ success: boolean; data: { source: string; count: number; materials: any[] } }> {
    const params = name ? `?name=${encodeURIComponent(name)}` : '';
    return fetch(`${BASE}/new-food-materials${params}`).then(r => r.json());
  },
};

/**
 * 合规状态 Hook
 *
 * 在配方编辑时实时计算合规分数并给出反馈
 */
import { useState, useCallback } from 'react';

export function useComplianceCheck(
  ingredients: Ingredient[],
  population: 'adults' | 'children' | 'elderly' = 'adults',
) {
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    if (!ingredients.length) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await complianceApi.bulkCheck(ingredients, population);
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '合规检查失败');
    } finally {
      setLoading(false);
    }
  }, [ingredients, population]);

  return { result, loading, error, check };
}
