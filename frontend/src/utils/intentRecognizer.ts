/**
 * 知识库智能意图识别工具
 *
 * 支持识别用户查询意图并路由到相应知识库：
 * - 中药知识库 (TCM)
 * - 食源性多肽知识库 (Peptide)
 * - 中国食品法规库 (Regulation)
 *
 * 使用关键词匹配和实体提取技术实现意图识别
 */

export type KnowledgeBaseType = 'tcm' | 'peptide' | 'regulation' | 'general' | 'unknown';

export type IntentType =
  | 'tcm_query_herb'
  | 'tcm_query_compound'
  | 'tcm_query_target'
  | 'tcm_check_homology'
  | 'tcm_search_effects'
  | 'peptide_query_sequence'
  | 'peptide_search_activity'
  | 'peptide_search_source'
  | 'reg_query_standard'
  | 'reg_check_additive'
  | 'reg_check_homology'
  | 'reg_validate_formula'
  | 'general_help'
  | 'general_about'
  | 'unknown_intent';

export interface ParsedEntity {
  type: string;
  value: string;
}

export interface IntentRecognitionResult {
  query: string;
  knowledgeBase: KnowledgeBaseType;
  knowledgeBaseDescription: string;
  intent: IntentType;
  intentDescription: string;
  confidence: number;
  keywords: string[];
  entities: ParsedEntity[];
}

interface IntentRule {
  kbType: KnowledgeBaseType;
  intent: IntentType;
  keywords: string[];
  entities?: {
    type: string;
    patterns: RegExp[];
  }[];
  priority: number;
}

class IntentRecognizer {
  private readonly tcmHerbs: string[] = [
    '人参', '黄芪', '当归', '甘草', '丹参', '枸杞', '灵芝', '西洋参',
    '白术', '茯苓', '麦冬', '陈皮', '山楂', '红枣', '生姜', '蜂蜜',
    '山药', '百合', '桂圆', '黄精', '玉竹', '杏仁', '桃仁', '桑叶',
    '菊花', '金银花', '蒲公英', '鱼腥草', '薄荷', '紫苏', '藿香',
    '砂仁', '豆蔻', '肉桂', '花椒', '八角', '小茴香', '干姜',
  ];

  private readonly standardCodes: string[] = [
    'GB 2760', 'GB 2762', 'GB 14880', 'GB 7718', 'GB 28050',
    'GB 14881', 'GB 1886', 'GB 31604',
  ];

