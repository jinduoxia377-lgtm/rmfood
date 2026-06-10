/**
 * NLP处理器 - 自然语言处理核心模块
 *
 * 核心功能：
 * - 文本规范化（繁简转换、全角半角转换、标点规范化等）
 * - 实体抽取（功能宣称、目标人群、法规标准等）
 * - 意图识别（基于规则和实体的混合意图分类）
 *
 * 重构说明：v2.0版本将所有硬编码数据外部化到JSON配置文件，
 * 通过NLPConfigService统一加载和管理，实现数据与逻辑的完全解耦。
 */

import { logger } from '@/utils/safeLogger'
import { getNLPConfigService } from '../../../../config/nlp/nlpConfigService'
import { getTermsByCategory, type Term } from './domainKnowledge'

export interface CleanOptions {
  trimSpaces?: boolean;
  removeSpecialChars?: boolean;
  normalizePunctuation?: boolean;
  convertFullWidth?: boolean;
  convertTraditional?: boolean;
  toLowerCase?: boolean;
}

const DEFAULT_OPTIONS: Required<CleanOptions> = {
  trimSpaces: true,
  removeSpecialChars: true,
  normalizePunctuation: true,
  convertFullWidth: true,
  convertTraditional: true,
  toLowerCase: true,
};

interface TextNormalizationConfig {
  traditionalToSimplified: Record<string, string>;
  fullWidthToHalfWidth: [string, string][];
  punctuationNormalization: Record<string, string>;
}

class TextCleaner {
  private options: Required<CleanOptions>;
  private config: TextNormalizationConfig | null = null;
  private configLoaded = false;

  constructor(options?: CleanOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.loadConfig();
  }

  get isConfigLoaded(): boolean {
    return this.configLoaded
  }

  private async loadConfig(): Promise<void> {
    try {
      this.config = await getNLPConfigService().getConfig<TextNormalizationConfig>('textNormalization');
      this.configLoaded = true;
      logger.log('[TextCleaner] ✅ 配置加载成功');
    } catch (error) {
      logger.warn('[TextCleaner] ⚠️ 配置加载失败，使用内置默认值:', error);
    }
  }

  normalize(rawText: string): string {
    if (!rawText || typeof rawText !== 'string') return '';

    let text = rawText;

    if (this.options.convertFullWidth) {
      text = this.convertFullWidthToHalf(text);
    }

    if (this.options.convertTraditional) {
      text = this.convertTraditionalToSimplified(text);
    }

    if (this.options.trimSpaces) {
      text = this.normalizeSpaces(text);
    }

    if (this.options.normalizePunctuation) {
      text = this.normalizeChinesePunctuation(text);
    }

    if (this.options.removeSpecialChars) {
      text = this.removeSpecialCharacters(text);
    }

    if (this.options.toLowerCase) {
      text = text.toLowerCase();
    }

    return text;
  }

  private normalizeSpaces(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private removeSpecialCharacters(text: string): string {
    const allowedPattern = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaffa-zA-Z0-9\s，。！？：；""''（）【】《》、\-·]/g;
    const matches = text.match(allowedPattern);
    return matches ? matches.join('') : '';
  }

  private normalizeChinesePunctuation(text: string): string {
    let result = text;

    if (this.config?.punctuationNormalization) {
      result = result.replace(/！{2,}/g, this.config.punctuationNormalization.multipleExclamation || '！');
      result = result.replace(/？{2,}/g, this.config.punctuationNormalization.multipleQuestion || '？');
      result = result.replace(/。{2,}/g, this.config.punctuationNormalization.multiplePeriod || '。');
      result = result.replace(/，{2,}/g, this.config.punctuationNormalization.multipleComma || '，');
    } else {
      // 降级处理：使用默认值
      result = result.replace(/！{2,}/g, '！');
      result = result.replace(/？{2,}/g, '？');
      result = result.replace(/。{2,}/g, '。');
      result = result.replace(/，{2,}/g, '，');
    }

    return result;
  }

