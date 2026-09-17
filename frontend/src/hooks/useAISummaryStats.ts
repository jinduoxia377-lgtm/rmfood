/**
 * useAISummaryStats — AI 页面统计卡片数据获取
 *
 * 从后端获取实时统计数据，替代硬编码数字。
 * 后端返回 snake_case，此处转换为 camelCase 匹配 AISummaryStats 类型。
 */
import { useQuery } from '@tanstack/react-query';
import type { AISummaryStats } from '@/types/ai.api';

const STATS_QUERY_KEY = ['ai-summary-stats'] as const;

interface AISummaryStatsRaw {
  chat_count: number;
  generate_count: number;
  safety_checks: number;
  synergy_count: number;
  taste_count: number;
  stability_count: number;
  peptide_analyze_count: number;
  peptide_design_count: number;
  knowledge_doc_count: number;
  model_status: Record<string, unknown>;
}

function toCamelCase(raw: AISummaryStatsRaw): AISummaryStats {
  return {
    chatCount: raw.chat_count,
    generateCount: raw.generate_count,
    safetyChecks: raw.safety_checks,
    synergyCount: raw.synergy_count,
    tasteCount: raw.taste_count,
    stabilityCount: raw.stability_count,
    peptideAnalyzeCount: raw.peptide_analyze_count,
    peptideDesignCount: raw.peptide_design_count,
    knowledgeDocCount: raw.knowledge_doc_count,
    modelStatus: ((raw as unknown as { model_status?: { llm: string; status: string } })?.model_status ?? { llm: 'unknown', status: 'inactive' as const }) as { llm: string; status: 'active' | 'inactive' },
  };
}

export function useAISummaryStats() {
  const { data, isLoading, error, refetch } = useQuery<AISummaryStats, Error>({
    queryKey: STATS_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch('/api/v1/ai/stats/summary');
      if (!response.ok) {
        throw new Error(`统计加载失败: ${response.status}`);
      }
      const raw = (await response.json()) as AISummaryStatsRaw;
      return toCamelCase(raw);
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    placeholderData: {
      chatCount: 0,
      generateCount: 0,
      safetyChecks: 0,
      synergyCount: 0,
      tasteCount: 0,
      stabilityCount: 0,
      peptideAnalyzeCount: 0,
      peptideDesignCount: 0,
      knowledgeDocCount: 0,
      modelStatus: { llm: 'unknown', status: 'inactive' },
    },
  });

  return {
    stats: data,
    isLoading,
    error,
    refetch,
    chatCount: data?.chatCount ?? 0,
    generateCount: data?.generateCount ?? 0,
    safetyChecks: data?.safetyChecks ?? 0,
    synergyCount: data?.synergyCount ?? 0,
    tasteCount: data?.tasteCount ?? 0,
    stabilityCount: data?.stabilityCount ?? 0,
    peptideAnalyzeCount: data?.peptideAnalyzeCount ?? 0,
    peptideDesignCount: data?.peptideDesignCount ?? 0,
    knowledgeDocCount: data?.knowledgeDocCount ?? 0,
  };
}

export { STATS_QUERY_KEY };

