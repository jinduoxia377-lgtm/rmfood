/**
 * DeepThinkingService V2 - 增强型深度思考服务
 *
 * 多维度分析能力升级：
 * - 语义分析：实体识别、关键词提取、意图分类、情感分析
 * - 领域分析：食品配方领域专业知识注入（原料、功效、工艺、法规）
 * - 上下文理解：多轮对话连贯性、指代消解、话题追踪
 * - 逻辑推理：多步骤推理、假设验证、证据链构建
 * - 复杂度评估：问题复杂度量化、子任务拆解建议
 *
 * @version 2.0.0
 */

import { API_ENDPOINTS } from '@/config/apiEndpoints';
import { logger } from '@/utils/safeLogger';
import { eventBus } from './eventBus';

export interface SemanticAnalysis {
  entities: {
    name: string;
    type: 'ingredient' | 'formula' | 'symptom' | 'disease' | 'dosage_form' | 'process' | 'regulation' | 'other';
    confidence: number;
    category?: string;
  }[];
  keywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  intent:
    | 'question'
    | 'request'
    | 'statement'
    | 'complaint'
    | 'suggestion'
    | 'comparison'
    | 'how_to'
    | 'definition'
    | 'unknown';
  intentConfidence: number;
  complexity: number;
}

export interface DomainAnalysis {
  productType: string | null;
  targetEfficacy: string[];
  keyIngredients: { name: string; type: string; confidence: number }[];
  dosageForm: string | null;
  regulatoryContext: string | null;
  processKeywords: string[];
  safetyConcerns: string[];
  domainConfidence: number;
}

export interface ContextAnalysis {
  references: {
    text: string;
    type: 'pronoun' | 'entity' | 'topic';
    target?: string;
  }[];
  contextWindow: string[];
  topicContinuity: number;
  isFollowUp: boolean;
  relatedQuestions: string[];
}

export interface LogicalReasoning {
  steps: {
    step: number;
    description: string;
    dimension: string;
    confidence: number;
  }[];
  conclusion: string;
  supportingEvidence: string[];
  confidence: number;
  alternativeSolutions?: string[];
  assumptions?: string[];
}

export interface MultiDimensionResult {
  semanticAnalysis: SemanticAnalysis;
  domainAnalysis: DomainAnalysis;
  contextAnalysis: ContextAnalysis;
  logicalReasoning: LogicalReasoning;
  enhancedPrompt: string;
  analysisDimensions: {
    name: string;
    score: number;
    findings: string[];
  }[];
}

export interface DeepThinkingServiceConfig {
  timeout?: number;
}

const DOMAIN_ENTITY_PATTERNS: {
  regex: RegExp;
  type: SemanticAnalysis['entities'][number]['type'];
  category?: string;
}[] = [
  {
    regex: /[\u4e00-\u9fa5]+(?:提取物|精华|粉|肽|多糖|黄酮|皂苷|生物碱|甾醇|花青素)/,
    type: 'ingredient',
    category: '活性成分',
  },
  { regex: /(?:大豆|胶原|鱼|玉米|卵白|乳清|大米|海洋|小麦|玉米)肽/, type: 'ingredient', category: '多肽类' },
  {
    regex: /(?:黄芪|人参|灵芝|枸杞|当归|党参|山药|茯苓|甘草|山楂|苦瓜|桑叶|红曲|银杏|绞股蓝)/,
    type: 'ingredient',
    category: '药食同源',
  },
  { regex: /(?:益生菌|益生元|乳酸菌|双歧杆菌|酵母菌)/, type: 'ingredient', category: '微生物' },
  { regex: /(?:固体饮料|片剂|胶囊|软糖|粉剂|口服液|冲剂|丸剂|膏方|滴丸)/, type: 'dosage_form', category: '剂型' },
  { regex: /(?:酶解|发酵|提取|纯化|干燥|造粒|压片|包衣|灭菌|均质|乳化|微囊化)/, type: 'process', category: '工艺' },
  {
    regex: /(?:GB|ISO|HACCP|GMP|SC|保健食品|特医食品|新资源食品|药食同源|备案|申报|注册)/,
    type: 'regulation',
    category: '法规标准',
  },
  { regex: /配方|配方表|配比|成分表|复配/, type: 'formula', category: '配方' },
  {
    regex: /(?:降|调节|改善|控制|辅助).{0,6}(?:血压|血糖|血脂|三高|胆固醇|尿酸|体重|免疫|睡眠|记忆|抗氧化)/,
    type: 'symptom',
    category: '功效目标',
  },
  {
    regex: /(?:安全|毒性|副作用|禁忌|不良反应|过敏|重金属|农残|微生物|菌落|霉菌)/,
    type: 'symptom',
    category: '安全关注',
  },
];