  private convertFullWidthToHalf(text: string): string {
    let result = text;

    if (this.config?.fullWidthToHalfWidth) {
      for (const [full, half] of this.config.fullWidthToHalfWidth) {
        result = result.split(full).join(half);
      }
    }

    // 处理Unicode范围内的全角字符
    result = result.replace(/[\uff01-\uff5e]/g, (char) => {
      const code = char.charCodeAt(0);
      return String.fromCharCode(code - 0xfee0);
    });

    return result;
  }

  private convertTraditionalToSimplified(text: string): string {
    let result = '';

    if (this.config?.traditionalToSimplified) {
      for (const char of text) {
        result += this.config.traditionalToSimplified[char] || char;
      }
    } else {
      // 如果没有配置，返回原文（降级处理）
      result = text;
    }

    return result;
  }
}

export { TextCleaner };

export type EntityType =
  | 'ACTIVE_INGREDIENT'
  | 'PRODUCT_FORM'
  | 'FUNCTIONAL_CLAIM'
  | 'TARGET_AUDIENCE'
  | 'PROCESS_TECH'
  | 'REGULATORY_STD';

export interface ExtractedEntity {
  type: EntityType;
  text: string;
  normalized: string;
  confidence: number;
  startIdx?: number;
  endIdx?: number;
}

interface FunctionalPattern {
  pattern: RegExp;
  normalized: string;
  baseConfidence: number;
}

interface TargetAudienceTerm {
  keyword: string;
  normalized: string;
  confidence: number;
}

interface PatternConfigItem {
  pattern: string;
  normalized: string;
  baseConfidence: number;
  category?: string;
}

interface FunctionalPatternsConfig {
  patterns: PatternConfigItem[];
}

interface TargetAudienceTermsConfig {
  terms: {
    keyword: string;
    normalized: string;
    confidence: number;
    category?: string;
  }[];
}

export class EntityExtractor {
  private funcFactorTerms: Term[];
  private processTechTerms: Term[];
  private productFormTerms: Term[];
  private regulatoryTerms: Term[];

  private functionalPatterns: FunctionalPattern[] = [];
  private targetAudienceTerms: TargetAudienceTerm[] = [];
  private regulatoryPatterns: FunctionalPattern[] = [];

  private configInitialized = false;

  constructor() {
    this.funcFactorTerms = getTermsByCategory('FUNCTIONAL_FACTOR');
    this.processTechTerms = getTermsByCategory('PROCESS_TECHNOLOGY');
    this.productFormTerms = getTermsByCategory('PRODUCT_FORM');
    this.regulatoryTerms = getTermsByCategory('REGULATORY_STANDARD');

    this.funcFactorTerms.sort((a, b) => b.key.length - a.key.length);
    this.processTechTerms.sort((a, b) => b.key.length - a.key.length);
    this.productFormTerms.sort((a, b) => b.key.length - a.key.length);
    this.regulatoryTerms.sort((a, b) => b.key.length - a.key.length);

    this.initializeConfigs();
  }

  private async initializeConfigs(): Promise<void> {
    try {
      logger.log('[EntityExtractor] 📥 开始加载配置...');

      // 并行加载所有配置
      const [functionalPatterns, targetAudienceTerms, regulatoryPatterns] = await Promise.all([
        getNLPConfigService().getConfig<FunctionalPatternsConfig>('functionalPatterns'),
        getNLPConfigService().getConfig<TargetAudienceTermsConfig>('targetAudienceTerms'),
        getNLPConfigService().getConfig<FunctionalPatternsConfig>('regulatoryPatterns'),
      ]);

      // 编译正则表达式模式
      this.functionalPatterns = functionalPatterns.patterns.map(p => ({
        pattern: new RegExp(p.pattern, 'g'),
        normalized: p.normalized,
        baseConfidence: p.baseConfidence,
      }));

      this.targetAudienceTerms = targetAudienceTerms.terms.map((t: { keyword: string; normalized: string; confidence: number }) => ({
        keyword: t.keyword,
        normalized: t.normalized,
        confidence: t.confidence,
      }));

      this.regulatoryPatterns = regulatoryPatterns.patterns.map((p: { pattern: string; normalized: string; baseConfidence: number }) => ({
        pattern: new RegExp(p.pattern, 'g'),
        normalized: p.normalized,
        baseConfidence: p.baseConfidence,
      }));

      this.configInitialized = true;
      logger.log('[EntityExtractor] ✅ 配置加载完成', {
        功能宣称模式数: this.functionalPatterns.length,
        目标人群术语数: this.targetAudienceTerms.length,
        法规模式数: this.regulatoryPatterns.length,
      });

    } catch (error) {
      logger.error('[EntityExtractor] ❌ 配置加载失败:', error);
      // 可以在这里添加降级逻辑或重试机制
    }
  }