  private readonly rules: IntentRule[] = [
    // 通用意图（最高优先级）
    {
      kbType: 'general',
      intent: 'general_help',
      keywords: ['帮助', '使用说明', '功能', '如何使用', '教程'],
      priority: 100,
    },
    {
      kbType: 'general',
      intent: 'general_about',
      keywords: ['关于', '介绍', '系统', '版本', '概览'],
      priority: 95,
    },

    // 中药意图
    {
      kbType: 'tcm',
      intent: 'tcm_check_homology',
      keywords: ['药食同源', '药食两用', '能否食用', '食品原料'],
      entities: [{ type: 'herb', patterns: [/([\u4e00-\u9fa5]{2,4})/g] }],
      priority: 90,
    },
    {
      kbType: 'tcm',
      intent: 'tcm_query_compound',
      keywords: ['化合物', '成分', '有效成分', '活性成分', '化学成分'],
      entities: [{ type: 'herb', patterns: [/([\u4e00-\u9fa5]{2,4})/g] }],
      priority: 85,
    },
    {
      kbType: 'tcm',
      intent: 'tcm_query_target',
      keywords: ['靶点', '蛋白', '基因', '作用靶点', '受体'],
      entities: [{ type: 'compound', patterns: [/([\u4e00-\u9fa5]{2,})/g] }],
      priority: 80,
    },
    {
      kbType: 'tcm',
      intent: 'tcm_search_effects',
      keywords: ['功效', '作用', '主治', '适应症', '药理作用', '药效'],
      entities: [{ type: 'herb', patterns: [/([\u4e00-\u9fa5]{2,4})/g] }],
      priority: 75,
    },
    {
      kbType: 'tcm',
      intent: 'tcm_query_herb',
      keywords: ['药材', '中药', '草药', '本草', '植物', '方剂'],
      entities: [{ type: 'herb', patterns: [/([\u4e00-\u9fa5]{2,4})/g] }],
      priority: 70,
    },

    // 肽意图
    {
      kbType: 'peptide',
      intent: 'peptide_search_activity',
      keywords: ['ACE抑制', '抗氧化', '抗菌', '降糖', 'DPP-IV', '降血压', '免疫调节', '抗炎'],
      entities: [{ type: 'activity_type', patterns: [/([\u4e00-\u9fa5]{2,})/g] }],
      priority: 65,
    },
    {
      kbType: 'peptide',
      intent: 'peptide_search_source',
      keywords: ['胶原蛋白', '乳清蛋白', '大豆蛋白', '鱼胶原蛋白', '蛋清', '酪蛋白', '来源'],
      entities: [{ type: 'source', patterns: [/([\u4e00-\u9fa5]{2,})/g] }],
      priority: 60,
    },
    {
      kbType: 'peptide',
      intent: 'peptide_query_sequence',
      keywords: ['肽', '多肽', '活性肽', '氨基酸序列', 'Ile-Pro-Pro', 'Val-Pro-Pro'],
      entities: [{ type: 'peptide_sequence', patterns: [/([ACDEFGHIKLMNPQRSTVWY]{2,})/gi] }],
      priority: 55,
    },

    // 法规意图
    {
      kbType: 'regulation',
      intent: 'reg_validate_formula',
      keywords: ['合规', '审查', '审批', '验证', '配方验证', '成分审核'],
      entities: [{ type: 'ingredient', patterns: [/([\u4e00-\u9fa5]{2,})/g] }],
      priority: 50,
    },
    {
      kbType: 'regulation',
      intent: 'reg_check_additive',
      keywords: ['添加剂', '防腐剂', '甜味剂', '着色剂', '抗氧化剂', '使用标准'],
      entities: [{ type: 'additive', patterns: [/([\u4e00-\u9fa5]{2,})/g] }],
      priority: 45,
    },
    {
      kbType: 'regulation',
      intent: 'reg_check_homology',
      keywords: ['新食品原料', '新资源食品', '审批状态', '许可'],
      entities: [{ type: 'material', patterns: [/([\u4e00-\u9fa5]{2,})/g] }],
      priority: 40,
    },
    {
      kbType: 'regulation',
      intent: 'reg_query_standard',
      keywords: ['标准', '国标', 'GB', '食品安全', '国家标准'],
      entities: [{ type: 'standard_code', patterns: [/(GB\s*\d+)/g] }],
      priority: 35,
    },
  ];

  private readonly kbDescriptions: Record<KnowledgeBaseType, string> = {
    tcm: '中药知识库 (TCMSP)',
    peptide: '食源性多肽知识库 (DFBP)',
    regulation: '中国食品法规库',
    general: '通用查询',
    unknown: '未知知识库',
  };

  private readonly intentDescriptions: Record<IntentType, string> = {
    tcm_query_herb: '查询中药材信息',
    tcm_query_compound: '查询中药化合物',
    tcm_query_target: '查询作用靶点',
    tcm_check_homology: '检查药食同源状态',
    tcm_search_effects: '按功效搜索药材',
    peptide_query_sequence: '查询肽序列信息',
    peptide_search_activity: '按活性类型搜索肽',
    peptide_search_source: '按来源搜索肽',
    reg_query_standard: '查询食品安全标准',
    reg_check_additive: '检查食品添加剂使用规定',
    reg_check_homology: '检查药食同源审批状态',
    reg_validate_formula: '验证配方成分合规性',
    general_help: '获取帮助信息',
    general_about: '获取系统信息',
    unknown_intent: '未知意图',
  };

  public recognize(query: string): IntentRecognitionResult {
    const queryLower = query.toLowerCase().trim();

    const result: IntentRecognitionResult = {
      query,
      knowledgeBase: 'unknown',
      knowledgeBaseDescription: '',
      intent: 'unknown_intent',
      intentDescription: '',
      confidence: 0,
      keywords: [],
      entities: [],
    };

    if (!query || query.length === 0) {
      return result;
    }

    let bestMatch: IntentRule | null = null;
    let maxScore = 0;
    const matchedKeywords: string[] = [];

    for (const rule of this.rules) {
      let score = 0;
      let matched = false;

      for (const keyword of rule.keywords) {
        if (queryLower.includes(keyword.toLowerCase()) || query.includes(keyword)) {
          score += 1;
          matched = true;
          matchedKeywords.push(keyword);
        }
      }

      if (matched) {
        score = score / rule.keywords.length * rule.priority / 100;

        if (score > maxScore) {
          maxScore = score;
          bestMatch = rule;
        }
      }
    }

    if (!bestMatch) {
      bestMatch = this.recognizeByEntity(query);
      if (bestMatch) {
        maxScore = 0.6;
      }
    }

    if (bestMatch) {
      result.knowledgeBase = bestMatch.kbType;
      result.knowledgeBaseDescription = this.kbDescriptions[bestMatch.kbType];
      result.intent = bestMatch.intent;
      result.intentDescription = this.intentDescriptions[bestMatch.intent];
      result.confidence = Math.min(1, maxScore);
      result.keywords = matchedKeywords;
      result.entities = this.extractEntities(query, bestMatch);
    }

    return result;
  }

