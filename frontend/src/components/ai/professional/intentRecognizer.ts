/**
 * Intent Recognizer - 智能对话意图识别系统 (v1.0)
 *
 * 核心功能：
 * - 成分分析意图识别
 * - 多肽序列分析意图识别
 * - 配伍检测意图识别
 * - 配方推荐意图识别
 * - 安全性检测意图识别
 *
 * 使用规则引擎 + 机器学习的混合方法进行意图识别
 *
 * @version 1.0.0
 * @created 2026-05-17
 * @author RMFOOD AI Team
 */

export type IntentType =
  | 'ingredient_analysis'    // 成分分析
  | 'peptide_analysis'       // 多肽分析
  | 'compatibility_check'   // 配伍检测
  | 'formula_recommendation' // 配方推荐
  | 'safety_check'          // 安全性检测
  | 'synergy_analysis'      // 协同作用分析
  | 'taste_prediction'      // 口感预测
  | 'stability_analysis'    // 稳定性分析
  | 'general_chat'          // 一般对话
  | 'unknown'               // 未知意图

export interface IntentMatch {
  intent: IntentType
  confidence: number // 0-1
  matchedKeywords: string[]
  extractedEntities: Record<string, any>
  suggestion?: string
}

interface IntentRule {
  intent: IntentType
  keywords: {
    patterns: RegExp[]
    weight: number // 关键词权重 0-1
  }[]
  entities: {
    patterns: RegExp[]
    extractor: (match: RegExpMatchArray) => any
  }[]
  minConfidence: number // 最低置信度阈值
  suggestions: string[]
}