  async extract(cleanText: string): Promise<ExtractedEntity[]> {
    // 确保配置已加载
    if (!this.configInitialized) {
      await this.initializeConfigs();
    }

    if (!cleanText || typeof cleanText !== 'string' || !cleanText.trim()) {
      return [];
    }

    const text = cleanText.trim();
    const entities: ExtractedEntity[] = [];
    const occupiedPositions = new Set<number>();

    const addEntity = (entity: ExtractedEntity): boolean => {
      if (entity.startIdx === undefined || entity.endIdx === undefined) return true;

      let canAdd = true;
      for (let i = entity.startIdx; i < entity.endIdx; i++) {
        if (occupiedPositions.has(i)) {
          canAdd = false;
          break;
        }
      }
      if (canAdd) {
        for (let i = entity.startIdx; i < entity.endIdx; i++) {
          occupiedPositions.add(i);
        }
        entities.push(entity);
      }
      return canAdd;
    };

    this.matchDictionaryEntities(text, 'ACTIVE_INGREDIENT', this.funcFactorTerms, entities, addEntity);
    this.matchDictionaryEntities(text, 'PROCESS_TECH', this.processTechTerms, entities, addEntity);
    this.matchDictionaryEntities(text, 'PRODUCT_FORM', this.productFormTerms, entities, addEntity);

    this.matchRegexPatterns(text, this.functionalPatterns, 'FUNCTIONAL_CLAIM', entities, addEntity);
    this.matchRegexPatterns(text, this.regulatoryPatterns, 'REGULATORY_STD', entities, addEntity);

    this.matchTargetAudience(text, entities, addEntity);

    entities.sort((a, b) => b.confidence - a.confidence);
    return entities;
  }

  private matchDictionaryEntities(
    text: string,
    entityType: EntityType,
    terms: Term[],
    _entities: ExtractedEntity[],
    addEntity: (entity: ExtractedEntity) => boolean,
  ): void {
    for (const term of terms) {
      const idx = text.indexOf(term.key);
      if (idx !== -1) {
        const entity: ExtractedEntity = {
          type: entityType,
          text: term.key,
          normalized: term.normalized,
          confidence: term.confidence,
          startIdx: idx,
          endIdx: idx + term.key.length,
        };
        addEntity(entity);
      }
    }
  }

  private matchRegexPatterns(
    text: string,
    patterns: FunctionalPattern[],
    entityType: EntityType,
    _entities: ExtractedEntity[],
    addEntity: (entity: ExtractedEntity) => boolean,
  ): void {
    for (const { pattern, normalized, baseConfidence } of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const matchedText = match[0];
        const entity: ExtractedEntity = {
          type: entityType,
          text: matchedText,
          normalized,
          confidence: baseConfidence,
          startIdx: match.index,
          endIdx: match.index + matchedText.length,
        };
        addEntity(entity);
      }
    }
  }

  private matchTargetAudience(
    text: string,
    _entities: ExtractedEntity[],
    addEntity: (entity: ExtractedEntity) => boolean,
  ): void {
    const sortedTerms = [...this.targetAudienceTerms].sort((a, b) => b.keyword.length - a.keyword.length);
    for (const term of sortedTerms) {
      const idx = text.indexOf(term.keyword);
      if (idx !== -1) {
        const entity: ExtractedEntity = {
          type: 'TARGET_AUDIENCE',
          text: term.keyword,
          normalized: term.normalized,
          confidence: term.confidence,
          startIdx: idx,
          endIdx: idx + term.keyword.length,
        };
        addEntity(entity);
      }
    }
  }
}