  private recognizeByEntity(query: string): IntentRule | null {
    for (const herb of this.tcmHerbs) {
      if (query.includes(herb)) {
        return {
          kbType: 'tcm',
          intent: 'tcm_query_herb',
          keywords: [herb],
          priority: 60,
        };
      }
    }

    const seqPattern = /([ACDEFGHIKLMNPQRSTVWY]{2,})/gi;
    const matches = query.match(seqPattern);
    if (matches && matches.some(m => m.length >= 2)) {
      return {
        kbType: 'peptide',
        intent: 'peptide_query_sequence',
        keywords: ['肽序列'],
        priority: 50,
      };
    }

    for (const code of this.standardCodes) {
      if (query.includes(code)) {
        return {
          kbType: 'regulation',
          intent: 'reg_query_standard',
          keywords: [code],
          priority: 40,
        };
      }
    }

    return null;
  }

  private extractEntities(query: string, rule: IntentRule): ParsedEntity[] {
    const entities: ParsedEntity[] = [];

    if (!rule.entities) {
      return entities;
    }

    for (const entityDef of rule.entities) {
      for (const pattern of entityDef.patterns) {
        const matches = query.match(pattern);
        if (matches) {
          for (const match of matches) {
            const trimmed = match.trim();
            if (trimmed && !entities.some(e => e.value === trimmed)) {
              entities.push({ type: entityDef.type, value: trimmed });
            }
          }
        }
      }
    }

    if (rule.kbType === 'tcm') {
      for (const herb of this.tcmHerbs) {
        if (query.includes(herb) && !entities.some(e => e.value === herb)) {
          entities.push({ type: 'herb', value: herb });
        }
      }
    }

    if (rule.kbType === 'peptide') {
      const seqPattern = /([ACDEFGHIKLMNPQRSTVWY]{2,})/gi;
      const seqMatches = query.match(seqPattern);
      if (seqMatches) {
        for (const seq of seqMatches) {
          if (!entities.some(e => e.value === seq)) {
            entities.push({ type: 'peptide_sequence', value: seq });
          }
        }
      }
    }

    if (rule.kbType === 'regulation') {
      for (const code of this.standardCodes) {
        if (query.includes(code) && !entities.some(e => e.value === code)) {
          entities.push({ type: 'standard_code', value: code });
        }
      }
    }

    return entities;
  }

  public getKnowledgeBaseDescription(kbType: KnowledgeBaseType): string {
    return this.kbDescriptions[kbType];
  }

  public getIntentDescription(intent: IntentType): string {
    return this.intentDescriptions[intent];
  }

  public getSuggestions(kbType: KnowledgeBaseType): string[] {
    const suggestions: Record<KnowledgeBaseType, string[]> = {
      tcm: [
        '查询中药材：人参的功效',
        '检查药食同源：黄芪是否药食同源',
        '搜索化合物：当归的有效成分',
      ],
      peptide: [
        '查询肽序列：Ile-Pro-Pro',
        '按活性搜索：抗氧化肽',
        '按来源搜索：胶原蛋白肽',
      ],
      regulation: [
        '查询标准：GB 2760',
        '检查添加剂：山梨酸使用规定',
        '验证配方：人参、黄芪',
      ],
      general: [
        '帮助：使用说明',
        '关于：系统介绍',
      ],
      unknown: [
        '查询中药材：人参的功效',
        '查询肽：Ile-Pro-Pro',
        '查询法规：GB 2760',
      ],
    };
    return suggestions[kbType] || suggestions.unknown;
  }
}

const intentRecognizer = new IntentRecognizer();

export default intentRecognizer;
export { IntentRecognizer };
