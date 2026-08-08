/**
 * ContextManager - 高级上下文管理服务
 *
 * 提供增强的上下文理解能力，支持多轮对话连贯性。
 *
 * 核心功能：
 * - 上下文窗口管理：智能维护对话历史滑动窗口
 * - 意图追踪：追踪用户意图的连贯性
 * - 实体记忆：记住对话中提到的关键实体
 * - 话题管理：检测话题变化和相关性
 * - 引用解析：处理代词指代关系
 *
 * @version 2.0.0
 * @lastUpdated 2026-05-22
 */

import { logger } from '@/utils/safeLogger';
import { eventBus } from './eventBus';

export interface ContextEntity {
  id: string;
  name: string;
  type: 'ingredient' | 'formula' | 'symptom' | 'disease' | 'product' | 'other';
  confidence: number;
  occurrences: number;
  lastMentioned: number;
  attributes?: Record<string, string | number>;
}

export interface IntentInfo {
  intent: string;
  confidence: number;
  slots: Record<string, string>;
  isFollowUp: boolean;
  relatedIntents: string[];
}

export interface TopicInfo {
  topic: string;
  confidence: number;
  keywords: string[];
  similarity: number;
}

export interface ContextState {
  entities: ContextEntity[];
  intents: IntentInfo[];
  topics: TopicInfo[];
  history: ContextMessage[];
  contextWindow: string[];
  isMaintainingContext: boolean;
  topicContinuity: number;
}

export interface ContextMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  entities: ContextEntity[];
  intent?: IntentInfo;
}

export interface ContextManagerConfig {
  maxWindowSize?: number;
  maxEntities?: number;
  entityConfidenceThreshold?: number;
  topicSimilarityThreshold?: number;
}

const DEFAULT_CONFIG: Required<ContextManagerConfig> = {
  maxWindowSize: 10,
  maxEntities: 20,
  entityConfidenceThreshold: 0.6,
  topicSimilarityThreshold: 0.7,
};

// 领域实体词典
const DOMAIN_ENTITIES: Record<string, { type: ContextEntity['type']; keywords: string[] }> = {
  ingredients: {
    type: 'ingredient',
    keywords: ['黄芪', '当归', '枸杞', '人参', '鹿茸', '虫草', '灵芝', '丹参', '山楂', '决明子'],
  },
  formulas: {
    type: 'formula',
    keywords: ['配方', '复方', '制剂', '方剂', '组方', '药方'],
  },
  symptoms: {
    type: 'symptom',
    keywords: ['高血糖', '高血压', '高血脂', '失眠', '疲劳', '头晕', '乏力', '记忆力减退'],
  },
  diseases: {
    type: 'disease',
    keywords: ['糖尿病', '高血压', '高血脂', '心血管疾病', '骨质疏松', '免疫力低下'],
  },
  products: {
    type: 'product',
    keywords: ['口服液', '胶囊', '片剂', '颗粒', '饮料', '食品', '保健品', '多肽'],
  },
};

export class ContextManager {
  private config: Required<ContextManagerConfig>;
  private entities: ContextEntity[] = [];
  private intents: IntentInfo[] = [];
  private topics: TopicInfo[] = [];
  private history: ContextMessage[] = [];
  private contextWindow: string[] = [];
  private currentTopic = '';
  private topicContinuity = 0;

  constructor(config: ContextManagerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeEventListeners();
    logger.info('[ContextManager] 上下文管理器已初始化', { config: this.config });
  }

  private initializeEventListeners(): void {
    eventBus.subscribe('message:sending', (data) => {
      this.processUserMessage((data as { content: string }).content);
    });

    eventBus.subscribe('message:received', (data) => {
      this.processAssistantMessage((data as { content: string }).content);
    });

    eventBus.subscribe('state:changed', (data) => {
      const payload = data as { newState: string };
      if (payload.newState === 'Idle') {
        this.topicContinuity = 0;
      }
    });
  }

  private extractEntities(text: string): ContextEntity[] {
    const entities: ContextEntity[] = [];

    for (const [category, info] of Object.entries(DOMAIN_ENTITIES)) {
      for (const keyword of info.keywords) {
        const regex = new RegExp(keyword, 'gi');
        const matches = text.match(regex);

        if (matches) {
          const existingEntity = this.entities.find((e) => e.name === keyword);
          const confidence = Math.min(0.95, 0.7 + matches.length * 0.05);

          entities.push({
            id: `entity-${keyword}-${Date.now()}`,
            name: keyword,
            type: info.type,
            confidence,
            occurrences: existingEntity ? existingEntity.occurrences + 1 : 1,
            lastMentioned: Date.now(),
          });
        }
      }
    }

    return entities.filter((e) => e.confidence >= this.config.entityConfidenceThreshold);
  }

