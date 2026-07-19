export interface EffectOption {
  id: string
  label: string
  category: string
  popular: boolean
}

export const EFFECT_OPTIONS: EffectOption[] = [
  { id: 'immune_enhancement', label: '增强免疫', category: '免疫', popular: true },
  { id: 'antioxidant', label: '抗氧化', category: '抗衰老', popular: true },
  { id: 'anti_fatigue', label: '抗疲劳', category: '体力', popular: true },
  { id: 'qi_nourishing', label: '补气养阴', category: '滋补', popular: true },
  { id: 'blood_pressure', label: '降血压', category: '心血管', popular: false },
  { id: 'blood_sugar', label: '降血糖', category: '代谢', popular: false },
  { id: 'sleep_improvement', label: '改善睡眠', category: '神经', popular: false },
]

// 后端默认功效（与 GAConfig.__post_init__ 保持一致）
export const DEFAULT_EFFECT = 'immune_enhancement'

export const getEffectById = (id: string): EffectOption | undefined => {
  return EFFECT_OPTIONS.find(effect => effect.id === id)
}

export const getPopularEffects = (): EffectOption[] => {
  return EFFECT_OPTIONS.filter(effect => effect.popular)
}

export const getEffectsByCategory = (category: string): EffectOption[] => {
  return EFFECT_OPTIONS.filter(effect => effect.category === category)
}
