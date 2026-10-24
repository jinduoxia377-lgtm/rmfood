export interface EffectOption {
  id: string
  label: string
  /** i18n key 后缀（ai.formula.effects.labels.*），用于切换语言时翻译功效名 */
  labelKey: string
  category: string
  /** i18n key 后缀（ai.formula.effects.categories.*），用于切换语言时翻译分类名 */
  categoryKey: string
  popular: boolean
}

export const EFFECT_OPTIONS: EffectOption[] = [
  // ═══════════════════════════════════════════
  // 免疫类（3条）
  // ═══════════════════════════════════════════
  { id: 'immune_enhancement', label: '增强免疫', labelKey: 'immune_enhancement', category: '免疫', categoryKey: 'immune', popular: true },
  { id: 'immune_regulation', label: '免疫调节', labelKey: 'immune_regulation', category: '免疫', categoryKey: 'immune', popular: false },
  { id: 'resistance_boost', label: '提高抵抗力', labelKey: 'resistance_boost', category: '免疫', categoryKey: 'immune', popular: false },

  // ═══════════════════════════════════════════
  // 抗衰老类（3条）
  // ═══════════════════════════════════════════
  { id: 'antioxidant', label: '抗氧化', labelKey: 'antioxidant', category: '抗衰老', categoryKey: 'antiAging', popular: true },
  { id: 'anti_aging', label: '延缓衰老', labelKey: 'anti_aging', category: '抗衰老', categoryKey: 'antiAging', popular: false },
  { id: 'free_radical_clear', label: '清除自由基', labelKey: 'free_radical_clear', category: '抗衰老', categoryKey: 'antiAging', popular: false },

  // ═══════════════════════════════════════════
  // 体力类（3条）
  // ═══════════════════════════════════════════
  { id: 'anti_fatigue', label: '抗疲劳', labelKey: 'anti_fatigue', category: '体力', categoryKey: 'stamina', popular: true },
  { id: 'fatigue_relief', label: '缓解疲劳', labelKey: 'fatigue_relief', category: '体力', categoryKey: 'stamina', popular: false },
  { id: 'energy_boost', label: '提升精力', labelKey: 'energy_boost', category: '体力', categoryKey: 'stamina', popular: false },

  // ═══════════════════════════════════════════
  // 滋补类（4条）
  // ═══════════════════════════════════════════
  { id: 'qi_nourishing', label: '补气养阴', labelKey: 'qi_nourishing', category: '滋补', categoryKey: 'nourishing', popular: true },
  { id: 'yin_nourishing', label: '滋阴补肾', labelKey: 'yin_nourishing', category: '滋补', categoryKey: 'nourishing', popular: false },
  { id: 'spleen_qi_tonifying', label: '健脾益气', labelKey: 'spleen_qi_tonifying', category: '滋补', categoryKey: 'nourishing', popular: false },
  { id: 'blood_nourishing', label: '补血养血', labelKey: 'blood_nourishing', category: '滋补', categoryKey: 'nourishing', popular: false },

  // ═══════════════════════════════════════════
  // 心血管类（4条）
  // ═══════════════════════════════════════════
  { id: 'blood_pressure', label: '降血压', labelKey: 'blood_pressure', category: '心血管', categoryKey: 'cardiovascular', popular: false },
  { id: 'blood_lipid', label: '降血脂', labelKey: 'blood_lipid', category: '心血管', categoryKey: 'cardiovascular', popular: false },
  { id: 'vascular_protection', label: '保护血管', labelKey: 'vascular_protection', category: '心血管', categoryKey: 'cardiovascular', popular: false },
  { id: 'circulation_promotion', label: '促进循环', labelKey: 'circulation_promotion', category: '心血管', categoryKey: 'cardiovascular', popular: false },

  // ═══════════════════════════════════════════
  // 代谢类（4条）
  // ═══════════════════════════════════════════
  { id: 'blood_sugar', label: '降血糖', labelKey: 'blood_sugar', category: '代谢', categoryKey: 'metabolism', popular: false },
  { id: 'uric_acid', label: '辅助降尿酸', labelKey: 'uric_acid', category: '代谢', categoryKey: 'metabolism', popular: false },
  { id: 'metabolism_regulation', label: '调节代谢', labelKey: 'metabolism_regulation', category: '代谢', categoryKey: 'metabolism', popular: false },
  { id: 'weight_management', label: '控制体重', labelKey: 'weight_management', category: '代谢', categoryKey: 'metabolism', popular: false },

  // ═══════════════════════════════════════════
  // 神经类（3条）
  // ═══════════════════════════════════════════
  { id: 'sleep_improvement', label: '改善睡眠', labelKey: 'sleep_improvement', category: '神经', categoryKey: 'neurological', popular: false },
  { id: 'calm_mind', label: '安神定志', labelKey: 'calm_mind', category: '神经', categoryKey: 'neurological', popular: false },
  { id: 'anxiety_relief', label: '缓解焦虑', labelKey: 'anxiety_relief', category: '神经', categoryKey: 'neurological', popular: false },

  // ═══════════════════════════════════════════
  // 消化类（3条）
  // ═══════════════════════════════════════════
  { id: 'spleen_stomach', label: '健脾养胃', labelKey: 'spleen_stomach', category: '消化', categoryKey: 'digestive', popular: false },
  { id: 'digestion_promotion', label: '促进消化', labelKey: 'digestion_promotion', category: '消化', categoryKey: 'digestive', popular: false },
  { id: 'digestive_regulation', label: '调理脾胃', labelKey: 'digestive_regulation', category: '消化', categoryKey: 'digestive', popular: false },

  // ═══════════════════════════════════════════
  // 呼吸系统（2条）
  // ═══════════════════════════════════════════
  { id: 'lung_nourishing', label: '润肺止咳', labelKey: 'lung_nourishing', category: '呼吸', categoryKey: 'respiratory', popular: false },
  { id: 'throat_clearing', label: '清咽利喉', labelKey: 'throat_clearing', category: '呼吸', categoryKey: 'respiratory', popular: false },

  // ═══════════════════════════════════════════
  // 视觉类（2条）
  // ═══════════════════════════════════════════
  { id: 'eye_protection', label: '明目护眼', labelKey: 'eye_protection', category: '视觉', categoryKey: 'vision', popular: false },
  { id: 'eye_fatigue_relief', label: '缓解眼疲劳', labelKey: 'eye_fatigue_relief', category: '视觉', categoryKey: 'vision', popular: false },

  // ═══════════════════════════════════════════
  // 美容类（2条）
  // ═══════════════════════════════════════════
  { id: 'beauty_skin', label: '美容养颜', labelKey: 'beauty_skin', category: '美容', categoryKey: 'beauty', popular: false },
  { id: 'skin_moisturizing', label: '护肤保湿', labelKey: 'skin_moisturizing', category: '美容', categoryKey: 'beauty', popular: false },

  // ═══════════════════════════════════════════
  // 骨骼类（2条）
  // ═══════════════════════════════════════════
  { id: 'bone_strength', label: '强健筋骨', labelKey: 'bone_strength', category: '骨骼', categoryKey: 'bone', popular: false },
  { id: 'calcium_supplement', label: '补钙健骨', labelKey: 'calcium_supplement', category: '骨骼', categoryKey: 'bone', popular: false },
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