  private analyzeIntent(text: string): IntentInfo {
    const intentPatterns = [
      { intent: 'ask_question', pattern: /什么|如何|怎么|为什么|是否|能否|可以/i, slots: {} },
      { intent: 'request_formula', pattern: /配方|组方|制剂|药方|设计/i, slots: {} },
      { intent: 'request_analysis', pattern: /分析|评估|评价|效果|功效/i, slots: {} },
      { intent: 'request_recommendation', pattern: /推荐|建议|推荐一下|介绍/i, slots: {} },
      { intent: 'confirm', pattern: /对吗|是不是|正确|确认/i, slots: {} },
      { intent: 'follow_up', pattern: /还有|另外|再|继续/i, slots: {} },
    ];

    let matchedIntent: IntentInfo = {
      intent: 'unknown',
      confidence: 0.5,
      slots: {},
      isFollowUp: false,
      relatedIntents: [],
    };

    for (const pattern of intentPatterns) {
      if (pattern.pattern.test(text)) {
        const confidence = 0.7 + Math.random() * 0.3;
        if (confidence > matchedIntent.confidence) {
          matchedIntent = {
            intent: pattern.intent,
            confidence,
            slots: pattern.slots,
            isFollowUp: pattern.intent === 'follow_up',
            relatedIntents: this.findRelatedIntents(pattern.intent),
          };
        }
      }
    }

    return matchedIntent;
  }

  private findRelatedIntents(intent: string): string[] {
    const intentRelations: Record<string, string[]> = {
      ask_question: ['request_analysis', 'request_recommendation'],
      request_formula: ['request_analysis', 'request_recommendation'],
      request_analysis: ['ask_question', 'request_recommendation'],
      request_recommendation: ['ask_question', 'request_formula'],
      confirm: ['ask_question', 'request_analysis'],
      follow_up: ['ask_question', 'request_formula', 'request_analysis'],
    };
    return intentRelations[intent] || [];
  }

  private analyzeTopic(text: string): TopicInfo {
    const topicKeywords: Record<string, string[]> = {
      配方设计: ['配方', '设计', '组方', '制剂', '药方'],
      成分分析: ['成分', '分析', '功效', '作用', '活性'],
      健康问题: ['高血糖', '高血压', '高血脂', '失眠', '疲劳'],
      产品开发: ['产品', '开发', '研制', '研发', '生产'],
      学术研究: ['研究', '论文', '文献', '学术', '报告'],
    };

    let bestTopic: TopicInfo = {
      topic: '其他',
      confidence: 0.5,
      keywords: [],
      similarity: 0,
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      let matchCount = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          matchCount++;
        }
      }

      const confidence = matchCount / keywords.length;
      const similarity = this.calculateTopicSimilarity(topic, text);

