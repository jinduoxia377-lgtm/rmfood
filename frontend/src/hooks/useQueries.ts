/**
 * React Query Hooks
 * 数据获取与缓存
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { formulaApi } from '@/api/formula';
import type { FormulaListQueryParams } from '@/types/formula';
import { experimentApi, type ExperimentCreatePayload } from '@/api/experiment';
import { dashboardApi } from '@/api/dashboard';

// ── 认证 ──
export function useCurrentUser() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
    retry: false,
    staleTime: 5 * 60_000,
  });
}

// ── 配方列表 ──
export function useFormulas(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
  category_ids?: number[];
  tag_ids?: number[];
}) {
  return useQuery({
    queryKey: ['formulas', params],
    queryFn: () => formulaApi.list(params as FormulaListQueryParams | undefined),
  });
}

// ── 配方详情 ──
export function useFormula(id: number) {
  return useQuery({
    queryKey: ['formula', id],
    queryFn: () => formulaApi.get(id),
    enabled: !!id,
    throwOnError: false,
    retry: (failureCount, error: any) => {
      // Don't retry on 401 (auth errors)
      if (error?.response?.status === 401) return false
      return failureCount < 3
    },
    staleTime: 60_000,
  })
}

// ── 创建配方 ──
export function useCreateFormula() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => formulaApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['formulas'] }),
  });
}

// ── 更新配方 ──
export function useUpdateFormula(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<any>) => formulaApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['formulas'] });
      qc.invalidateQueries({ queryKey: ['formula', id] });
    },
  });
}

// ── 提交审核 ──
export function useSubmitFormula() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => formulaApi.submit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['formulas'] }),
  });
}

// ── 审核配方 ──
export function useReviewFormula() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approved, notes }: { id: number; approved: boolean; notes?: string }) =>
      formulaApi.review(id, approved, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['formulas'] }),
  });
}

// ── 配方版本历史 ──
export function useFormulaVersions(id: number) {
  return useQuery({
    queryKey: ['formula-versions', id],
    queryFn: () => formulaApi.versions(id),
    enabled: !!id,
    throwOnError: false,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401) return false
      return failureCount < 3
    },
  });
}

// ── AI 推荐 ──
export function useAIRecommendations(effects: string[], enabled = false) {
  return useQuery({
    queryKey: ['ai-recommendations', effects],
    queryFn: () => formulaApi.recommendations(effects),
    enabled,
  });
}

// ── 实验列表 ──
export function useExperiments(params?: { page?: number; page_size?: number; status?: string; search?: string }) {
  return useQuery({
    queryKey: ['experiments', params],
    queryFn: () => experimentApi.list(params),
  });
}

// ── 实验详情 ──
export function useExperiment(id: number) {
  return useQuery({
    queryKey: ['experiment', id],
    queryFn: () => experimentApi.get(id),
    enabled: !!id,
    throwOnError: false,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401) return false
      return failureCount < 3
    },
  });
}

// ── 创建实验 ──
export function useCreateExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ExperimentCreatePayload) => experimentApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['experiments'] }),
  });
}

// ── 实验统计 ──
export function useExperimentStatistics() {
  return useQuery({
    queryKey: ['experiment-statistics'],
    queryFn: experimentApi.statistics,
    staleTime: 60_000,
  });
}

// ── 仪表盘统计 ──
export function useDashboardStatistics() {
  return useQuery({
    queryKey: ['dashboard-statistics'],
    queryFn: dashboardApi.getStatistics,
    staleTime: 60_000,
  });
}

export function useDashboardTrends(period: '7d' | '30d' | '90d' = '30d') {
  return useQuery({
    queryKey: ['dashboard-trends', period],
    queryFn: () => dashboardApi.getTrends(period),
    staleTime: 60_000,
  });
}
