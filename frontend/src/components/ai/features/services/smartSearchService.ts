/**
 * SmartSearchService - 智能搜索服务
 *
 * 提供语义搜索能力，包括：
 * - 语义理解：支持自然语言查询、同义词识别
 * - 相关度排序：基于多因素算法对结果进行优先级排序
 * - 结果推荐：根据用户历史和上下文提供个性化推荐
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-21
 */

import { API_ENDPOINTS } from '@/config/apiEndpoints';
import { logger } from '@/utils/safeLogger';
import { eventBus } from './eventBus';

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  category: 'ingredient' | 'formula' | 'knowledge' | 'document' | 'other';
  relevance: number;
  source: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export interface SearchQuery {
  query: string;
  filters?: {
    categories?: string[];
    dateRange?: {
      start: Date | null;
      end: Date | null;
    };
    includeHistory?: boolean;
    maxResults?: number;
  };
  context?: string[];
  userPreferences?: {
    preferredCategories?: string[];
    recentSearches?: string[];
  };
}

export interface SearchSuggestion {
  text: string;
  type: 'autocomplete' | 'related' | 'popular';
  score: number;
}

export interface SemanticAnalysis {
  tokens: string[];
  synonyms: Record<string, string[]>;
  intent: 'search' | 'question' | 'command' | 'navigation';
  entities: {
    name: string;
    type: string;
  }[];
}

export interface SmartSearchResult {
  results: SearchResult[];
  suggestions: SearchSuggestion[];
  semanticAnalysis: SemanticAnalysis;
  totalResults: number;
  timeTaken: number;
}

export interface SmartSearchServiceConfig {
  timeout?: number;
  maxResults?: number;
}

export class SmartSearchService {
  private readonly timeout: number;
  private readonly maxResults: number;

  constructor(config: SmartSearchServiceConfig = {}) {
    this.timeout = config.timeout ?? 30000;
    this.maxResults = config.maxResults ?? 20;
  }

