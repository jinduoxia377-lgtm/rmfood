/**
 * useAISummaryStats — AI 页面统计卡片数据获取
 *
 * 从后端获取实时统计数据，替代硬编码数字。
 * 支持 loading/success/error 三态。
 * 后端未实现时自动降级为 placeholderData。
 */
import { useQuery } from '@tanstack/react-query';
import type { AISummaryStats } from '@/types/ai.api';

const STATS_QUERY_KEY = ['ai-summary-stats'] as const;

export function useAISummaryStats() {
  const { data, isLoading, error, refetch } = useQuery<AISummaryStats, Error>({
    queryKey: STATS_QUERY_KEY,
    queryFn: async () => {
      const response = await fetch('/api/ai/stats/summary');
      if (!response.ok) {
        throw new Error(`统计加载失败: ${response.status}`);
      }
      return response.json() as Promise<AISummaryStats>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
    // 降级：后端未实现时使用 placeholder（真实计数未知时以 0 显示，避免误导性假数字）
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