export type IntentType =
  | 'FORMULA_DESIGN'
  | 'SAFETY_ASSESSMENT'
  | 'PERFORMANCE_OPT'
  | 'COST_REDUCTION'
  | 'REGULATORY_COMPLIANCE'
  | 'INGREDIENT_ANALYSIS'
  | 'PROCESS_TECHNOLOGY'
  | 'MARKET_POSITIONING'
  | 'QUALITY_ASSURANCE';

export interface IntentClassificationResult {
  primary: {
    type: IntentType;
    confidence: number;
  };
  secondary: {
    type: IntentType;
    confidence: number;
  }[];
  allScores: Record<IntentType, number>;
  isAmbiguous: boolean;
  clarificationQuestions?: string[];
}

interface IntentRule {
  intentType: IntentType;
  patterns: (string | RegExp)[];
  weights: number[];
  entityBoosts?: EntityType[];
  negativePatterns?: (string | RegExp)[];
}

const FORMULA_DESIGN_RULES: IntentRule = {
  intentType: 'FORMULA_DESIGN',
  patterns: [
    /设计(一款?|一个?|一种)?/gi,
    /开发(一款?|一个?|一种)?/gi,
    /研制/gi,
    /调配/gi,
    /做(个?|一个?|一款?)?(配方|产品|饮品|食品|饮料|保健品)/gi,
    /创建/gi,
    /构建/gi,
    /配制/gi,
    /研发/gi,
    /定制/gi,
    /帮我(做|设计|开发|调配)(一个?|一款?)?(配方|产品|饮品|食品|饮料)/gi,
    /想(做|开发|设计)(一个?|一款?)?(配方|产品|饮品|食品|饮料)/gi,
    /如何(做|制作|开发|设计)(一个?|一款?)?(配方|产品|饮品|食品|饮料)/gi,
  ],
  weights: [1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.75, 0.7, 0.68],
  entityBoosts: ['ACTIVE_INGREDIENT', 'PRODUCT_FORM', 'FUNCTIONAL_CLAIM'],
  negativePatterns: [/不要(设计|开发|做)/gi, /取消/gi, /不想要/gi],
};

const SAFETY_ASSESSMENT_RULES: IntentRule = {
  intentType: 'SAFETY_ASSESSMENT',
  patterns: [
    /安全(性)?(评估|评价|分析|检测|测试)?/gi,
    /风险(评估|分析|管控)?/gi,
    /毒(性|理)(学)?(评估|评价|分析|研究)?/gi,
    /合规(性)?(审查|评估|检查|审核)?/gi,
    /(有)?副作用/gi,
    /禁忌(症|人群)?/gi,
    /\bADI\b/gi,
    /\bLD50\b/gi,
    /过敏原(分析|检测|排查)?/gi,
    /重金属(超标|检测|限量|含量)?/gi,
    /有害物质(检测|分析|残留)?/gi,
    /食用安全/gi,
  ],
  weights: [1.0, 0.95, 0.92, 0.9, 0.8, 0.78, 0.7, 0.68, 0.75, 0.72, 0.7, 0.85],
  entityBoosts: ['ACTIVE_INGREDIENT', 'REGULATORY_STD'],
  negativePatterns: [/没有(安全|风险)问题/gi, /安全性很高/gi],
};

const PERFORMANCE_OPT_RULES: IntentRule = {
  intentType: 'PERFORMANCE_OPT',
  patterns: [
    /口感(优化|改善|提升|调节|调整)?/gi,
    /稳定性(测试|评估|改善|提升)?/gi,
    /保质期(延长|改善|提升)?/gi,
    /溶解性(改善|提升|增强)?/gi,
    /吸收率(提高|提升|增强)?/gi,
    /生物利用度(提高|提升|增强)?/gi,
    /感官(评价|评测|品质|体验)?/gi,
    /质构(改善|优化|调节)?/gi,
    /风味(改善|优化|提升|调节)?/gi,
    /色泽(保持|稳定|改善)?/gi,
    /浑浊度(降低|控制|改善)?/gi,
    /沉淀(防止|控制|减少)?/gi,
  ],
  weights: [1.0, 0.95, 0.92, 0.88, 0.9, 0.88, 0.78, 0.76, 0.82, 0.7, 0.65, 0.63],
  entityBoosts: ['ACTIVE_INGREDIENT', 'PRODUCT_FORM', 'FUNCTIONAL_CLAIM'],
};