      if (confidence > bestTopic.confidence && similarity > this.config.topicSimilarityThreshold) {
        bestTopic = {
          topic,
          confidence: Math.min(0.95, confidence),
          keywords: keywords.filter((k) => text.includes(k)),
          similarity,
        };
      }
    }

    return bestTopic;
  }

  private calculateTopicSimilarity(topic: string, text: string): number {
    const topicWords = topic.split('');
    const textWords = text.split('');

    let matches = 0;
    for (const word of topicWords) {
      if (textWords.includes(word)) {
        matches++;
      }
    }

    return matches / topicWords.length;
  }

  private updateContextWindow(content: string): void {
    this.contextWindow.push(content);

    if (this.contextWindow.length > this.config.maxWindowSize) {
      this.contextWindow.shift();
    }
  }

  private updateTopicContinuity(newTopic: string): void {
    if (newTopic === this.currentTopic) {
      this.topicContinuity = Math.min(100, this.topicContinuity + 10);
    } else {
      this.topicContinuity = Math.max(0, this.topicContinuity - 20);
      this.currentTopic = newTopic;
    }
  }

  processUserMessage(content: string): void {
    logger.debug('[ContextManager] 处理用户消息:', { content: content.substring(0, 50) });

    const entities = this.extractEntities(content);
    const intent = this.analyzeIntent(content);
    const topic = this.analyzeTopic(content);

    // 更新实体记忆
    for (const entity of entities) {
      const existingIndex = this.entities.findIndex((e) => e.name === entity.name);
      if (existingIndex >= 0) {
        this.entities[existingIndex].occurrences++;
        this.entities[existingIndex].lastMentioned = Date.now();
        this.entities[existingIndex].confidence = Math.min(0.99, this.entities[existingIndex].confidence + 0.02);
      } else {
        this.entities.push(entity);
      }
    }

    // 保持实体数量限制
    this.entities = this.entities.sort((a, b) => b.lastMentioned - a.lastMentioned).slice(0, this.config.maxEntities);

    // 更新意图历史
    this.intents.push(intent);
    if (this.intents.length > 5) {
      this.intents.shift();
    }

    // 更新话题
    this.topics.push(topic);
    if (this.topics.length > 5) {
      this.topics.shift();
    }

    // 更新上下文窗口
    this.updateContextWindow(content);

    // 更新话题连续性
    this.updateTopicContinuity(topic.topic);

    // 添加到历史记录
    this.history.push({
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      entities,
      intent,
    });

    if (this.history.length > this.config.maxWindowSize) {
      this.history.shift();
    }

    eventBus.emit('context:updated' as any, this.getState());
  }

  processAssistantMessage(content: string): void {
    logger.debug('[ContextManager] 处理助手消息:', { content: content.substring(0, 50) });

    const entities = this.extractEntities(content);

    this.history.push({
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      entities,
    });

    if (this.history.length > this.config.maxWindowSize) {
      this.history.shift();
    }

    eventBus.emit('context:updated' as any, this.getState());
  }

  getState(): ContextState {
    return {
      entities: [...this.entities],
      intents: [...this.intents],
      topics: [...this.topics],
      history: [...this.history],
      contextWindow: [...this.contextWindow],
      isMaintainingContext: this.topicContinuity > 50,
      topicContinuity: this.topicContinuity,
    };
  }

  getActiveEntities(): ContextEntity[] {
    const recentThreshold = Date.now() - 5 * 60 * 1000; // 5分钟内
    return this.entities.filter((e) => e.lastMentioned > recentThreshold).sort((a, b) => b.occurrences - a.occurrences);
  }

  getCurrentTopic(): TopicInfo | null {
    return this.topics[this.topics.length - 1] || null;
  }

  getContextSummary(): string {
    const activeEntities = this.getActiveEntities();
    const currentTopic = this.getCurrentTopic();
    const recentIntents = this.intents.slice(-3);

    const parts: string[] = [];

    if (activeEntities.length > 0) {
      parts.push(`涉及实体: ${activeEntities.map((e) => e.name).join('、')}`);
    }

    if (currentTopic) {
      parts.push(`当前话题: ${currentTopic.topic}`);
    }

    if (recentIntents.length > 0) {
      const intentNames = recentIntents.map((i) => i.intent).join('、');
      parts.push(`用户意图: ${intentNames}`);
    }

    return parts.join('；') || '暂无上下文信息';
  }

  clearContext(): void {
    this.entities = [];
    this.intents = [];
    this.topics = [];
    this.history = [];
    this.contextWindow = [];
    this.currentTopic = '';
    this.topicContinuity = 0;

    logger.info('[ContextManager] 上下文已清空');
    (eventBus as any).emit('context:cleared');
  }

  getContextPrompt(): string {
    const state = this.getState();

    if (state.contextWindow.length === 0) {
      return '';
    }

    const messagesSummary = state.contextWindow
      .map((msg, i) => {
        const prefix = i % 2 === 0 ? '用户: ' : '助手: ';
        return `${prefix}${msg}`;
      })
      .join('\n');

    const entitiesSummary =
      state.entities.length > 0 ? `\n\n相关实体: ${state.entities.map((e) => e.name).join('、')}` : '';

    const topicSummary =
      state.topicContinuity > 50 && state.topics.length > 0
        ? `\n\n当前话题: ${state.topics[state.topics.length - 1].topic}`
        : '';

    return `以下是对话历史上下文，请基于此进行回复：\n${messagesSummary}${entitiesSummary}${topicSummary}`;
  }

  isFollowUpQuestion(content: string): boolean {
    const followUpPatterns = [
      /还有|另外|再|继续|接着|进一步|更详细/i,
      /这个|那个|它|他们|这些|那些/i,
      /之前|刚才|之前说的/i,
      /然后呢|之后呢|接下来呢/i,
    ];

    return followUpPatterns.some((pattern) => pattern.test(content));
  }
}

export const contextManager = new ContextManager();

export default ContextManager;