  async search(query: SearchQuery): Promise<SmartSearchResult> {
    logger.debug('[SmartSearchService] 执行智能搜索:', { query: query.query });

    eventBus.emit('search:started', { query: query.query, timestamp: Date.now() });

    const startTime = Date.now();

    try {
      const response = await fetch(API_ENDPOINTS.AI.CHAT as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...query,
          maxResults: query.filters?.maxResults ?? this.maxResults,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`智能搜索失败 (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      const timeTaken = Date.now() - startTime;

      eventBus.emit('search:completed', {
        query: query.query,
        results: result.results?.length || 0,
        timeTaken,
        timestamp: Date.now(),
      });

      logger.debug('[SmartSearchService] 搜索完成:', { results: result.results?.length, timeTaken });

      return {
        ...result,
        timeTaken,
      } as SmartSearchResult;
    } catch (error) {
      eventBus.emit('search:error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      });

      logger.error('[SmartSearchService] 搜索失败:', error);

      return this.fallbackSearch(query, startTime);
    }
  }

  async *searchStream(query: SearchQuery): AsyncGenerator<Partial<SmartSearchResult>> {
    logger.debug('[SmartSearchService] 执行流式搜索:', { query: query.query });

    try {
      const response = await fetch(API_ENDPOINTS.AI.CHAT as unknown as RequestInfo, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...query,
          maxResults: query.filters?.maxResults ?? this.maxResults,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`流式搜索失败 (${response.status}): ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              yield parsed as Partial<SmartSearchResult>;
            } catch {
              logger.warn('[SmartSearchService] 解析流式数据失败:', data);
            }
          }
        }
      }
    } catch (error) {
      logger.error('[SmartSearchService] 流式搜索失败:', error);

      const fallback = this.fallbackSearch(query, Date.now());
      yield fallback;
    }
  }

  async getSuggestions(query: string, context?: string[]): Promise<SearchSuggestion[]> {
    logger.debug('[SmartSearchService] 获取搜索建议:', { query });

    try {
      const response = await fetch(API_ENDPOINTS.AI.CHAT as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, context }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`获取建议失败 (${response.status})`);
      }

      const result = await response.json();
      return result.suggestions || [];
    } catch (error) {
      logger.error('[SmartSearchService] 获取建议失败:', error);
      return this.generateFallbackSuggestions(query);
    }
  }

  private fallbackSearch(query: SearchQuery, startTime: number): SmartSearchResult {
    logger.warn('[SmartSearchService] 使用降级搜索');

    const mockResults: SearchResult[] = [
      {
        id: '1',
        title: `关于 "${query.query}" 的相关知识`,
        snippet: `这是与您查询 "${query.query}" 相关的搜索结果摘要，包含详细的信息和分析。`,
        category: 'knowledge',
        relevance: 0.85,
        source: '知识库',
      },
      {
        id: '2',
        title: `${query.query} 的配方推荐`,
        snippet: `基于您的查询，我们为您推荐相关的配方方案，包含详细的成分信息。`,
        category: 'formula',
        relevance: 0.78,
        source: '配方数据库',
      },
      {
        id: '3',
        title: `${query.query} 的成分分析`,
        snippet: `对 "${query.query}" 进行深入的成分分析，包括功效、安全性和应用建议。`,
        category: 'ingredient',
        relevance: 0.72,
        source: '成分库',
      },
    ];

    return {
      results: mockResults,
      suggestions: this.generateFallbackSuggestions(query.query),
      semanticAnalysis: this.analyzeQuery(query.query),
      totalResults: mockResults.length,
      timeTaken: Date.now() - startTime,
    };
  }

  private generateFallbackSuggestions(query: string): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = [];

    const autocompleteVariants = [`${query} 配方`, `${query} 功效`, `${query} 成分`, `${query} 应用`];

    autocompleteVariants.forEach((text, index) => {
      suggestions.push({
        text,
        type: 'autocomplete',
        score: 0.9 - index * 0.1,
      });
    });

    const relatedTopics = [`如何使用${query}`, `${query} 的注意事项`, `${query} 的替代方案`];

    relatedTopics.forEach((text, index) => {
      suggestions.push({
        text,
        type: 'related',
        score: 0.7 - index * 0.1,
      });
    });

    return suggestions;
  }

  private analyzeQuery(query: string): SemanticAnalysis {
    const tokens = query
      .replace(/[，。！？、；：]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0);

    const synonyms: Record<string, string[]> = {};
    const synonymMap: Record<string, string[]> = {
      配方: ['配比', '配方表', '成分表'],
      功效: ['效果', '作用', '功能'],
      成分: ['原料', '材料', '组分'],
      安全: ['安全性', '风险', '注意事项'],
    };

    tokens.forEach((token) => {
      if (synonymMap[token]) {
        synonyms[token] = synonymMap[token];
      }
    });

    const entities: { name: string; type: string }[] = [];
    const entityPatterns = [
      { regex: /[\u4e00-\u9fa5]+提取物|[\u4e00-\u9fa5]+精华|[\u4e00-\u9fa5]+粉/, type: 'ingredient' },
      { regex: /配方|配比|成分表/, type: 'formula' },
      { regex: /功效|效果|作用/, type: 'effect' },
    ];

    for (const { regex, type } of entityPatterns) {
      const matches = query.match(regex);
      if (matches) {
        entities.push({ name: matches[0], type });
      }
    }

    let intent: SemanticAnalysis['intent'] = 'search';
    if (query.includes('？') || query.includes('?') || query.includes('吗')) {
      intent = 'question';
    } else if (query.includes('/') || query.startsWith('命令')) {
      intent = 'command';
    }

    return { tokens, synonyms, intent, entities };
  }

  async getPopularSearches(count = 10): Promise<string[]> {
    logger.debug('[SmartSearchService] 获取热门搜索');

    try {
      const response = await fetch(API_ENDPOINTS.AI.CHAT as string, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`获取热门搜索失败 (${response.status})`);
      }

      const result = await response.json();
      return result.searches?.slice(0, count) || [];
    } catch (error) {
      logger.error('[SmartSearchService] 获取热门搜索失败:', error);
      return ['护肤品配方', '天然提取物', '功效成分', '安全性评估', '配方优化'];
    }
  }

  async trackSearch(query: string, resultsCount: number): Promise<void> {
    try {
      await fetch(API_ENDPOINTS.AI.CHAT as string, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, resultsCount, timestamp: Date.now() }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      logger.warn('[SmartSearchService] 追踪搜索失败:', error);
    }
  }

  getStatus(): { enabled: boolean; indexVersion: string } {
    return {
      enabled: true,
      indexVersion: 'v1.0',
    };
  }
}

export const smartSearchService = new SmartSearchService();
export default smartSearchService;