const COST_REDUCTION_RULES: IntentRule = {
  intentType: 'COST_REDUCTION',
  patterns: [
    /降低成本/gi,
    /替代原料/gi,
    /性价比(高|优化|提升)?/gi,
    /预算(有限|控制|节约)?/gi,
    /便宜/gi,
    /节约(成本)?/gi,
    /优化成本/gi,
    /降本增效/gi,
    /成本(控制|压缩|削减|核算)?/gi,
    /经济(实惠|型|方案)?/gi,
    /低价/gi,
    /划算/gi,
  ],
  weights: [1.0, 0.95, 0.88, 0.82, 0.7, 0.78, 0.85, 0.9, 0.8, 0.72, 0.65, 0.6],
  entityBoosts: ['ACTIVE_INGREDIENT'],
  negativePatterns: [/不计成本/gi, /不考虑价格/gi, /成本不是问题/gi],
};

const REGULATORY_COMPLIANCE_RULES: IntentRule = {
  intentType: 'REGULATORY_COMPLIANCE',
  patterns: [
    /\bGB(\/T)?\s*\d+/gi,
    /\bFDA\b/gi,
    /\bNMPA\b/gi,
    /标签(合规|审核|标识|标注|要求)?/gi,
    /注册(申报|备案|申请)?/gi,
    /认证(申请|获取|通过)?/gi,
    /申报(材料|流程|审批)?/gi,
    /法规(符合|遵循|遵守|标准)?/gi,
    /标准(符合|满足|达到|执行)?/gi,
    /合规(审查|检查|审计)?/gi,
    /备案/gi,
    /许可(证|申请|审批)?/gi,
  ],
  weights: [0.98, 0.96, 0.96, 0.88, 0.9, 0.88, 0.82, 0.85, 0.83, 0.86, 0.75, 0.8],
  entityBoosts: ['REGULATORY_STD'],
  negativePatterns: [/不需要(注册|认证|备案)/gi, /豁免(标准|法规)/gi],
};

const INGREDIENT_ANALYSIS_RULES: IntentRule = {
  intentType: 'INGREDIENT_ANALYSIS',
  patterns: [
    /多肽(分析|研究|提取|应用)?/gi,
    /甜味剂(替代|选择|分析|使用)?/gi,
    /乳化剂(选择|分析|使用|复配)?/gi,
    /功能因子(分析|筛选|研究)?/gi,
    /成分(分析|含量|组成|配比)?/gi,
    /原料(筛选|选择|分析|对比)?/gi,
    /添加剂(使用|种类|限量|合规)?/gi,
    /营养素(添加|补充|强化|分析)?/gi,
    /配料(表|成分|组成|分析)?/gi,
    /活性成分(分析|提取|纯化)?/gi,
    /载体(材料|选择|分析)?/gi,
    /辅料(选择|使用|分析)?/gi,
  ],
  weights: [1.0, 0.92, 0.88, 0.85, 0.9, 0.88, 0.82, 0.84, 0.78, 0.86, 0.72, 0.74],
  entityBoosts: ['ACTIVE_INGREDIENT', 'FUNCTIONAL_CLAIM'],
  negativePatterns: [],
};

const PROCESS_TECHNOLOGY_RULES: IntentRule = {
  intentType: 'PROCESS_TECHNOLOGY',
  patterns: [
    /提取(工艺|技术|方法|过程)?/gi,
    /发酵(工艺|技术|条件|参数)?/gi,
    /干燥(方式|技术|工艺|条件)?/gi,
    /包埋(技术|工艺|方法)?/gi,
    /工艺(流程|参数|优化|设计)?/gi,
    /生产(工艺|技术|流程|设备)?/gi,
    /制备(方法|工艺|技术|流程)?/gi,
    /加工(工艺|技术|方法|条件)?/gi,
    /杀菌(方式|工艺|技术|条件)?/gi,
    /均质(工艺|技术|条件|参数)?/gi,
    /浓缩(工艺|技术|方法)?/gi,
    /纯化(工艺|技术|方法|流程)?/gi,
  ],
  weights: [1.0, 0.95, 0.9, 0.88, 0.92, 0.88, 0.9, 0.86, 0.82, 0.8, 0.76, 0.78],
  entityBoosts: ['PROCESS_TECH', 'ACTIVE_INGREDIENT'],
};

