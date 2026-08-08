import { ProfessionalBaseService } from './ProfessionalBaseService';
import type { ProfessionalServiceConfig } from '../../types/professional';
import {
  CompatibilityRule,
  CompatibilityGroup,
  SHIBAFAN,
  SHIJIUWEI,
  XIANGSHENG,
  COMPATIBILITY_GROUPS,
  getCompatibilityRulesByHerb,
  checkCompatibility,
} from '../../data/compatibilityKnowledge';
import { checkCompatibilityBatch, isCompatible, getHerbConflicts } from '../../data/compatibilityKnowledge';

export interface CompatibilityCheckResult {
  compatible: boolean;
  conflicts: CompatibilityRule[];
  warnings: CompatibilityRule[];
  suggestions: CompatibilitySuggestion[];
  summary: string;
}

export interface CompatibilitySuggestion {
  id: string;
  type: 'avoid' | 'caution' | 'recommend';
  herb1: string;
  herb2: string;
  description: string;
  alternative?: string;
}

export interface CompatibilityReport {
  herbs: string[];
  result: CompatibilityCheckResult;
  timestamp: number;
}

export interface HerbCompatibilityInfo {
  herbName: string;
  opposites: string[];
  fears: string[];
  enhances: string[];
  compatibleHerbs: string[];
  incompatibleHerbs: string[];
}

class CompatibilityService extends ProfessionalBaseService {
  private mockMode = true;

  constructor(config: ProfessionalServiceConfig = {}) {
    super({
      ...config,
      baseURL: config.baseURL || 'https://api.compatibility.rmfood.com',
      cacheDuration: 60 * 60 * 1000,
    });
  }

  public enableMockMode(enable: boolean): void {
    this.mockMode = enable;
  }

  public async checkHerbCompatibility(herbs: string[]): Promise<CompatibilityCheckResult> {
    const cacheKey = this.getCacheKey('/compatibility/check', herbs.sort());
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      return this.mockCheckCompatibility(herbs);
    }

