import axios from 'axios';
import type { AxiosInstance } from 'axios';
import apiClient from '../api/client';

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
  knowledge_base: KnowledgeBaseType;
  knowledge_base_description: string;
  intent: IntentType;
  intent_description: string;
  params: {
    query: string;
    keywords: string[];
    entities: ParsedEntity[];
  };
  data: any;
  from_cache: boolean;
}

export interface TCMHerb {
  id: string;
  name_cn: string;
  name_latin: string;
  name_pinyin: string;
  category: string;
  effects: string;
  ob_percent: number;
  dl_value: number;
  compound_count: number;
  compounds?: {
    name: string;
    ob: number;
    dl: number;
    target_count: number;
  }[];
}

export interface TCMHerbListResponse {
  items: TCMHerb[];
  total: number;
  page: number;
  page_size: number;
}

export interface Peptide {
  sequence: string;
  source_protein: string;
  source_organism: string;
  activity_type: string;
  activity_type_cn?: string;
  activity_value: number;
  activity_unit: string;
  molecular_weight: number;
  hydrolysis_enzyme: string;
  dfbp_id: string;
  literature_doi?: string;
}

export interface PeptideSearchResponse {
  peptides: Peptide[];
  total: number;
}

export interface PeptideActivityType {
  type_en: string;
  type_cn: string;
  count: number;
}

export interface KnowledgeBaseSummary {
  system: string;
  version: string;
  knowledge_bases: {
    id: string;
    name: string;
    description: string;
    total?: number;
    categories?: Record<string, number>;
    activity_types?: Record<string, number>;
    statistics?: any;
  }[];
  cache_stats?: any;
}

class KnowledgeBaseService {
  private client: AxiosInstance;
  private cache: Map<string, { data: any; timestamp: number }>;

  constructor() {
    this.client = apiClient;
    this.cache = new Map();
  }

  /** 规范化参数对象为稳定 key 字符串（sortKeys=true） */
  private normalizeParams(params?: Record<string, any>): string {
    if (!params || Object.keys(params).length === 0) return '';
    const sorted = Object.keys(params).sort().reduce((acc, k) => {
      acc[k] = params[k];
      return acc;
    }, {} as Record<string, any>);
    return JSON.stringify(sorted);
  }

  private getCacheKey(endpoint: string, params?: Record<string, any>): string {
    return `${endpoint}:${this.normalizeParams(params)}`;
  }

