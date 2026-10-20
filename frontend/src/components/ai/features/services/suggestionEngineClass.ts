/**
 * ContextAwareSuggestionEngineV2 — 引擎类实现
 *
 * 此文件由 contextAwareSuggestionEngineV2.ts 拆分而来。
 * 类型定义和领域知识已移至 domainKnowledge.ts。
 */

import { logger } from '@/utils/safeLogger';
import type {
  SemanticEntity, EntityType, ExtractedIntent, IntentType,
  ContextProfile, DynamicSuggestion, AdaptedTerm, AnalysisResult,
  KeywordAnalysis, SentimentResult, ComplexityMetrics, ContextRelevanceScore,
} from './domainKnowledge';
import { DOMAIN_KNOWLEDGE, INTENT_PATTERNS, DYNAMIC_TEMPLATES } from './domainKnowledge';

export class ContextAwareSuggestionEngineV2 {
  private contextProfile: ContextProfile;
  private conversationHistory: { input: string; timestamp: number; topics: string[] }[];
  private entityCache: Map<string, SemanticEntity[]>;
  private keywordCache: Map<string, KeywordAnalysis>;
  private suggestionCache: Map<string, DynamicSuggestion[]>;
  private learningData: Map<string, { accepted: number; rejected: number }>;

  private static readonly ANALYSIS_TIMEOUT_MS = 150;
  private static readonly MAX_CACHE_SIZE = 100;
  private static readonly DEBOUNCE_MS = 200;
  private lastAnalysisTime = 0;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private pendingAnalysis: { input: string; resolve: Function } | null = null;

  constructor(initialContext?: Partial<ContextProfile>) {
    this.contextProfile = {
      domain: 'food',
      expertise: 'intermediate',
      focusAreas: [],
      recentTopics: [],
      preferredStyle: 'formal',
      interactionCount: 0,
      ...initialContext,
    };
    this.conversationHistory = [];
    this.entityCache = new Map();
    this.keywordCache = new Map();
    this.suggestionCache = new Map();
    this.learningData = new Map();
  }

