/**
 * Ingredient Analysis API Client
 * 对接 /ingredients/* 端点（axios baseURL 已含 /api/v1，路径不带前缀）
 */
import api from './client'

export interface IngredientItem {
  name: string
  additive?: string
}

export interface AnalyzeRequest {
  ingredient_text: string
  ingredients?: IngredientItem[]
  nutrition?: Record<string, number>
  serving_size?: string
}

export interface AdditiveInfo {
  eCode: string
  name: string
  function: string
  risk: 'low' | 'medium' | 'high'
  maxUsage?: string
  carcinogen?: boolean
  allergen?: boolean
  phenylketonuria?: boolean
}

export interface AnalysisResult {
  timestamp: string
  ingredientText: string
  ingredients: string[]
  nutriScore: number
  nutriGrade: { grade: string; color: string; label: string }
  novaResult: { group: number; label: string; description: string }
  additives: AdditiveInfo[]
  allergens: Array<{ name: string; level: string }>
  herbalIngredients: Array<{ name: string; tcmProperty: string }>
  nutritionTable: Array<{ nutrient: string; value: number; unit: string }>
  suggestions: Array<{ type: string; message: string }>
  overallScore: number
  overallGrade: { grade: string; color: string; label: string }
  riskLevel: 'low' | 'medium' | 'high'
  riskMessages: string[]
  servingSize: string
}

export interface FoodHomologyItem {
  name: string
  property: string
  category: string
  effect: string
}

export const ingredientApi = {
  analyze: (data: AnalyzeRequest) => api.post<AnalysisResult>('/ingredients/analyze', data),

  batchAnalyze: (data: { items: AnalyzeRequest[] }) =>
    api.post<Array<AnalysisResult>>('/ingredients/batch-analyze', data),

  getAdditives: () =>
    api.get<{ success: boolean; data: AdditiveInfo[]; total: number }>('/ingredients/additives'),

  getFoodHomology: () =>
    api.get<{ success: boolean; data: FoodHomologyItem[]; total: number }>('/ingredients/food-homology'),

  getHealthScore: (score: number) =>
    api.get(`/ingredients/health-score/${score}`),

  getIngredients: (params?: { page?: number; page_size?: number; search?: string }) =>
    api.get<{ success: boolean; data: { items: any[]; total: number } }>(
      '/ingredients',
      { params },
    ),
}