    const result = await this.post<CompatibilityCheckResult>('/api/compatibility/check', { herbs });
    this.setCache(cacheKey, result);
    return result;
  }

  private mockCheckCompatibility(herbs: string[]): CompatibilityCheckResult {
    const conflicts = checkCompatibilityBatch(herbs);

    const highSeverityConflicts = conflicts.filter((c) => c.severity === 'high');
    const mediumSeverityConflicts = conflicts.filter((c) => c.severity === 'medium');

    const suggestions: CompatibilitySuggestion[] = [];

    for (const conflict of highSeverityConflicts) {
      suggestions.push({
        id: `avoid_${conflict.id}`,
        type: 'avoid',
        herb1: conflict.herb1,
        herb2: conflict.herb2,
        description: conflict.description,
        alternative: this.getAlternativeHerb(conflict),
      });
    }

    for (const conflict of mediumSeverityConflicts) {
      suggestions.push({
        id: `caution_${conflict.id}`,
        type: 'caution',
        herb1: conflict.herb1,
        herb2: conflict.herb2,
        description: conflict.description,
      });
    }

    for (let i = 0; i < herbs.length; i++) {
      for (let j = i + 1; j < herbs.length; j++) {
        const enhanceRule = this.findEnhanceRule(herbs[i], herbs[j]);
        if (enhanceRule) {
          suggestions.push({
            id: `recommend_${enhanceRule.id}`,
            type: 'recommend',
            herb1: enhanceRule.herb1,
            herb2: enhanceRule.herb2,
            description: enhanceRule.reason,
          });
        }
      }
    }

    const summary = this.generateSummary(herbs, conflicts, suggestions);

    return {
      compatible: conflicts.length === 0,
      conflicts: highSeverityConflicts,
      warnings: mediumSeverityConflicts,
      suggestions,
      summary,
    };
  }

  private findEnhanceRule(herb1: string, herb2: string): CompatibilityRule | null {
    for (const rule of XIANGSHENG.rules) {
      if ((rule.herb1 === herb1 && rule.herb2 === herb2) || (rule.herb1 === herb2 && rule.herb2 === herb1)) {
        return rule;
      }
    }
    return null;
  }

  private getAlternativeHerb(conflict: CompatibilityRule): string | undefined {
    const alternatives: Record<string, string> = {
      甘遂: '大戟',
      大戟: '甘遂',
      芫花: '大戟',
      海藻: '昆布',
      半夏: '陈皮',
      瓜蒌: '贝母',
      贝母: '瓜蒌',
      白蔹: '白及',
      白及: '白蔹',
      人参: '党参',
      沙参: '麦冬',
      丹参: '川芎',
      玄参: '生地',
      苦参: '黄连',
      细辛: '白芷',
      芍药: '当归',
    };
    return alternatives[conflict.herb1] || alternatives[conflict.herb2];
  }

  private generateSummary(
    herbs: string[],
    conflicts: CompatibilityRule[],
    suggestions: CompatibilitySuggestion[],
  ): string {
    if (conflicts.length === 0) {
      if (suggestions.some((s) => s.type === 'recommend')) {
        return `${herbs.join('、')}配伍合理，具有协同增效作用。`;
      }
      return `${herbs.join('、')}配伍安全，未发现明显禁忌。`;
    }

    const highConflicts = conflicts.filter((c) => c.severity === 'high');
    const mediumConflicts = conflicts.filter((c) => c.severity === 'medium');

    let summary = '';
    if (highConflicts.length > 0) {
      summary += `${herbs.join('、')}存在配伍禁忌：`;
      summary += highConflicts.map((c) => c.description).join('；');
    }
    if (mediumConflicts.length > 0) {
      if (summary) summary += '；';
      summary += `需注意：${mediumConflicts.map((c) => c.description).join('；')}`;
    }

    return summary;
  }

  public async getHerbCompatibilityInfo(herbName: string): Promise<HerbCompatibilityInfo> {
    const cacheKey = `/compatibility/herb/${herbName}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const { opposites, fears, enhances } = getHerbConflicts(herbName);
      const result: HerbCompatibilityInfo = {
        herbName,
        opposites,
        fears,
        enhances,
        compatibleHerbs: enhances,
        incompatibleHerbs: [...opposites, ...fears],
      };
      this.setCache(cacheKey, result);
      return result;
    }

    const result = await this.get<HerbCompatibilityInfo>(`/api/compatibility/herb/${encodeURIComponent(herbName)}`);
    this.setCache(cacheKey, result);
    return result;
  }

  public async getAllCompatibilityGroups(): Promise<CompatibilityGroup[]> {
    const cacheKey = '/compatibility/groups';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      this.setCache(cacheKey, COMPATIBILITY_GROUPS);
      return COMPATIBILITY_GROUPS;
    }

    const result = await this.get<CompatibilityGroup[]>('/api/compatibility/groups');
    this.setCache(cacheKey, result);
    return result;
  }

  public async getCompatibilityRulesByHerb(herbName: string): Promise<CompatibilityRule[]> {
    const cacheKey = `/compatibility/rules/${herbName}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const rules = getCompatibilityRulesByHerb(herbName);
      this.setCache(cacheKey, rules);
      return rules;
    }

    const result = await this.get<CompatibilityRule[]>(`/api/compatibility/rules/${encodeURIComponent(herbName)}`);
    this.setCache(cacheKey, result);
    return result;
  }

  public async checkTwoHerbs(herb1: string, herb2: string): Promise<CompatibilityRule | null> {
    const cacheKey = `/compatibility/check/${herb1}/${herb2}`;
    const cached = this.getFromCache(cacheKey);
    if (cached !== undefined) return cached;

    if (this.mockMode) {
      const rule = checkCompatibility(herb1, herb2);
      this.setCache(cacheKey, rule);
      return rule;
    }

    const result = await this.get<CompatibilityRule | null>(
      `/api/compatibility/check/${encodeURIComponent(herb1)}/${encodeURIComponent(herb2)}`,
    );
    this.setCache(cacheKey, result);
    return result;
  }

  public async getCompatibilityReport(herbs: string[]): Promise<CompatibilityReport> {
    const result = await this.checkHerbCompatibility(herbs);
    return {
      herbs,
      result,
      timestamp: Date.now(),
    };
  }

  public async getRecommendedCombinations(herbName: string): Promise<CompatibilitySuggestion[]> {
    const cacheKey = `/compatibility/recommendations/${herbName}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    if (this.mockMode) {
      const { enhances } = getHerbConflicts(herbName);
      const suggestions: CompatibilitySuggestion[] = [];

      for (const enhanceHerb of enhances) {
        const rule = this.findEnhanceRule(herbName, enhanceHerb);
        if (rule) {
          suggestions.push({
            id: `recommend_${rule.id}`,
            type: 'recommend',
            herb1: herbName,
            herb2: enhanceHerb,
            description: rule.reason,
          });
        }
      }

      this.setCache(cacheKey, suggestions);
      return suggestions;
    }

    const result = await this.get<CompatibilitySuggestion[]>(
      `/api/compatibility/recommendations/${encodeURIComponent(herbName)}`,
    );
    this.setCache(cacheKey, result);
    return result;
  }

  public async validateFormula(formula: string[]): Promise<{
    isValid: boolean;
    issues: {
      type: 'error' | 'warning' | 'info';
      message: string;
      herbs: string[];
    }[];
  }> {
    if (this.mockMode) {
      const conflicts = checkCompatibilityBatch(formula);
      const issues: {
        type: 'error' | 'warning' | 'info';
        message: string;
        herbs: string[];
      }[] = [];

      for (const conflict of conflicts) {
        issues.push({
          type: conflict.severity === 'high' ? 'error' : 'warning',
          message: conflict.description,
          herbs: [conflict.herb1, conflict.herb2],
        });
      }

      return {
        isValid: conflicts.length === 0,
        issues,
      };
    }

    return this.post<{ isValid: boolean; issues: any[] }>('/api/compatibility/validate', { formula });
  }

  public clearCompatibilityCache(): void {
    this.clearCache();
  }

  public getServiceInfo(): {
    mockMode: boolean;
    cachedItems: number;
    totalRules: number;
  } {
    let totalRules = 0;
    for (const group of COMPATIBILITY_GROUPS) {
      totalRules += group.rules.length;
    }

    return {
      mockMode: this.mockMode,
      cachedItems: this.getCacheStats().size,
      totalRules,
    };
  }
}

const compatibilityService = new CompatibilityService();

export default compatibilityService;
export { CompatibilityService };