const MARKET_POSITIONING_RULES: IntentRule = {
  intentType: 'MARKET_POSITIONING',
  patterns: [
    /清洁标签/gi,
    /植物基/gi,
    /功能性(食品|饮料|产品|定位)?/gi,
    /市场(趋势|分析|定位|需求)?/gi,
    /竞品(分析|对标|对比)?/gi,
    /定位(策略|分析|目标)?/gi,
    /消费(者|人群|趋势|偏好|需求)?/gi,
    /差异化/gi,
    /品牌(定位|策略|形象)?/gi,
    /目标市场/gi,
    /细分市场/gi,
    /消费升级/gi,
  ],
  weights: [0.98, 0.96, 0.88, 0.85, 0.87, 0.86, 0.84, 0.8, 0.78, 0.82, 0.75, 0.73],
  entityBoosts: ['TARGET_AUDIENCE', 'PRODUCT_FORM'],
};

const ALL_INTENT_RULES: IntentRule[] = [
  FORMULA_DESIGN_RULES,
  SAFETY_ASSESSMENT_RULES,
  PERFORMANCE_OPT_RULES,
  COST_REDUCTION_RULES,
  REGULATORY_COMPLIANCE_RULES,
  INGREDIENT_ANALYSIS_RULES,
  PROCESS_TECHNOLOGY_RULES,
  MARKET_POSITIONING_RULES,
];

const DEFAULT_INTENT_SCORES: Record<IntentType, number> = {
  FORMULA_DESIGN: 0,
  SAFETY_ASSESSMENT: 0,
  PERFORMANCE_OPT: 0,
  COST_REDUCTION: 0,
  REGULATORY_COMPLIANCE: 0,
  INGREDIENT_ANALYSIS: 0,
  PROCESS_TECHNOLOGY: 0,
  MARKET_POSITIONING: 0,
  QUALITY_ASSURANCE: 0,
};

const AMBIGUITY_INDICATORS: RegExp[] = [
  /好喝/gi,
  /美味/gi,
  /口感好/gi,
  /健康/gi,
  /养生/gi,
  /保健/gi,
  /帮我/gi,
  /做个/gi,
  /东西/gi,
  /这个/gi,
  /那个/gi,
];

export class IntentClassifier {
  classify(cleanText: string, entities?: ExtractedEntity[]): IntentClassificationResult {
    if (!cleanText || typeof cleanText !== 'string' || !cleanText.trim()) {
      return this.buildDefaultResult();
    }

    const text = cleanText.trim();
    const scores = new Map<IntentType, number>();

    for (const rule of ALL_INTENT_RULES) {
      let score = 0;
      for (let i = 0; i < rule.patterns.length; i++) {
        const pattern = rule.patterns[i]
        if (!pattern) continue
        if (this.matchPattern(pattern, text)) {
          score = Math.max(score, (rule.weights[i] ?? 0) * 100);
        }
      }
      scores.set(rule.intentType, score);
    }

    if (entities && entities.length > 0) {
      for (const rule of ALL_INTENT_RULES) {
        if (rule.entityBoosts && rule.entityBoosts.length > 0) {
          const matchingEntities = entities.filter(e =>
            rule.entityBoosts!.includes(e.type),
          );
          if (matchingEntities.length > 0) {
            const boost =
              matchingEntities.reduce((sum, e) => sum + e.confidence, 0) /
              matchingEntities.length *
              20;
            const currentScore = scores.get(rule.intentType) || 0;
            scores.set(rule.intentType, Math.min(100, currentScore + boost));
          }
        }
      }
    }

    for (const rule of ALL_INTENT_RULES) {
      if (rule.negativePatterns && rule.negativePatterns.length > 0) {
        for (const negPattern of rule.negativePatterns) {
          if (this.matchPattern(negPattern, text)) {
            const currentScore = scores.get(rule.intentType) || 0;
            scores.set(rule.intentType, Math.max(0, currentScore - 50));
          }
        }
      }
    }

    const sortedIntents = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(([_, score]) => score >= 30);

    if (sortedIntents.length === 0) {
      return this.buildDefaultResult();
    }

    const primary = sortedIntents[0];
    const secondary = sortedIntents.slice(1, 4).map(([type, score]) => ({
      type,
      confidence: score / 100,
    }));

    const allScoresObj: Record<IntentType, number> = { ...DEFAULT_INTENT_SCORES };
    for (const [intentType, score] of scores) {
      allScoresObj[intentType] = score;
    }

    const isAmbiguous = this.detectAmbiguity(text, primary[1]);
    const clarificationQuestions = isAmbiguous ? this.generateClarificationQuestions(text, primary[0]) : undefined;

    return {
      primary: { type: primary[0], confidence: primary[1] / 100 },
      secondary,
      allScores: allScoresObj,
      isAmbiguous,
      clarificationQuestions,
    };
  }