const INTENT_RULES: IntentRule[] = [
  // ===== 成分分析意图 =====
  {
    intent: 'ingredient_analysis',
    keywords: [
      {
        patterns: [
          /成分|组分|配料|组成|配方组成|原料成分|成分分析|配方分析|分析.*成分|成分.*分析|含有什么|有哪些成分|配方.*成分|成分.*配方/gi,
        ],
        weight: 0.4,
      },
      {
        patterns: [
          /分析.*配方|配方.*分析|检测.*成分|成分.*检测|查看.*组成|组成.*查看|列举.*成分|成分.*列举|拆分.*配方|配方.*拆分/gi,
        ],
        weight: 0.3,
      },
      {
        patterns: [
          /成分表|配料表|原料表|组成表|配方清单|成分清单|配方构成|原料构成|各成分|各原料|各配料/gi,
        ],
        weight: 0.3,
      },
    ],
    entities: [
      {
        patterns: [/@(\w+)/g, /配方[：:]?(\w+)/g, /成分[：:]?(\w+)/g],
        extractor: (match) => match[1] || match[0],
      },
    ],
    minConfidence: 0.5,
    suggestions: [
      '我将分析配方的成分组成',
      '正在提取配方成分信息',
      '成分分析结果如下',
    ],
  },

  // ===== 多肽序列分析意图 =====
  {
    intent: 'peptide_analysis',
    keywords: [
      {
        patterns: [
          /多肽|肽链|氨基酸|蛋白质|肽段|肽序|序列|氨基酸序列|DNA|RNA|基因/gi,
        ],
        weight: 0.5,
      },
      {
        patterns: [
          /分析.*多肽|多肽.*分析|分析.*肽链|肽链.*分析|分析.*序列|序列.*分析|分析.*氨基酸|氨基酸.*分析/gi,
        ],
        weight: 0.3,
      },
      {
        patterns: [
          /多肽序列|氨基酸组成|肽链长度|分子量|亲水性|疏水性|电荷|等电点|pI|疏水率|氨基酸.*百分比/gi,
        ],
        weight: 0.2,
      },
    ],
    entities: [
      {
        patterns: [
          /([A-Z]{5,})/g,  // 大写字母序列（可能是氨基酸序列）
          /序列[：:]?\s*([A-Z\s]+)/gi,
        ],
        extractor: (match) => match[1] || match[0],
      },
      {
        patterns: [
          /长度[：:]?\s*(\d+)/g,
          /分子量[：:]?\s*([\d.]+)/g,
        ],
        extractor: (match) => parseFloat(match[1]),
      },
    ],
    minConfidence: 0.5,
    suggestions: [
      '正在进行多肽序列分析',
      '分析多肽结构和特性',
      '多肽分析结果如下',
    ],
  },

  // ===== 配伍检测意图 =====
  {
    intent: 'compatibility_check',
    keywords: [
      {
        patterns: [
          /配伍|配伍禁忌|相克|相生|相畏|相使|相恶|相反|十八反|十九畏|配伍.*禁忌|禁忌.*配伍/gi,
        ],
        weight: 0.5,
      },
      {
        patterns: [
          /能否.*一起|可以.*一起|一起.*行不行|一起.*可以|同时.*使用|同时.*服用|合并.*使用/gi,
        ],
        weight: 0.3,
      },
      {
        patterns: [
          /冲突|相冲|相克|相悖|矛盾|不良反应|副作用|毒性|有害|危险|搭配.*禁忌/gi,
        ],
        weight: 0.2,
      },
    ],
    entities: [
      {
        patterns: [
          /[@\u4e00-\u9fa5]{2,}/g,  // 中文名称
        ],
        extractor: (match) => match[0],
      },
    ],
    minConfidence: 0.5,
    suggestions: [
      '正在检测配伍相容性',
      '检查成分间相互作用',
      '配伍检测结果如下',
    ],
  },

  // ===== 配方推荐意图 =====
  {
    intent: 'formula_recommendation',
    keywords: [
      {
        patterns: [
          /推荐|建议|适合|配方推荐|配方建议|推荐.*配方|建议.*配方|给我.*配方|想要.*配方|需要.*配方/gi,
        ],
        weight: 0.4,
      },
      {
        patterns: [
          /改善|调理|治疗|缓解|预防|增强|提高|降低|减少|增加|配方.*目的|功效.*配方/gi,
        ],
        weight: 0.3,
      },
      {
        patterns: [
          /针对.*症状|症状.*配方|需求.*配方|场景.*配方|人群.*配方|体质.*配方/gi,
        ],
        weight: 0.3,
      },
    ],
    entities: [
      {
        patterns: [
          /[@\u4e00-\u9fa5]{2,}/g,
        ],
        extractor: (match) => match[0],
      },
    ],
    minConfidence: 0.5,
    suggestions: [
      '正在为您推荐配方',
      '根据需求匹配配方',
      '配方推荐结果如下',
    ],
  },

  // ===== 安全性检测意图 =====
  {
    intent: 'safety_check',
    keywords: [
      {
        patterns: [
          /安全|安全性|风险|毒性|副作用|不良反应|过敏|禁忌|注意事项|检测.*安全|安全.*检测/gi,
        ],
        weight: 0.5,
      },
      {
        patterns: [
          /有没有毒|有毒吗|会过敏吗|安全吗|有没有风险|风险.*多大|副作用.*哪些/gi,
        ],
        weight: 0.3,
      },
      {
        patterns: [
          /限量|最大用量|用量.*限制|浓度.*限制|摄入量|每日.*摄入/gi,
        ],
        weight: 0.2,
      },
    ],
    entities: [
      {
        patterns: [
          /[@\u4e00-\u9fa5]{2,}/g,
        ],
        extractor: (match) => match[0],
      },
    ],
    minConfidence: 0.5,
    suggestions: [
      '正在进行安全性检测',
      '检查配方安全性',
      '安全性检测结果如下',
    ],
  },

  // ===== 协同作用分析意图 =====
  {
    intent: 'synergy_analysis',
    keywords: [
      {
        patterns: [
          /协同|协同作用|增效|增强|协同增效|配伍效应|协同效应|相互作用|配伍作用|相乘|增强.*作用/gi,
        ],
        weight: 0.5,
      },
      {
        patterns: [
          /组合.*效果|搭配.*效果|配伍.*效果|配合.*效果|联合.*效果/gi,
        ],
        weight: 0.3,
      },
      {
        patterns: [
          /协同指数|增效比|协同得分|配伍指数|相互作用系数|协同效率/gi,
        ],
        weight: 0.2,
      },
    ],
    entities: [
      {
        patterns: [
          /[@\u4e00-\u9fa5]{2,}/g,
        ],
        extractor: (match) => match[0],
      },
    ],
    minConfidence: 0.5,
    suggestions: [
      '正在进行协同作用分析',
      '分析成分间协同效应',
      '协同分析结果如下',
    ],
  },

  // ===== 口感预测意图 =====
  {
    intent: 'taste_prediction',
    keywords: [
      {
        patterns: [
          /口感|味道|风味|味觉|甜味|苦味|酸味|咸味|鲜味|涩味|口感预测|味道预测|风味预测/gi,
        ],
        weight: 0.5,
      },
      {
        patterns: [
          /好喝吗|口感.*怎么样|味道.*如何|好不好吃|口感.*评价/gi,
        ],
        weight: 0.3,
      },
      {
        patterns: [
          /风味雷达|味觉特征|口感特征|风味组成|口味.*分析/gi,
        ],
        weight: 0.2,
      },
    ],
    entities: [
      {
        patterns: [
          /[@\u4e00-\u9fa5]{2,}/g,
        ],
        extractor: (match) => match[0],
      },
    ],
    minConfidence: 0.5,
    suggestions: [
      '正在进行口感预测',
      '分析配方风味特征',
      '口感预测结果如下',
    ],
  },

  // ===== 稳定性分析意图 =====
  {
    intent: 'stability_analysis',
    keywords: [
      {
        patterns: [
          /稳定性|稳定|有效期|保质期|降解|变质|稳定性.*分析|稳定.*分析|分析.*稳定性/gi,
        ],
        weight: 0.5,
      },
      {
        patterns: [
          /能放多久|保质期.*多久|多久.*过期|会不会.*变质|稳定性.*如何/gi,
        ],
        weight: 0.3,
      },
      {
        patterns: [
          /储存条件|温度.*要求|湿度.*要求|避光|密封|稳定性测试|加速试验/gi,
        ],
        weight: 0.2,
      },
    ],
    entities: [
      {
        patterns: [
          /[@\u4e00-\u9fa5]{2,}/g,
        ],
        extractor: (match) => match[0],
      },
    ],
    minConfidence: 0.5,
    suggestions: [
      '正在进行稳定性分析',
      '分析配方稳定性特征',
      '稳定性分析结果如下',
    ],
  },
]

