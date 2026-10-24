export interface QuickQuestion {
  id: string
  /** i18n key（ai.chat.quick.questions.*），用于在切换语言时翻译问题正文 */
  questionKey: string
  question: string
  category: string
  /** i18n key（ai.chat.quick.categories.*），用于在切换语言时翻译分类标签 */
  categoryKey: string
  popular: boolean
}

export const QUICK_QUESTIONS: QuickQuestion[] = [
  // 药材知识
  {
    id: 'herb_list',
    questionKey: 'herb_list',
    question: '药食同源目录里有哪些常用的补气药材？',
    category: '药材知识',
    categoryKey: 'herbKnowledge',
    popular: true,
  },
  {
    id: 'qi_herb_comparison',
    questionKey: 'qi_herb_comparison',
    question: '黄芪、党参、白术三者的补气功效有何区别？',
    category: '药材知识',
    categoryKey: 'herbKnowledge',
    popular: false,
  },
  {
    id: 'herb_dosage',
    questionKey: 'herb_dosage',
    question: '枸杞子的安全食用剂量是多少？',
    category: '药材知识',
    categoryKey: 'herbKnowledge',
    popular: false,
  },
  // 配伍知识
  {
    id: 'herb_synergy',
    questionKey: 'herb_synergy',
    question: '黄芪和党参配伍有什么协同作用？',
    category: '配伍知识',
    categoryKey: 'compatibilityKnowledge',
    popular: true,
  },
  {
    id: 'formula_principle',
    questionKey: 'formula_principle',
    question: '中医配方中"君臣佐使"的原则是什么？',
    category: '配伍知识',
    categoryKey: 'compatibilityKnowledge',
    popular: false,
  },
  {
    id: 'herb_taboo',
    questionKey: 'herb_taboo',
    question: '人参和藜芦为什么不能同用？',
    category: '配伍禁忌',
    categoryKey: 'compatibilityTaboo',
    popular: true,
  },
  // 配方设计
  {
    id: 'antioxidant_design',
    questionKey: 'antioxidant_design',
    question: '设计一款抗氧化保健食品需要注意什么？',
    category: '配方设计',
    categoryKey: 'formulaDesign',
    popular: true,
  },
  {
    id: 'sleep_formula',
    questionKey: 'sleep_formula',
    question: '如何设计一款改善睡眠的药食同源配方？',
    category: '配方设计',
    categoryKey: 'formulaDesign',
    popular: false,
  },
  {
    id: 'blood_sugar_formula',
    questionKey: 'blood_sugar_formula',
    question: '针对高血糖人群的膳食配方该如何设计？',
    category: '配方设计',
    categoryKey: 'formulaDesign',
    popular: false,
  },
  // 成分知识
  {
    id: 'peptide_sources',
    questionKey: 'peptide_sources',
    question: '功能性食品中常用的活性肽有哪些来源？',
    category: '成分知识',
    categoryKey: 'ingredientKnowledge',
    popular: false,
  },
  {
    id: 'active_components',
    questionKey: 'active_components',
    question: '药食同源食材的主要活性成分有哪些？',
    category: '成分知识',
    categoryKey: 'ingredientKnowledge',
    popular: false,
  },
  // 安全合规
  {
    id: 'safety_check',
    questionKey: 'safety_check',
    question: '药食同源配方的安全合规检查包含哪些项目？',
    category: '安全合规',
    categoryKey: 'safetyCompliance',
    popular: true,
  },
  {
    id: 'pregnancy_safety',
    questionKey: 'pregnancy_safety',
    question: '孕妇服用药食同源配方有哪些禁忌？',
    category: '安全合规',
    categoryKey: 'safetyCompliance',
    popular: false,
  },
  // 体质辨识
  {
    id: 'constitution_id',
    questionKey: 'constitution_id',
    question: '如何判断自己是湿热质还是气虚质？',
    category: '体质辨识',
    categoryKey: 'constitution',
    popular: true,
  },
  {
    id: 'constitution_diet',
    questionKey: 'constitution_diet',
    question: '气虚体质的人应该吃什么药食同源食材？',
    category: '体质辨识',
    categoryKey: 'constitution',
    popular: false,
  },
]

export const getPopularQuestions = (): QuickQuestion[] => {
  return QUICK_QUESTIONS.filter(q => q.popular)
}

export const getQuestionsByCategory = (category: string): QuickQuestion[] => {
  return QUICK_QUESTIONS.filter(q => q.category === category)
}

/** 获取所有分类 */
export const QUESTION_CATEGORIES = [...new Set(QUICK_QUESTIONS.map(q => q.category))]