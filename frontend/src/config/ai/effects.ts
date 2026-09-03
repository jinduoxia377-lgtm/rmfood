export interface EffectOption {
  id: string
  label: string
  category: string
  popular: boolean
}

export const EFFECT_OPTIONS: EffectOption[] = [
  // ═══════════════════════════════════════════
  // 免疫类（3条）
  // ═══════════════════════════════════════════
  { id: 'immune_enhancement', label: '增强免疫', category: '免疫', popular: true },
  { id: 'immune_regulation', label: '免疫调节', category: '免疫', popular: false },
  { id: 'resistance_boost', label: '提高抵抗力', category: '免疫', popular: false },

  // ═══════════════════════════════════════════
  // 抗衰老类（3条）
  // ═══════════════════════════════════════════
  { id: 'antioxidant', label: '抗氧化', category: '抗衰老', popular: true },
  { id: 'anti_aging', label: '延缓衰老', category: '抗衰老', popular: false },
  { id: 'free_radical_clear', label: '清除自由基', category: '抗衰老', popular: false },

  // ═══════════════════════════════════════════
  // 体力类（3条）
  // ═══════════════════════════════════════════
  { id: 'anti_fatigue', label: '抗疲劳', category: '体力', popular: true },
  { id: 'fatigue_relief', label: '缓解疲劳', category: '体力', popular: false },
  { id: 'energy_boost', label: '提升精力', category: '体力', popular: false },

  // ═══════════════════════════════════════════
  // 滋补类（4条）
  // ═══════════════════════════════════════════
  { id: 'qi_nourishing', label: '补气养阴', category: '滋补', popular: true },
  { id: 'yin_nourishing', label: '滋阴补肾', category: '滋补', popular: false },
  { id: 'spleen_qi_tonifying', label: '健脾益气', category: '滋补', popular: false },
  { id: 'blood_nourishing', label: '补血养血', category: '滋补', popular: false },

  // ═══════════════════════════════════════════
  // 心血管类（4条）
  // ═══════════════════════════════════════════
  { id: 'blood_pressure', label: '降血压', category: '心血管', popular: false },
  { id: 'blood_lipid', label: '降血脂', category: '心血管', popular: false },
  { id: 'vascular_protection', label: '保护血管', category: '心血管', popular: false },
  { id: 'circulation_promotion', label: '促进循环', category: '心血管', popular: false },

  // ═══════════════════════════════════════════
  // 代谢类（4条）
  // ═══════════════════════════════════════════
  { id: 'blood_sugar', label: '降血糖', category: '代谢', popular: false },
  { id: 'uric_acid', label: '辅助降尿酸', category: '代谢', popular: false },
  { id: 'metabolism_regulation', label: '调节代谢', category: '代谢', popular: false },
  { id: 'weight_management', label: '控制体重', category: '代谢', popular: false },

  // ═══════════════════════════════════════════
  // 神经类（3条）
  // ═══════════════════════════════════════════
  { id: 'sleep_improvement', label: '改善睡眠', category: '神经', popular: false },
  { id: 'calm_mind', label: '安神定志', category: '神经', popular: false },
  { id: 'anxiety_relief', label: '缓解焦虑', category: '神经', popular: false },

  // ═══════════════════════════════════════════
  // 消化类（3条）
  // ═══════════════════════════════════════════
  { id: 'spleen_stomach', label: '健脾养胃', category: '消化', popular: false },
  { id: 'digestion_promotion', label: '促进消化', category: '消化', popular: false },
  { id: 'digestive_regulation', label: '调理脾胃', category: '消化', popular: false },

  // ═══════════════════════════════════════════
  // 呼吸系统（2条）
  // ═══════════════════════════════════════════
  { id: 'lung_nourishing', label: '润肺止咳', category: '呼吸', popular: false },
  { id: 'throat_clearing', label: '清咽利喉', category: '呼吸', popular: false },

  // ═══════════════════════════════════════════
  // 视觉类（2条）
  // ═══════════════════════════════════════════
  { id: 'eye_protection', label: '明目护眼', category: '视觉', popular: false },
  { id: 'eye_fatigue_relief', label: '缓解眼疲劳', category: '视觉', popular: false },

  // ═══════════════════════════════════════════
  // 美容类（2条）
  // ═══════════════════════════════════════════
  { id: 'beauty_skin', label: '美容养颜', category: '美容', popular: false },
  { id: 'skin_moisturizing', label: '护肤保湿', category: '美容', popular: false },

  // ═══════════════════════════════════════════
  // 骨骼类（2条）
  // ═══════════════════════════════════════════
  { id: 'bone_strength', label: '强健筋骨', category: '骨骼', popular: false },
  { id: 'calcium_supplement', label: '补钙健骨', category: '骨骼', popular: false },
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

/** 获取所有功效分类列表 */
export const EFFECT_CATEGORIES = [...new Set(EFFECT_OPTIONS.map(e => e.category))]

/** 按分类分组的功效映射 */
export const EFFECT_OPTIONS_BY_CATEGORY: Record<string, EffectOption[]> =
  EFFECT_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = EFFECT_OPTIONS.filter(e => e.category === cat)
    return acc
  }, {} as Record<string, EffectOption[]>)