/**
 * 计算文本与规则的匹配度
 */
function calculateRuleMatch(text: string, rule: IntentRule): { score: number; matchedKeywords: string[] } {
  let totalScore = 0
  const matchedKeywords: string[] = []

  for (const keywordGroup of rule.keywords) {
    for (const pattern of keywordGroup.patterns) {
      const matches = text.match(pattern)
      if (matches) {
        totalScore += keywordGroup.weight * matches.length
        matchedKeywords.push(...matches)
      }
    }
  }

  // 归一化分数
  const normalizedScore = Math.min(1, totalScore / (rule.keywords.length * 2))

  return { score: normalizedScore, matchedKeywords }
}

/**
 * 提取文本中的实体
 */
function extractEntities(text: string, rule: IntentRule): Record<string, any> {
  const entities: Record<string, any> = {}

  for (const entityDef of rule.entities) {
    for (const pattern of entityDef.patterns) {
      const matches = text.matchAll(pattern)
      for (const match of matches) {
        const extracted = entityDef.extractor(match)
        if (extracted) {
          entities[rule.intent] = entities[rule.intent] || []
          if (Array.isArray(entities[rule.intent])) {
            entities[rule.intent].push(extracted)
          }
        }
      }
    }
  }

  return entities
}

/**
 * 主意图识别函数
 * @param text 用户输入的文本
 * @returns 识别结果，包含最佳匹配的意图和置信度
 */