  async analyzeAndGenerate(
    userInput: string,
    options?: {
      maxSuggestions?: number;
      enableContextMemory?: boolean;
      forceRefresh?: boolean;
    },
  ): Promise<{ analysis: AnalysisResult; suggestions: DynamicSuggestion[] }> {
    const startTime = performance.now();
    const maxSuggestions = options?.maxSuggestions ?? 6;

    if (!userInput.trim()) {
      return {
        analysis: this.createEmptyAnalysis(),
        suggestions: this.getDefaultSuggestions().slice(0, maxSuggestions),
      };
    }

    try {
      const analysis = await this.performDeepAnalysis(userInput);

      let suggestions = await this.generateDynamicSuggestions(analysis, userInput);

      if (options?.enableContextMemory !== false) {
        suggestions = this.enhanceWithContext(suggestions, analysis);
      }

      suggestions = suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, maxSuggestions);

      this.updateConversationHistory(userInput, analysis);

      const elapsed = performance.now() - startTime;
      logger.log(`[ContextAwareEngine V2] 分析完成: ${elapsed.toFixed(1)}ms | 建议: ${suggestions.length}条`);

      return { analysis, suggestions };
    } catch (error) {
      logger.warn('[ContextAwareEngine V2] 分析异常，回退到基础模式:', error);
      return {
        analysis: this.createEmptyAnalysis(),
        suggestions: this.getFallbackSuggestions(userInput).slice(0, maxSuggestions),
      };
    }
  }

  private async performDeepAnalysis(input: string): Promise<AnalysisResult> {
    const cacheKey = input.substring(0, 80);

    if (this.entityCache.has(cacheKey)) {
      const cached = this.entityCache.get(cacheKey)!;
      return {
        entities: cached,
        intent: this.extractIntent(input, cached),
        keywords: this.analyzeKeywords(input, cached),
        sentiment: this.analyzeSentiment(input),
        complexity: this.assessComplexity(input, cached),
        contextRelevance: this.calculateContextRelevance(input, cached),
      };
    }

    const entities = this.extractEntities(input);
    this.entityCache.set(cacheKey, entities);

    return {
      entities,
      intent: this.extractIntent(input, entities),
      keywords: this.analyzeKeywords(input, entities),
      sentiment: this.analyzeSentiment(input),
      complexity: this.assessComplexity(input, entities),
      contextRelevance: this.calculateContextRelevance(input, entities),
    };
  }

  private extractEntities(text: string): SemanticEntity[] {
    const entities: SemanticEntity[] = [];

    for (const [term, knowledge] of Object.entries(DOMAIN_KNOWLEDGE)) {
      const mainIndex = text.indexOf(term);
      if (mainIndex !== -1) {
        entities.push({
          text: term,
          type: this.inferEntityType(term),
          confidence: 0.95,
          position: { start: mainIndex, end: mainIndex + term.length },
          attributes: {
            category: knowledge.properties[0] || 'general',
            related: knowledge.relatedEntities.slice(0, 3).join(','),
          },
        });

        for (const synonym of knowledge.synonyms) {
          const synIndex = text.indexOf(synonym);
          if (synIndex !== -1 && synIndex !== mainIndex) {
            entities.push({
              text: synonym,
              type: this.inferEntityType(term),
              confidence: 0.75,
              position: { start: synIndex, end: synIndex + synonym.length },
              attributes: { canonicalForm: term },
            });
          }
        }

        for (const related of knowledge.relatedEntities) {
          if (text.includes(related)) {
            entities.push({
              text: related,
              type: 'INGREDIENT',
              confidence: 0.85,
              position: { start: text.indexOf(related), end: text.indexOf(related) + related.length },
              attributes: { parentConcept: term },
            });
          }
        }
      }
    }

    const quantityPattern = /(\d+(?:\.\d+)?)\s*(%|g|mg|kg|ml|L|ppm|IU)/g;
    let match;
    while ((match = quantityPattern.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'QUANTITY',
        confidence: 0.98,
        position: { start: match.index, end: match.index + match[0].length },
      });
    }

    return entities.sort((a, b) => a.position.start - b.position.start);
  }

  private inferEntityType(term: string): EntityType {
    const safetyTerms = ['安全', '风险', '毒理', 'ADI', 'GRAS'];
    const costTerms = ['成本', '价格', '费用', 'BOM'];
    const processTerms = ['工艺', '流程', '生产', '加工'];
    const marketTerms = ['市场', '趋势', '竞品', '消费者'];

    if (safetyTerms.some((t) => term.includes(t))) return 'SAFETY';
    if (costTerms.some((t) => term.includes(t))) return 'COST';
    if (processTerms.some((t) => term.includes(t))) return 'PROCESS';
    if (marketTerms.some((t) => term.includes(t))) return 'MARKET';

    if (term.includes('配方') || term.includes('产品')) return 'FORMULA';
    if (term.includes('原料') || term.includes('成分') || term.includes('剂')) return 'INGREDIENT';
    if (term.includes('稳定') || term.includes('性能') || term.includes('口感')) return 'PROPERTY';

    return 'INGREDIENT';
  }

  private extractIntent(text: string, entities: SemanticEntity[]): ExtractedIntent {
    let bestMatch: { type: IntentType; confidence: number; action: string } = {
      type: 'GENERAL_INQUIRY',
      confidence: 0.3,
      action: '咨询',
    };

    for (const pattern of INTENT_PATTERNS) {
      const matches = text.match(pattern.pattern);
      if (matches && matches.length > 0) {
        const confidence = pattern.weight * (matches.length / Math.max(text.length / 10, 1));
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            type: pattern.type,
            confidence: Math.min(confidence, 0.98),
            action: pattern.action,
          };
        }
      }
    }

    const targetEntity = entities.find((e) => e.type === 'FORMULA' || e.type === 'INGREDIENT' || e.type === 'PROPERTY');

    return {
      ...bestMatch,
      primaryAction: bestMatch.action,
      targetObject: targetEntity?.text,
      constraints: entities.filter((e) => e.type === 'PROPERTY').map((e) => e.text),
    };
  }

  private analyzeKeywords(text: string, entities: SemanticEntity[]): KeywordAnalysis {
    const cacheKey = text.substring(0, 60);
    if (this.keywordCache.has(cacheKey)) {
      return this.keywordCache.get(cacheKey)!;
    }

    const stopWords = new Set(['的', '是', '在', '有', '和', '了', '我', '你', '这', '那', '什么', '如何', '为什么']);
    const words = text.split(/[\s,.!?;:，。！？、；：]+/).filter((w) => w.length >= 2 && !stopWords.has(w));

    const weights = new Map<string, number>();

    words.forEach((word) => {
      let weight = 0.5;

      const entityMatch = entities.find((e) => e.text.includes(word) || word.includes(e.text));
      if (entityMatch) {
        weight += entityMatch.confidence * 0.4;
      }

      if (this.contextProfile.focusAreas.some((f) => word.includes(f) || f.includes(word))) {
        weight += 0.25;
      }

      if (this.contextProfile.recentTopics.some((t) => word === t || t.includes(word))) {
        weight += 0.15;
      }

      const domainMatch = Object.keys(DOMAIN_KNOWLEDGE).some((k) => k.includes(word) || word.includes(k));
      if (domainMatch) {
        weight += 0.2;
      }

      weights.set(word, Math.min(weight, 1.0));
    });

    const sortedEntries = [...weights.entries()].sort((a, b) => b[1] - a[1]);

    const result: KeywordAnalysis = {
      primary: sortedEntries.filter(([, w]) => w >= 0.7).map(([k]) => k),
      secondary: sortedEntries.filter(([, w]) => w >= 0.4 && w < 0.7).map(([k]) => k),
      longTail: sortedEntries.filter(([, w]) => w < 0.4).map(([k]) => k),
      trending: this.getTrendingKeywords(sortedEntries.map(([k]) => k)),
      weights,
    };

    this.keywordCache.set(cacheKey, result);
    this.cleanupCache(this.keywordCache, ContextAwareSuggestionEngineV2.MAX_CACHE_SIZE);

    return result;
  }

  private getTrendingKeywords(keywords: string[]): string[] {
    const trendingTerms = [
      '清洁标签',
      '植物基',
      '减糖',
      '可持续发展',
      '功能性',
      '个性化营养',
      '大豆肽',
      '益生菌',
      '胶原蛋白',
      '免疫力',
    ];
    return keywords.filter((k) => trendingTerms.some((t) => k.includes(t) || t.includes(k)));
  }

  private analyzeSentiment(text: string): SentimentResult {
    const positiveIndicators = ['好', '优', '棒', '满意', '喜欢', '推荐', '高效', '优秀', 'good', 'excellent', 'great'];
    const negativeIndicators = [
      '差',
      '糟',
      '问题',
      '失败',
      '困难',
      '麻烦',
      '不好',
      'bad',
      'problem',
      'fail',
      'difficult',
    ];

    let score = 0;
    const emotions: string[] = [];

    positiveIndicators.forEach((indicator) => {
      if (text.includes(indicator)) {
        score += 0.15;
        emotions.push('positive');
      }
    });
    negativeIndicators.forEach((indicator) => {
      if (text.includes(indicator)) {
        score -= 0.15;
        emotions.push('concerned');
      }
    });

    if (text.includes('!') || text.includes('！') || text.includes('请') || text.includes('help')) {
      emotions.push('urgent');
    }
    if (text.includes('?') || text.includes('？') || text.includes('怎么') || text.includes('how')) {
      emotions.push('inquisitive');
    }

    score = Math.max(-1, Math.min(1, score));

    return {
      polarity: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral',
      score,
      emotions: [...new Set(emotions)],
    };
  }

  private assessComplexity(_text: string, entities: SemanticEntity[]): ComplexityMetrics {
    const technicalTermCount = entities.filter((e) => ['SAFETY', 'REGULATION', 'PROCESS'].includes(e.type)).length;

    const hasQuantities = entities.some((e) => e.type === 'QUANTITY');
    const hasMultipleEntities = entities.length >= 3;

    let score = 20;
    score += Math.min(technicalTermCount * 15, 45);
    if (hasQuantities) score += 15;
    if (hasMultipleEntities) score += 10;
    score += Math.min(entities.length * 3, 15);

    score = Math.min(score, 100);

    let level: ComplexityMetrics['level'] = 'simple';
    if (score >= 70) level = 'expert';
    else if (score >= 50) level = 'complex';
    else if (score >= 30) level = 'moderate';

    return {
      level,
      score,
      technicalTerms: technicalTermCount,
      sentenceStructure: hasMultipleEntities ? 'compound' : 'simple',
    };
  }

  private calculateContextRelevance(_text: string, entities: SemanticEntity[]): ContextRelevanceScore {
    let historyMatch = 0;
    let topicContinuity = 0;
    let userPreferenceAlign = 0;

    if (this.conversationHistory.length > 0) {
      const recentTopics = this.conversationHistory.slice(-3).flatMap((h) => h.topics);
      const currentTopics = entities.map((e) => e.text);

      const overlap = currentTopics.filter((t) => recentTopics.includes(t)).length;
      historyMatch = Math.min(overlap / Math.max(currentTopics.length, 1), 1) * 100;

      if (this.conversationHistory.length > 1) {
        const prevTopics = this.conversationHistory[this.conversationHistory.length - 1].topics;
        topicContinuity =
          (currentTopics.filter((t) => prevTopics.includes(t)).length / Math.max(currentTopics.length, 1)) * 100;
      }
    }

    if (this.contextProfile.focusAreas.length > 0) {
      const matchedFocus = entities.filter((e) =>
        this.contextProfile.focusAreas.some((f) => e.text.includes(f) || f.includes(e.text)),
      ).length;
      userPreferenceAlign = (matchedFocus / Math.max(entities.length, 1)) * 100;
    }

    const overall = historyMatch * 0.35 + topicContinuity * 0.35 + userPreferenceAlign * 0.3;

    return { historyMatch, topicContinuity, userPreferenceAlign, overall };
  }

  private async generateDynamicSuggestions(analysis: AnalysisResult, userInput: string): Promise<DynamicSuggestion[]> {
    const suggestions: DynamicSuggestion[] = [];
    const startTime = performance.now();

    for (const template of DYNAMIC_TEMPLATES) {
      if (!template.applicableIntents.includes(analysis.intent.type)) continue;

      const relevance = this.calculateTemplateRelevance(template, analysis, userInput);
      if (relevance < template.minRelevance) continue;

      const adapted = this.adaptTemplate(template, analysis, userInput);

      suggestions.push({
        id: `dynamic-${template.id}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        title: adapted.title,
        description: adapted.description,
        relevanceScore: relevance,
        contextMatch: analysis.contextRelevance.overall,
        adaptiveness: adapted.adaptScore,

        originalTemplate: template.baseTitle,
        adaptedTerms: adapted.adaptedTerms,

        intentType: analysis.intent.type,
        category: this.getCategoryLabel(analysis.intent.type),
        keywords: analysis.keywords.primary.slice(0, 3),

        metadata: {
          generationTime: performance.now() - startTime,
          source: adapted.adaptScore > 80 ? 'contextual' : adapted.adaptScore > 60 ? 'semantic' : 'template',
          confidence: analysis.intent.confidence,
        },
      });

      if (performance.now() - startTime > ContextAwareSuggestionEngineV2.ANALYSIS_TIMEOUT_MS) {
        logger.warn('[ContextAwareEngine V2] Generation timeout reached');
        break;
      }
    }

    if (suggestions.length === 0) {
      return this.generateSemanticBasedSuggestions(analysis, userInput);
    }

    return suggestions;
  }

  private calculateTemplateRelevance(
    template: (typeof DYNAMIC_TEMPLATES)[0],
    analysis: AnalysisResult,
    _input: string,
  ): number {
    void _input;
    let score = 50;

    if (analysis.intent.confidence > 0.7) score += 20;
    if (analysis.entities.length >= 2) score += 10;
    if (analysis.complexity.score >= 40) score += 5;

    if (analysis.contextRelevance.overall > 50) score += 10;
    if (analysis.sentiment.polarity === 'positive') score += 5;

    score = Math.min(score, 98);

    return score;
  }

  private adaptTemplate(
    template: (typeof DYNAMIC_TEMPLATES)[0],
    analysis: AnalysisResult,
    _input: string,
  ): { title: string; description: string; adaptScore: number; adaptedTerms: AdaptedTerm[] } {
    void _input;
    const adaptedTerms: AdaptedTerm[] = [];
    let adaptScore = 50;

    const target = analysis.intent.targetObject || analysis.keywords.primary[0] || '目标产品';
    const entity = analysis.entities[0]?.text || '核心要素';
    const action = analysis.intent.primaryAction || /\{action\}/.exec(template.baseTitle) ? '优化' : '';

    let title = template.baseTitle
      .replace('{target}', target)
      .replace('{entity}', entity)
      .replace('{action}', action)
      .replace('{entity1}', analysis.keywords.primary[0] || '方案A')
      .replace('{entity2}', analysis.keywords.primary[1] || '方案B')
      .replace('{entities}', analysis.keywords.primary.slice(0, 3).join('/'));

    const description = template.baseDescription
      .replace('{target}', target)
      .replace('{entity}', entity)
      .replace('{action}', action);

    for (const rule of template.adaptRules) {
      if (this.evaluateCondition(rule.condition, analysis)) {
        const newTitle = rule.transform
          .replace('{target}', target)
          .replace('{entity}', entity)
          .replace('{action}', action);

        if (newTitle !== title) {
          adaptedTerms.push({
            original: title,
            adapted: newTitle,
            reason: 'user_context',
          });
          title = newTitle;
          adaptScore += 15;
        }
      }
    }

    if (this.contextProfile.expertise === 'expert') {
      const technicalEnhancement = this.applyExpertiseEnhancement(title);
      if (technicalEnhancement !== title) {
        adaptedTerms.push({
          original: title,
          adapted: technicalEnhancement,
          reason: 'expertise_level',
        });
        title = technicalEnhancement;
        adaptScore += 10;
      }
    }

    adaptScore = Math.min(adaptScore, 99);

    return { title, description, adaptScore, adaptedTerms };
  }

  private evaluateCondition(condition: string, analysis: AnalysisResult): boolean {
    if (condition.startsWith('expertise=')) {
      return this.contextProfile.expertise === condition.split('=')[1];
    }
    if (condition.startsWith('focus=')) {
      const focus = condition.split('=')[1];
      return analysis.entities.some((e) => e.type === (focus.toUpperCase() as EntityType));
    }
    if (condition.startsWith('trend=')) {
      const trend = condition.split('=')[1].replace(/_/g, ' ');
      return analysis.keywords.trending.some((t) => t.includes(trend) || trend.includes(t));
    }
    if (condition.startsWith('style=')) {
      return this.contextProfile.preferredStyle === condition.split('=')[1];
    }
    if (condition.startsWith('region=')) {
      return true;
    }
    if (condition.startsWith('count>=')) {
      const minCount = parseInt(condition.split('>=')[1]);
      return analysis.keywords.primary.length >= minCount;
    }
    return false;
  }

  private applyExpertiseEnhancement(title: string): string {
    const enhancements: [RegExp, string][] = [
      [/方案/g, '系统性解决方案'],
      [/分析/g, '深度剖析'],
      [/建议/g, '专业建议'],
      [/优化/g, '系统性优化'],
      [/设计/g, '工程设计'],
    ];

    let enhanced = title;
    for (const [pattern, replacement] of enhancements) {
      if (pattern.test(enhanced)) {
        enhanced = enhanced.replace(pattern, replacement);
        break;
      }
    }

    return enhanced;
  }

  private generateSemanticBasedSuggestions(analysis: AnalysisResult, _input: string): DynamicSuggestion[] {
    void _input;
    const suggestions: DynamicSuggestion[] = [];

    if (analysis.keywords.primary.length > 0) {
      const keyword = analysis.keywords.primary[0];
      suggestions.push({
        id: `semantic-keyword-${Date.now()}`,
        title: `${keyword}相关的专业分析与建议`,
        description: `围绕${keyword}提供多维度专业洞察`,
        relevanceScore: 65,
        contextMatch: analysis.contextRelevance.overall,
        adaptiveness: 55,
        intentType: analysis.intent.type,
        category: '语义关联',
        keywords: analysis.keywords.primary,
        adaptedTerms: [],
        metadata: {
          generationTime: 0,
          source: 'semantic',
          confidence: 0.6,
        },
      });
    }

    if (analysis.entities.length > 0) {
      const mainEntity = analysis.entities[0];
      suggestions.push({
        id: `semantic-entity-${Date.now()}`,
        title: `${mainEntity.text}的深度技术解析`,
        description: `从专业角度深入解读${mainEntity.text}的技术特性和应用场景`,
        relevanceScore: 62,
        contextMatch: analysis.contextRelevance.overall,
        adaptiveness: 50,
        intentType: analysis.intent.type,
        category: '实体聚焦',
        keywords: analysis.keywords.primary,
        adaptedTerms: [],
        metadata: {
          generationTime: 0,
          source: 'semantic',
          confidence: 0.55,
        },
      });
    }

    return suggestions;
  }

  private enhanceWithContext(suggestions: DynamicSuggestion[], analysis: AnalysisResult): DynamicSuggestion[] {
    void analysis;
    if (this.conversationHistory.length === 0) return suggestions;

    return suggestions.map((suggestion) => {
      let boost = 0;
      const recentTopics = this.conversationHistory.slice(-3).flatMap((h) => h.topics);

      for (const keyword of suggestion.keywords) {
        if (recentTopics.includes(keyword)) {
          boost += 8;
        }
      }

      if (boost > 0) {
        return {
          ...suggestion,
          relevanceScore: Math.min(suggestion.relevanceScore + boost, 98),
          contextMatch: Math.min(suggestion.contextMatch + boost * 1.2, 100),
        };
      }

      return suggestion;
    });
  }

  private updateConversationHistory(input: string, analysis: AnalysisResult): void {
    this.conversationHistory.push({
      input: input.substring(0, 100),
      timestamp: Date.now(),
      topics: analysis.keywords.primary.slice(0, 5),
    });

    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-15);
    }

    this.contextProfile.recentTopics = [
      ...new Set([...analysis.keywords.primary.slice(0, 3), ...this.contextProfile.recentTopics.slice(0, 7)]),
    ];

    this.contextProfile.interactionCount++;
  }

  recordFeedback(suggestionId: string, accepted: boolean): void {
    const existing = this.learningData.get(suggestionId) || { accepted: 0, rejected: 0 };
    if (accepted) {
      existing.accepted++;
    } else {
      existing.rejected++;
    }
    this.learningData.set(suggestionId, existing);
  }

  updateContextProfile(updates: Partial<ContextProfile>): void {
    this.contextProfile = { ...this.contextProfile, ...updates };
  }

  private getCategoryLabel(intentType: IntentType): string {
    const labels: Record<IntentType, string> = {
      FORMULA_DESIGN: '配方设计',
      SAFETY_ASSESSMENT: '安全评估',
      PERFORMANCE_OPT: '性能优化',
      COST_ANALYSIS: '成本分析',
      INGREDIENT_SELECT: '原料选择',
      PROCESS_IMPROVE: '工艺改进',
      MARKET_RESEARCH: '市场调研',
      COMPLIANCE_CHECK: '合规检查',
      COMPARISON: '对比分析',
      TREND_PREDICTION: '趋势预测',
      GENERAL_INQUIRY: '综合咨询',
    };
    return labels[intentType] || '专业建议';
  }

  private createEmptyAnalysis(): AnalysisResult {
    return {
      entities: [],
      intent: { type: 'GENERAL_INQUIRY', confidence: 0.3, primaryAction: '咨询' },
      keywords: { primary: [], secondary: [], longTail: [], trending: [], weights: new Map() },
      sentiment: { polarity: 'neutral', score: 0, emotions: [] },
      complexity: { level: 'simple', score: 10, technicalTerms: 0, sentenceStructure: 'simple' },
      contextRelevance: { historyMatch: 0, topicContinuity: 0, userPreferenceAlign: 0, overall: 0 },
    };
  }

  private getDefaultSuggestions(): DynamicSuggestion[] {
    return [
      {
        id: 'default-1',
        title: '帮我设计一款低糖配方的甜味剂组合',
        description: '基于最新减糖趋势，提供科学的甜味剂复配方案',
        relevanceScore: 90,
        contextMatch: 75,
        adaptiveness: 80,
        intentType: 'FORMULA_DESIGN',
        category: '热门推荐',
        keywords: ['低糖', '甜味剂', '配方设计'],
        adaptedTerms: [],
        metadata: { generationTime: 0, source: 'template', confidence: 0.9 },
      },
      {
        id: 'default-2',
        title: '分析这个配方的安全性风险',
        description: '从毒理学、法规合规等多维度进行全面安全评估',
        relevanceScore: 88,
        contextMatch: 70,
        adaptiveness: 75,
        intentType: 'SAFETY_ASSESSMENT',
        category: '热门推荐',
        keywords: ['安全性', '风险评估', '合规'],
        adaptedTerms: [],
        metadata: { generationTime: 0, source: 'template', confidence: 0.88 },
      },
      {
        id: 'default-3',
        title: '预测这个配方的口感和稳定性',
        description: '利用感官科学原理预测产品感官特性和货架期',
        relevanceScore: 85,
        contextMatch: 65,
        adaptiveness: 72,
        intentType: 'PERFORMANCE_OPT',
        category: '热门推荐',
        keywords: ['口感', '稳定性', '预测'],
        adaptedTerms: [],
        metadata: { generationTime: 0, source: 'template', confidence: 0.85 },
      },
      {
        id: 'default-4',
        title: '推荐替代原料以降低成本',
        description: '在保证品质的前提下，寻找高性价比替代方案',
        relevanceScore: 82,
        contextMatch: 60,
        adaptiveness: 68,
        intentType: 'COST_ANALYSIS',
        category: '热门推荐',
        keywords: ['成本', '替代', '优化'],
        adaptedTerms: [],
        metadata: { generationTime: 0, source: 'template', confidence: 0.82 },
      },
    ];
  }

  private getFallbackSuggestions(input: string): DynamicSuggestion[] {
    const keywords = input
      .split(/[\s,.!?;:，。！？、；：]+/)
      .filter((w) => w.length > 1)
      .slice(0, 3);

    return [
      {
        id: 'fallback-1',
        title: `${keywords[0] || '目标'}的专业分析与优化建议`,
        description: `基于"${keywords.join('')}"提供针对性专业建议`,
        relevanceScore: 65,
        contextMatch: 50,
        adaptiveness: 45,
        intentType: 'GENERAL_INQUIRY',
        category: '智能推荐',
        keywords,
        adaptedTerms: [],
        metadata: { generationTime: 0, source: 'predictive', confidence: 0.6 },
      },
      {
        id: 'fallback-2',
        title: '深入了解相关技术细节',
        description: '获取更深入的技术信息和最佳实践指导',
        relevanceScore: 58,
        contextMatch: 45,
        adaptiveness: 40,
        intentType: 'GENERAL_INQUIRY',
        category: '扩展阅读',
        keywords,
        adaptedTerms: [],
        metadata: { generationTime: 0, source: 'template', confidence: 0.55 },
      },
    ];
  }

  private cleanupCache<T>(cache: Map<string, T>, maxSize: number): void {
    if (cache.size <= maxSize) return;
    const keysToRemove = Array.from(cache.keys()).slice(0, Math.floor(maxSize * 0.3));
    keysToRemove.forEach((key) => cache.delete(key));
  }

  clearAllCaches(): void {
    this.entityCache.clear();
    this.keywordCache.clear();
    this.suggestionCache.clear();
  }

  getStats(): {
    cacheSizes: { entities: number; keywords: number; suggestions: number };
    historyLength: number;
    profile: ContextProfile;
  } {
    return {
      cacheSizes: {
        entities: this.entityCache.size,
        keywords: this.keywordCache.size,
        suggestions: this.suggestionCache.size,
      },
      historyLength: this.conversationHistory.length,
      profile: this.contextProfile,
    };
  }
}

let engineInstance: ContextAwareSuggestionEngineV2 | null = null;

export function getContextAwareEngine(initialContext?: Partial<ContextProfile>): ContextAwareSuggestionEngineV2 {
  if (!engineInstance) {
    engineInstance = new ContextAwareSuggestionEngineV2(initialContext);
  }
  return engineInstance;
}

export default ContextAwareSuggestionEngineV2;
