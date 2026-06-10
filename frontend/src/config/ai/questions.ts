export interface QuickQuestion {
  id: string
  question: string
  category: string
  popular: boolean
}

export const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    id: 'herb_list',
    question: '药食同源目录里有哪些常用的补气药材？',
    category: '药材知识',
    popular: true,
  },
  {
    id: 'herb_synergy',
    question: '黄芪和党参配伍有什么协同作用？',
    category: '配伍知识',
    popular: true,
  },
  {
    id: 'peptide_sources',
    question: '功能性食品中常用的活性肽有哪些来源？',
    category: '成分知识',
    popular: false,
  },
  {
    id: 'antioxidant_design',
    question: '设计一款抗氧化保健食品需要注意什么？',
    category: '配方设计',
    popular: true,
  },
  {
    id: 'herb_taboo',
    question: '人参和藜芦为什么不能同用？',
    category: '配伍禁忌',
    popular: true,
  },
]

export const getPopularQuestions = (): QuickQuestion[] => {
  return QUICK_QUESTIONS.filter(q => q.popular)
}

export const getQuestionsByCategory = (category: string): QuickQuestion[] => {
  return QUICK_QUESTIONS.filter(q => q.category === category)
}