  /** 按接口类型返回差异化 TTL（毫秒） */
  private getTTLByEndpoint(endpoint: string): number {
    if (endpoint.includes('/summary') || endpoint.includes('/standards') || endpoint.includes('/homology') || endpoint.includes('/new-food') || endpoint.includes('/additives')) {
      return 10 * 60 * 1000; // 10 分钟：统计数据变化慢
    }
    return 5 * 60 * 1000; // 5 分钟：查询类数据
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.getTTLByEndpoint(key)) {
      return cached.data;
    }
    this.cache.delete(key); // 淘汰过期项
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    // LRU 上限保护：缓存超过 200 项时淘汰最旧的 50%
    if (this.cache.size > 200) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < Math.floor(entries.length / 2); i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  public async smartQuery(query: string): Promise<IntentRecognitionResult> {
    const cacheKey = this.getCacheKey('/knowledge-base/query', { query });
    const cached = this.getFromCache<IntentRecognitionResult>(cacheKey);
    if (cached) return cached;

    const response = await this.client.post<IntentRecognitionResult>(
      '/knowledge-base/query',
      {},
      { params: { query } },
    );
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async getTCMHerbs(keyword?: string, page = 1, pageSize = 20): Promise<TCMHerbListResponse> {
    const cacheKey = this.getCacheKey('/knowledge-base/tcm/herbs', { keyword, page, pageSize });
    const cached = this.getFromCache<TCMHerbListResponse>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<TCMHerbListResponse>('/knowledge-base/tcm/herbs', {
      params: { keyword, page, page_size: pageSize },
    });
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async getTCMHerbDetail(herbName: string): Promise<TCMHerb> {
    const cacheKey = this.getCacheKey(`/knowledge-base/tcm/herbs/${herbName}`);
    const cached = this.getFromCache<TCMHerb>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<TCMHerb>(`/knowledge-base/tcm/herbs/${encodeURIComponent(herbName)}`);
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async getTCMCompounds(herbName: string): Promise<{ herb_name: string; compounds: any[] }> {
    const cacheKey = this.getCacheKey(`/knowledge-base/tcm/compounds/${herbName}`);
    const cached = this.getFromCache<{ herb_name: string; compounds: any[] }>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<{ herb_name: string; compounds: any[] }>(
      `/knowledge-base/tcm/compounds/${encodeURIComponent(herbName)}`,
    );
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async checkTCMHomology(herbName: string): Promise<any> {
    const cacheKey = this.getCacheKey(`/knowledge-base/tcm/homology/${herbName}`);
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<any>(`/knowledge-base/tcm/homology/${encodeURIComponent(herbName)}`);
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async searchPeptides(
    activityType?: string,
    sourceProtein?: string,
    threshold?: number,
  ): Promise<PeptideSearchResponse> {
    const cacheKey = this.getCacheKey('/knowledge-base/peptide/search', {
      activityType,
      sourceProtein,
      threshold,
    });
    const cached = this.getFromCache<PeptideSearchResponse>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<PeptideSearchResponse>('/knowledge-base/peptide/search', {
      params: { activity_type: activityType, source_protein: sourceProtein, threshold },
    });
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async getPeptideDetail(sequence: string): Promise<Peptide> {
    const cacheKey = this.getCacheKey(`/knowledge-base/peptide/${sequence}`);
    const cached = this.getFromCache<Peptide>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<Peptide>(`/knowledge-base/peptide/${sequence}`);
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async getPeptideActivityTypes(): Promise<{ activity_types: PeptideActivityType[] }> {
    const cacheKey = this.getCacheKey('/knowledge-base/peptide/activity-types');
    const cached = this.getFromCache<{ activity_types: PeptideActivityType[] }>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<{ activity_types: PeptideActivityType[] }>(
      '/knowledge-base/peptide/activity-types',
    );
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async getSimilarPeptides(sequence: string, minLength = 2): Promise<{ similar_peptides: Peptide[] }> {
    const cacheKey = this.getCacheKey('/knowledge-base/peptide/similar', { sequence, minLength });
    const cached = this.getFromCache<{ similar_peptides: Peptide[] }>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<{ similar_peptides: Peptide[] }>(
      `/knowledge-base/peptide/similar/${sequence}`,
      { params: { min_length: minLength } },
    );
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async getRegulationStandards(category?: string, keyword?: string): Promise<{ standards: any[] }> {
    const cacheKey = this.getCacheKey('/knowledge-base/regulation/standards', { category, keyword });
    const cached = this.getFromCache<{ standards: any[] }>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<{ standards: any[] }>('/knowledge-base/regulation/standards', {
      params: { category, keyword },
    });
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async getRegulationHomology(name?: string): Promise<{ materials: any[] }> {
    const cacheKey = this.getCacheKey('/knowledge-base/regulation/homology', { name });
    const cached = this.getFromCache<{ materials: any[] }>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<{ materials: any[] }>('/knowledge-base/regulation/homology', {
      params: { name },
    });
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async getNewFoodMaterials(name?: string): Promise<{ materials: any[] }> {
    const cacheKey = this.getCacheKey('/knowledge-base/regulation/new-food-materials', { name });
    const cached = this.getFromCache<{ materials: any[] }>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<{ materials: any[] }>('/knowledge-base/regulation/new-food-materials', {
      params: { name },
    });
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async searchAdditives(keyword?: string, functionType?: string): Promise<{ additives: any[] }> {
    const cacheKey = this.getCacheKey('/knowledge-base/regulation/additives', {
      keyword,
      functionType,
    });
    const cached = this.getFromCache<{ additives: any[] }>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<{ additives: any[] }>('/knowledge-base/regulation/additives', {
      params: { keyword, function: functionType },
    });
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async checkAdditiveUsage(additiveName: string, foodCategory = '糕点'): Promise<any> {
    const cacheKey = this.getCacheKey('/knowledge-base/regulation/additive-check', {
      additiveName,
      foodCategory,
    });
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<any>('/knowledge-base/regulation/additive-check', {
      params: { additive_name: additiveName, food_category: foodCategory },
    });
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async validateFormula(ingredients: string[]): Promise<any> {
    const cacheKey = this.getCacheKey('/knowledge-base/regulation/validate-formula', {
      ingredients,
    });
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) return cached;

    const response = await this.client.post<any>('/knowledge-base/regulation/validate-formula', ingredients);
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async getSummary(): Promise<KnowledgeBaseSummary> {
    const cacheKey = this.getCacheKey('/knowledge-base/summary');
    const cached = this.getFromCache<KnowledgeBaseSummary>(cacheKey);
    if (cached) return cached;

    const response = await this.client.get<KnowledgeBaseSummary>('/knowledge-base/summary');
    this.setCache(cacheKey, response.data);
    return response.data;
  }

  public async clearCache(): Promise<void> {
    await this.client.delete('/knowledge-base/cache/clear');
    this.cache.clear();
  }

  public getCacheStats(): { size: number } {
    return { size: this.cache.size };
  }
}

const knowledgeBaseService = new KnowledgeBaseService();

export default knowledgeBaseService;
export { KnowledgeBaseService };