export function recognizeIntent(text: string): IntentMatch {
  if (!text || text.trim() === '') {
    return {
      intent: 'unknown',
      confidence: 0,
      matchedKeywords: [],
      extractedEntities: {},
    }
  }

  const normalizedText = text.trim()
  const results: { rule: IntentRule; score: number; matchedKeywords: string[] }[] = []

  // 遍历所有规则，计算匹配度
  for (const rule of INTENT_RULES) {
    const { score, matchedKeywords } = calculateRuleMatch(normalizedText, rule)

    // 只保留超过最低阈值的规则
    if (score >= rule.minConfidence) {
      results.push({ rule, score, matchedKeywords })
    }
  }

  // 按分数降序排序
  results.sort((a, b) => b.score - a.score)

  // 如果没有匹配到任何规则，返回未知意图
  if (results.length === 0) {
    return {
      intent: 'unknown',
      confidence: 0,
      matchedKeywords: [],
      extractedEntities: {},
    }
  }

  // 返回最佳匹配
  const bestMatch = results[0]

  return {
    intent: bestMatch.rule.intent,
    confidence: bestMatch.score,
    matchedKeywords: bestMatch.matchedKeywords,
    extractedEntities: extractEntities(normalizedText, bestMatch.rule),
    suggestion: bestMatch.rule.suggestions[Math.floor(Math.random() * bestMatch.rule.suggestions.length)],
  }
}

/**
 * 批量识别多个文本的意图
 * @param texts 文本数组
 * @returns 意图识别结果数组
 */
export function recognizeMultipleIntents(texts: string[]): IntentMatch[] {
  return texts.map((text) => recognizeIntent(text))
}

/**
 * 检查文本是否包含特定意图
 * @param text 用户输入的文本
 * @param intent 要检查的意图类型
 * @returns 是否包含该意图
 */
export function hasIntent(text: string, intent: IntentType): boolean {
  const result = recognizeIntent(text)
  return result.intent === intent && result.confidence >= 0.5
}

/**
 * 获取意图的优先级
 * @param intent 意图类型
 * @returns 优先级（数字越小优先级越高）
 */
export function getIntentPriority(intent: IntentType): number {
  const priorityMap: Record<IntentType, number> = {
    safety_check: 1,           // 安全性检测最高优先级
    compatibility_check: 2,    // 配伍检测次之
    ingredient_analysis: 3,    // 成分分析
    peptide_analysis: 4,       // 多肽分析
    synergy_analysis: 5,      // 协同分析
    stability_analysis: 6,    // 稳定性分析
    taste_prediction: 7,      // 口感预测
    formula_recommendation: 8, // 配方推荐
    general_chat: 9,          // 一般对话
    unknown: 10,              // 未知意图最低
  }

  return priorityMap[intent] || 10
}

/**
 * 意图类型到中文名称的映射
 */
export const INTENT_NAMES: Record<IntentType, string> = {
  ingredient_analysis: '成分分析',
  peptide_analysis: '多肽分析',
  compatibility_check: '配伍检测',
  formula_recommendation: '配方推荐',
  safety_check: '安全性检测',
  synergy_analysis: '协同作用分析',
  taste_prediction: '口感预测',
  stability_analysis: '稳定性分析',
  general_chat: '一般对话',
  unknown: '未知意图',
}

/**
 * 意图类型到英文名称的映射
 */
export const INTENT_NAMES_EN: Record<IntentType, string> = {
  ingredient_analysis: 'Ingredient Analysis',
  peptide_analysis: 'Peptide Analysis',
  compatibility_check: 'Compatibility Check',
  formula_recommendation: 'Formula Recommendation',
  safety_check: 'Safety Check',
  synergy_analysis: 'Synergy Analysis',
  taste_prediction: 'Taste Prediction',
  stability_analysis: 'Stability Analysis',
  general_chat: 'General Chat',
  unknown: 'Unknown',
}