const EFFICACY_MAPPING: Record<string, string> = {
  降三高: '代谢调节(三高)',
  降压: '血压调节',
  降血糖: '血糖调节',
  降血脂: '血脂调节',
  减肥: '体重管理',
  免疫: '免疫调节',
  睡眠: '睡眠改善',
  美容: '美容抗衰',
  肠道: '肠道健康',
  抗氧化: '抗氧化',
  抗疲劳: '抗疲劳',
  护肝: '肝脏保护',
  关节: '关节健康',
  骨骼: '骨骼健康',
  心血管: '心血管保护',
};

class DeepThinkingServiceV2 {
  private readonly timeout: number;

  constructor(config: DeepThinkingServiceConfig = {}) {
    this.timeout = config.timeout ?? 30000;
  }

  async analyze(question: string, context?: string[]): Promise<MultiDimensionResult> {
    logger.debug('[DeepThinkingServiceV2] 开始多维度深度分析:', { question, contextLength: context?.length });

    eventBus.emit('thinking:step', { question, timestamp: Date.now() });

    try {
      const response = await fetch(API_ENDPOINTS.AI.CHAT as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`深度思考分析失败 (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      eventBus.emit('thinking:step', {
        question,
        result,
        timestamp: Date.now(),
      });

      logger.debug('[DeepThinkingServiceV2] 深度分析完成');
      return this.enrichWithDomainAnalysis(result as MultiDimensionResult, question);
    } catch (error) {
      eventBus.emit('thinking:step', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });

      logger.error('[DeepThinkingServiceV2] 深度分析失败，使用增强版降级分析:', error);
      return this.enhancedFallbackAnalysis(question, context);
    }
  }

  async *analyzeStream(question: string, context?: string[]): AsyncGenerator<Partial<MultiDimensionResult>> {
    logger.debug('[DeepThinkingServiceV2] 开始流式深度分析:', { question });

    try {
      const response = await fetch(API_ENDPOINTS.AI.CHAT as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`流式分析失败 (${response.status}): ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法获取响应流');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') return;
            try {
              yield JSON.parse(data) as Partial<MultiDimensionResult>;
            } catch {
              logger.warn('[DeepThinkingServiceV2] 解析流式数据失败:', data);
            }
          }
        }
      }
    } catch (error) {
      logger.error('[DeepThinkingServiceV2] 流式分析失败:', error);
      yield this.enhancedFallbackAnalysis(question, context);
    }
  }

  private enrichWithDomainAnalysis(base: MultiDimensionResult, _question: string): MultiDimensionResult {
    return {
      ...base,
      domainAnalysis: base.domainAnalysis || this.analyzeDomain(_question),
      analysisDimensions: base.analysisDimensions || this.buildAnalysisDimensions(base),
    };
  }

  private enhancedFallbackAnalysis(question: string, context?: string[]): MultiDimensionResult {
    logger.warn('[DeepThinkingServiceV2] 使用增强版多维度降级分析');

    const semantic = this.performSemanticAnalysis(question);
    const domain = this.analyzeDomain(question);

    return {
      semanticAnalysis: semantic,
      domainAnalysis: domain,
      contextAnalysis: {
        references: [],
        contextWindow: context || [],
        topicContinuity: (context?.length ?? 0) ? 0.8 : 0.5,
        isFollowUp: (context?.length ?? 0) > 0,
        relatedQuestions: this.generateRelatedQuestions(question, domain),
      },
      logicalReasoning: {
        steps: this.buildReasoningSteps(question, domain),
        conclusion: this.generateConclusion(question, domain),
        supportingEvidence: this.buildEvidenceChain(question, domain),
        confidence: Math.min(semantic.complexity * 0.8 + domain.domainConfidence * 0.2, 0.95),
        alternativeSolutions: this.generateAlternatives(domain),
        assumptions: this.identifyAssumptions(question, domain),
      },
      enhancedPrompt: this.buildEnhancedPrompt(question, context, semantic, domain),
      analysisDimensions: this.buildAnalysisDimensionsFromScratch(semantic, domain),
    };
  }

  private performSemanticAnalysis(question: string): SemanticAnalysis {
    const entities = this.extractEntitiesEnhanced(question);
    const keywords = this.extractKeywords(question);
    const sentiment = this.analyzeSentiment(question);
    const intent = this.detectIntentEnhanced(question);
    const complexity = this.calculateComplexity(entities, keywords, question.length);

    return {
      entities,
      keywords,
      sentiment,
      sentimentScore: sentiment === 'positive' ? 0.75 : sentiment === 'negative' ? -0.5 : 0,
      intent: intent.type,
      intentConfidence: intent.confidence,
      complexity,
    };
  }

  private extractEntitiesEnhanced(question: string): SemanticAnalysis['entities'] {
    const entities: SemanticAnalysis['entities'] = [];

    for (const { regex, type, category } of DOMAIN_ENTITY_PATTERNS) {
      const matches = question.match(regex);
      if (matches) {
        entities.push({
          name: matches[0],
          type,
          confidence: type === 'ingredient' ? 0.88 : type === 'dosage_form' ? 0.92 : 0.78,
          category,
        });
      }
    }

    return entities;
  }

  private extractKeywords(question: string): string[] {
    const stopWords = [
      '的',
      '是',
      '在',
      '有',
      '和',
      '了',
      '我',
      '你',
      '他',
      '她',
      '它',
      '这',
      '那',
      '一个',
      '一种',
      '如何',
      '什么',
    ];
    const words = question
      .replace(/[，。！？、；：""''（）【】《》]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 1 && !stopWords.includes(word));

    return [...new Set(words)].slice(0, 12);
  }

  private calculateComplexity(
    entities: SemanticAnalysis['entities'],
    _keywords: string[],
    questionLength: number,
  ): number {
    let score = 0.3;

    const entityTypes = new Set(entities.map((e) => e.type));
    score += Math.min(entityTypes.size * 0.1, 0.3);

    if (entities.some((e) => e.type === 'ingredient')) score += 0.12;
    if (entities.some((e) => e.type === 'dosage_form')) score += 0.08;
    if (entities.some((e) => e.type === 'regulation')) score += 0.1;
    if (entities.some((e) => e.type === 'process')) score += 0.1;

    if (questionLength > 30) score += 0.08;
    if (questionLength > 50) score += 0.07;

    return Math.min(score, 1.0);
  }

  private analyzeDomain(question: string): DomainAnalysis {
    const entities = this.extractEntitiesEnhanced(question);

    const productTypeMatch = /(?:设计|开发|研制|研发|创建).{0,10}(?:配方|产品|制剂|饮料|片剂|胶囊)/.exec(question);
    const dosageFormMatch = entities.find((e) => e.type === 'dosage_form');
    const regulationMatch = entities.find((e) => e.type === 'regulation');
    const processMatches = entities.filter((e) => e.type === 'process').map((e) => e.name);
    const efficacyMatches = entities.filter((e) => e.category === '功效目标').map((e) => e.name);
    const safetyMatches = entities.filter((e) => e.category === '安全关注').map((e) => e.name);

    const targetEfficacy: string[] = [];
    for (const [key, value] of Object.entries(EFFICACY_MAPPING)) {
      if (question.includes(key)) targetEfficacy.push(value);
    }

    const ingredients = entities
      .filter((e) => e.type === 'ingredient')
      .map((e) => ({
        name: e.name,
        type: e.category || '未知',
        confidence: e.confidence,
      }));

    const domainConfidence = Math.min(
      0.4 +
        ingredients.length * 0.08 +
        (targetEfficacy.length > 0 ? 0.15 : 0) +
        (dosageFormMatch ? 0.12 : 0) +
        (regulationMatch ? 0.1 : 0) +
        (processMatches.length > 0 ? 0.08 : 0),
      0.95,
    );

    return {
      productType: productTypeMatch ? productTypeMatch[0].replace(/^(设计|开发|研制|研发|创建)/, '').trim() : null,
      targetEfficacy,
      keyIngredients: ingredients,
      dosageForm: dosageFormMatch?.name || null,
      regulatoryContext: regulationMatch?.name || null,
      processKeywords: processMatches,
      safetyConcerns: safetyMatches,
      domainConfidence,
    };
  }

  private detectIntentEnhanced(question: string): { type: SemanticAnalysis['intent']; confidence: number } {
    if (/？|\?|吗$|什么|怎么|如何|为什么|哪/.test(question)) return { type: 'question', confidence: 0.9 };
    if (/请|帮我|需要|希望|想要|能否/.test(question)) return { type: 'request', confidence: 0.85 };
    if (/建议|应该|可以|推荐|最好/.test(question)) return { type: 'suggestion', confidence: 0.8 };
    if (/比较|对比|区别|差异|优缺点|VS|vs/.test(question)) return { type: 'comparison', confidence: 0.88 };
    if (/如何|怎么.*做|步骤|流程|方法|方案/.test(question)) return { type: 'how_to', confidence: 0.86 };
    if (/什么是|定义|解释|含义/.test(question)) return { type: 'definition', confidence: 0.87 };
    if (/问题|错误|不行|失败|麻烦|投诉/.test(question)) return { type: 'complaint', confidence: 0.78 };
    return { type: 'statement', confidence: 0.65 };
  }

  private analyzeSentiment(question: string): SemanticAnalysis['sentiment'] {
    const positiveWords = ['好', '棒', '优秀', '完美', '喜欢', '满意', '推荐', '优化', '提升', '增强'];
    const negativeWords = ['差', '糟糕', '不好', '问题', '错误', '失败', '麻烦', '缺陷', '风险', '毒性'];

    let posCount = 0;
    let negCount = 0;
    for (const word of positiveWords) {
      if (question.includes(word)) posCount++;
    }
    for (const word of negativeWords) {
      if (question.includes(word)) negCount++;
    }

    if (posCount > negCount) return 'positive';
    if (negCount > posCount) return 'negative';
    return 'neutral';
  }

  private buildReasoningSteps(question: string, domain: DomainAnalysis): LogicalReasoning['steps'] {
    const steps: LogicalReasoning['steps'] = [
      { step: 1, description: `语义解析：${question.slice(0, 25)}...`, dimension: '语义理解', confidence: 0.92 },
      {
        step: 2,
        description: `领域识别：检测到 ${domain.keyIngredients.length} 个核心原料 + ${domain.targetEfficacy.length} 个功效目标`,
        dimension: '领域知识',
        confidence: 0.87,
      },
    ];

    if (domain.dosageForm) {
      steps.push({
        step: steps.length + 1,
        description: `剂型适配：${domain.dosageForm} 的工艺约束与质量标准`,
        dimension: '工艺路线',
        confidence: 0.83,
      });
    }
    if (domain.regulatoryContext) {
      steps.push({
        step: steps.length + 1,
        description: `合规检查：${domain.regulatoryContext} 相关法规要求梳理`,
        dimension: '法规合规',
        confidence: 0.89,
      });
    }
    if (domain.safetyConcerns.length > 0) {
      steps.push({
        step: steps.length + 1,
        description: `风险评估：关注 ${domain.safetyConcerns.join('、')} 等安全问题`,
        dimension: '安全评估',
        confidence: 0.85,
      });
    }

    steps.push(
      {
        step: steps.length + 1,
        description: '综合决策：基于多维度分析生成最优建议',
        dimension: '综合决策',
        confidence: 0.8,
      },
      { step: steps.length + 1, description: '内容组织：结构化输出专业回复', dimension: '内容生成', confidence: 0.9 },
    );

    return steps;
  }

  private generateConclusion(question: string, domain: DomainAnalysis): string {
    const parts: string[] = [];
    if (domain.keyIngredients.length > 0) parts.push(`涉及${domain.keyIngredients.map((i) => i.name).join('、')}`);
    if (domain.targetEfficacy.length > 0) parts.push(`针对${domain.targetEfficacy.join('/')}需求`);
    if (domain.dosageForm) parts.push(`${domain.dosageForm}剂型`);
    return `此问题属于${parts.length > 0 ? parts.join('的') : '通用'}专业咨询，需从技术、法规、安全等多维度综合分析`;
  }

  private buildEvidenceChain(question: string, domain: DomainAnalysis): string[] {
    const evidence: string[] = [`用户原始问题: "${question.slice(0, 60)}"`];
    if (domain.keyIngredients.length > 0) evidence.push(`原料依据: 已识别${domain.keyIngredients.length}种关键成分`);
    if (domain.targetEfficacy.length > 0) evidence.push(`功效依据: 目标方向为${domain.targetEfficacy.join('、')}`);
    if (domain.regulatoryContext) evidence.push(`法规依据: 需符合${domain.regulatoryContext}相关要求`);
    return evidence;
  }

  private generateAlternatives(_domain: DomainAnalysis): string[] {
    return ['从成本效益角度简化方案', '考虑替代性原料组合', '分阶段实施策略（MVP → 完整版）'];
  }

  private identifyAssumptions(question: string, domain: DomainAnalysis): string[] {
    const assumptions: string[] = [];
    if (domain.keyIngredients.length === 0) assumptions.push('假设用户可接受推荐的候选原料');
    if (!domain.dosageForm) assumptions.push('假设以最常用的固体饮料作为默认剂型');
    if (domain.targetEfficacy.length === 0) assumptions.push('假设用户关注基础营养补充功能');
    if (question.length < 15) assumptions.push('用户输入信息有限，部分推断基于行业常见场景');
    return assumptions;
  }

  private generateRelatedQuestions(question: string, domain: DomainAnalysis): string[] {
    const questions: string[] = [];
    if (domain.targetEfficacy.length > 0) questions.push(`${domain.targetEfficacy[0]}的作用机制是什么？`);
    if (domain.keyIngredients.length > 0) questions.push(`${domain.keyIngredients[0].name}的最佳用量范围？`);
    if (domain.dosageForm) questions.push(`${domain.dosageForm}的关键质量控制点有哪些？`);
    questions.push(`${question.slice(0, 20)} 的成本估算和开发周期？`);
    return questions.slice(0, 4);
  }

  private buildEnhancedPrompt(
    question: string,
    context: string[] | undefined,
    semantic: SemanticAnalysis,
    domain: DomainAnalysis,
  ): string {
    const contextStr = context?.join('\n') || '无历史上下文';
    const ingredientStr = domain.keyIngredients.map((i) => `- ${i.name} (${i.type})`).join('\n') || '- 待识别';
    const efficacyStr = domain.targetEfficacy.join('、') || '待明确';

    return `
## 用户请求分析报告

### 基本信息
- **原始问题**: ${question}
- **问题复杂度**: ${(semantic.complexity * 100).toFixed(0)}%
- **用户意图**: ${semantic.intent} (置信度: ${(semantic.intentConfidence * 100).toFixed(0)}%)
- **情感倾向**: ${semantic.sentiment}

### 领域特征
- **产品类型**: ${domain.productType || '未指定'}
- **目标功效**: ${efficacyStr}
- **核心原料**:
${ingredientStr}
- **剂型**: ${domain.dosageForm || '未指定'}
- **法规上下文**: ${domain.regulatoryContext || '无特殊法规要求'}
- **安全关注**: ${domain.safetyConcerns.length > 0 ? domain.safetyConcerns.join('、') : '无明显安全关注点'}

### 对话上下文
${contextStr}

---
请基于以上多维分析结果，提供：
1. 结构化的专业回答
2. 数据支撑的关键论断
3. 可执行的建议步骤
4. 潜在风险提示
5. 后续深入探讨的方向
`.trim();
  }

  private buildAnalysisDimensions(result: MultiDimensionResult): MultiDimensionResult['analysisDimensions'] {
    return [
      {
        name: '语义理解',
        score: result.semanticAnalysis.intentConfidence,
        findings: [`意图: ${result.semanticAnalysis.intent}`, `实体数: ${result.semanticAnalysis.entities.length}`],
      },
      {
        name: '领域知识',
        score: result.domainAnalysis?.domainConfidence ?? 0.7,
        findings: result.domainAnalysis?.keyIngredients.map((i) => i.name) ?? [],
      },
      {
        name: '逻辑推理',
        score: result.logicalReasoning.confidence,
        findings: [`推理步数: ${result.logicalReasoning.steps.length}`],
      },
      {
        name: '上下文',
        score: result.contextAnalysis.topicContinuity,
        findings: [`连续度: ${result.contextAnalysis.topicContinuity}`],
      },
    ];
  }

  private buildAnalysisDimensionsFromScratch(
    semantic: SemanticAnalysis,
    domain: DomainAnalysis,
  ): MultiDimensionResult['analysisDimensions'] {
    return [
      {
        name: '🔍 语义解析',
        score: semantic.intentConfidence,
        findings: [
          `意图类型: ${semantic.intent}`,
          `实体数量: ${semantic.entities.length}`,
          `关键词: ${semantic.keywords.slice(0, 3).join(', ')}`,
        ],
      },
      {
        name: '🧪 领域知识',
        score: domain.domainConfidence,
        findings: [
          `原料数: ${domain.keyIngredients.length}`,
          `功效: ${domain.targetEfficacy.join('/') || '未明确'}`,
          `剂型: ${domain.dosageForm || '未指定'}`,
        ],
      },
      {
        name: '⚖️ 法规合规',
        score: domain.regulatoryContext ? 0.85 : 0.3,
        findings: [domain.regulatoryContext ? `已识别: ${domain.regulatoryContext}` : '无显式法规提及'],
      },
      {
        name: '⚙️ 工艺路线',
        score: domain.processKeywords.length > 0 ? 0.75 : 0.3,
        findings:
          domain.processKeywords.length > 0 ? [`工艺词: ${domain.processKeywords.join(', ')}`] : ['待分析具体工艺'],
      },
      {
        name: '🛡️ 安全评估',
        score: domain.safetyConcerns.length > 0 ? 0.8 : 0.4,
        findings: domain.safetyConcerns.length > 0 ? [`关注项: ${domain.safetyConcerns.join(', ')}`] : ['需进一步评估'],
      },
      { name: '💰 成本市场', score: 0.45, findings: ['建议在后续对话中深入探讨'] },
    ];
  }

  getStatus(): { enabled: boolean; model: string; version: string } {
    return {
      enabled: true,
      model: 'deep-thinking-v2-multi-dimensional',
      version: '2.0.0',
    };
  }
}

export const deepThinkingServiceV2 = new DeepThinkingServiceV2();
export default deepThinkingServiceV2;