  private matchPattern(pattern: string | RegExp, text: string): boolean {
    if (typeof pattern === 'string') {
      return text.includes(pattern);
    }
    pattern.lastIndex = 0;
    return pattern.test(text);
  }

  private detectAmbiguity(text: string, topScore: number): boolean {
    const hasAmbiguityKeyword = AMBIGUITY_INDICATORS.some(p => {
      p.lastIndex = 0;
      return p.test(text);
    });
    const isTooVague = text.length < 8 || topScore < 50;
    return hasAmbiguityKeyword && isTooVague;
  }

  private generateClarificationQuestions(_text: string, primaryIntent: IntentType): string[] {
    const questionPool: Record<IntentType, string[]> = {
      FORMULA_DESIGN: [
        '您希望针对哪类健康诉求？（降糖/降压/护肝/免疫）',
        '目标消费群体是？（儿童/中老年/运动人群）',
        '偏好哪种产品形态？（液体/固体/即饮/冲调）',
      ],
      SAFETY_ASSESSMENT: [
        '您关注的是哪种类型的安全性？（急性毒性/长期摄入/过敏原）',
        '目标市场是哪个地区？（国内/欧盟/美国/日本）',
        '是否有特定的法规标准需要参考？',
      ],
      PERFORMANCE_OPT: [
        '您希望优化的核心性能指标是什么？（口感/稳定性/溶解性）',
        '当前产品存在的主要问题是什么？',
        '对改进效果的期望程度？',
      ],
      COST_REDUCTION: [
        '您希望降低的成本比例大概是多少？',
        '哪些原料或环节是主要成本来源？',
        '是否可以接受性能上的适度妥协以换取成本优势？',
      ],
      REGULATORY_COMPLIANCE: [
        '您的目标销售市场是哪里？（国内/出口）',
        '产品属于哪个类别？（保健食品/普通食品/特膳食品）',
        '是否已有相关的认证基础？',
      ],
      INGREDIENT_ANALYSIS: [
        '您重点关注的是哪种类型的原料？（活性成分/辅料/添加剂）',
        '分析目的是什么？（筛选替代/质量评估/合规确认）',
        '是否需要对比多个候选原料？',
      ],
      PROCESS_TECHNOLOGY: [
        '您关注的工艺环节是哪一个？（提取/发酵/干燥/包埋）',
        '当前生产规模和设备条件如何？',
        '工艺优化的首要目标是效率还是品质？',
      ],
      MARKET_POSITIONING: [
        '您的目标细分市场是什么？（大众/高端/专业）',
        '主要竞争对手有哪些？',
        '您希望突出的核心卖点是什么？',
      ],
      QUALITY_ASSURANCE: [
        '您关注的质量控制环节是？（原料检验/过程监控/成品检测）',
        '需要符合哪些质量标准或认证体系？',
        '当前存在的主要质量问题是什么？',
      ],
    };

    return questionPool[primaryIntent] || questionPool.FORMULA_DESIGN;
  }

  private buildDefaultResult(): IntentClassificationResult {
    return {
      primary: { type: 'FORMULA_DESIGN', confidence: 0 },
      secondary: [],
      allScores: { ...DEFAULT_INTENT_SCORES },
      isAmbiguous: false,
    };
  }
}
