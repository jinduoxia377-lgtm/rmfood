/**
 * Stability API Client — Arrhenius Stability Prediction
 * 对接 /stability/* 端点（axios baseURL 已含 /api/v1，路径不带前缀）
 */
import api from '@/api/client'

export interface StabilityIngredient {
  name: string
  dosage_mg: number
  percentage?: number
}

export interface StabilityPredictRequest {
  ingredients: StabilityIngredient[]
  storage_temp?: number
  storage_humidity?: number
  light_exposure?: 'dark' | 'normal' | 'bright'
  packaging?: 'standard' | 'amber_bottle' | 'vacuum' | 'nitrogen_flushed'
  months_to_predict?: number
}

export interface Q10Request {
  ingredients: StabilityIngredient[]
  t1: number
  t2: number
}

export interface StabilityPrediction {
  status: string
  data: {
    stability_score: number
    estimated_shelf_life_months: number
    risk_factors: Array<{ type: string; severity: number; description: string }>
    monthly_curve: Array<{ month: number; remaining_pct: number }>
    storage_advice: string[]
    shelf_life_details: {
      months_to_90: number
      months_to_80: number
      predicted_months: number
      confidence: number
    }
  }
}

export interface KnownIngredient {
  name: string
  k_25_per_month: number
  activation_energy_J: number
  light_factor: number
  ph_window: [number, number]
  base_shelf_life_months: number
}

export interface KnownIngredientsResponse {
  status: string
  count: number
  ingredients: KnownIngredient[]
}

export const stabilityApi = {
  health: () => api.get('/stability/health'),

  predict: (data: StabilityPredictRequest) =>
    api.post<{ status: string; data: StabilityPrediction['data'] }>(
      '/stability/predict',
      data,
    ),

  q10: (data: Q10Request) =>
    api.post('/stability/q10', data),

  listIngredients: () =>
    api.get<KnownIngredientsResponse>('/stability/ingredients'),
}
