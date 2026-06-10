export interface ModelExpert {
  name: string
  background: string
  field: string
}

export type ModelExpertsConfig = Record<string, ModelExpert>;

export const MODEL_EXPERTS: ModelExpertsConfig = {
  formula_gpt: {
    name: '中药配方专家',
    background: '专注于中药配方设计与优化，拥有丰富的药食同源理论与实践经验，熟悉各类药材的性味归经、功效主治及配伍规律。',
    field: '中药配方学',
  },
  synergy_net: {
    name: '中药协同作用专家',
    background: '致力于研究中药成分间的协同与拮抗作用，擅长分析药材组合的相互影响机制，预测配方的整体功效。',
    field: '中药药理学',
  },
  safety_checker: {
    name: '中药安全合规专家',
    background: '专注于中药安全性评估与合规性检查，熟悉药食同源目录、配伍禁忌、过敏原及相关法规标准。',
    field: '中药安全性评价',
  },
  taste_predictor: {
    name: '中药口感专家',
    background: '专注于中药口感特征分析与预测，熟悉各类药材的风味属性及相互影响，擅长优化配方口感。',
    field: '中药感官评价',
  },
  stability_model: {
    name: '中药稳定性专家',
    background: '致力于研究中药配方的稳定性与保质期预测，熟悉不同储存条件对中药成分的影响机制。',
    field: '中药制剂稳定性',
  },
  llm: {
    name: 'AI 大语言模型专家',
    background: '基于先进的大语言模型，提供全面的中药知识咨询与配方设计建议，整合多领域专业知识。',
    field: '人工智能与中药研究',
  },
}

export const getExpertById = (id: string): ModelExpert | undefined => {
  return MODEL_EXPERTS[id]
}

export const getAllExperts = (): { id: string; expert: ModelExpert }[] => {
  return Object.entries(MODEL_EXPERTS).map(([id, expert]) => ({ id, expert }))
}
