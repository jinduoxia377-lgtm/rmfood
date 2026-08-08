/**
 * RMFOOD 肽分析前端优化工具集
 *
 * 包含:
 * 1. usePeptideAnalysis - 统一状态管理 (替代17个useState)
 * 2. useRequestDeduplication - 请求去重 (防止重复提交)
 * 3. useCachedQuery - 查询结果缓存
 * 4. ErrorBoundary - 错误边界组件
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { peptideAnalysisApi, type PeptideAnalysisData } from '@/api/ai';
import { logger } from '@/utils/safeLogger';

// ════════════════════════════════════════════
// 1. 统一状态管理 Hook
// ════════════════════════════════════════════

interface AnalysisState {
  sequence: string;
  result: any | null;
  error: string | null;
  loading: boolean;

  // 数据库集成
  currentAnalysisId: number | null;
  saving: boolean;
  showHistoryPanel: boolean;
  historyList: PeptideAnalysisData[];
  historyLoading: boolean;
  historyPage: number;
  historyTotal: number;

  // 编辑模式
  editingNotes: string;
  editingTags: string;
  isEditing: boolean;

  // 删除确认
  showDeleteConfirm: boolean;
  deleteLoading: boolean;

  // 展开状态
  expandedSections: Record<string, boolean>;
}

interface AnalysisActions {
  setSequence: (seq: string) => void;
  analyze: () => Promise<void>;
  saveAnalysis: () => Promise<void>;
  loadFromHistory: (id: number) => Promise<void>;
  updateMetadata: () => Promise<void>;
  deleteAnalysis: () => Promise<void>;
  toggleSection: (section: string) => void;
  toggleHistory: () => void;
  startEditing: () => void;
  cancelEditing: () => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
  reset: () => void;
}

export function usePeptideAnalysis(initialSequence = ''): [AnalysisState, AnalysisActions] {
  const [state, setState] = useState<AnalysisState>({
    sequence: initialSequence,
    result: null,
    error: null,
    loading: false,

    currentAnalysisId: null,
    saving: false,
    showHistoryPanel: false,
    historyList: [],
    historyLoading: false,
    historyPage: 1,
    historyTotal: 0,

    editingNotes: '',
    editingTags: '',
    isEditing: false,

    showDeleteConfirm: false,
    deleteLoading: false,

    expandedSections: {
      basic: true,
      structure: true,
      bioactivity: true,
      safety: true,
    },
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetState = useCallback(
    (updates: Partial<AnalysisState> | ((prev: AnalysisState) => Partial<AnalysisState>)) => {
      if (isMountedRef.current) {
        if (typeof updates === 'function') {
          setState((prev) => ({ ...prev, ...updates(prev) }));
        } else {
          setState((prev) => ({ ...prev, ...updates }));
        }
      }
    },
    [],
  );

  const loadHistory = useCallback(
    async (page = 1) => {
      safeSetState({ historyLoading: true });
      try {
        const response = await peptideAnalysisApi.listAnalyses({ page, page_size: 20 });
        safeSetState({
          historyList: response.items,
          historyTotal: response.total,
          historyPage: page,
        });
      } catch (err) {
        logger.error('加载历史失败:', err);
      } finally {
        safeSetState({ historyLoading: false });
      }
    },
    [safeSetState],
  );

  useEffect(() => {
    loadHistory(1);
  }, [loadHistory]);

  const analyze = useCallback(async () => {
    if (!state.sequence || state.sequence.length < 2) {
      safeSetState({ error: '请输入有效的肽序列（至少2个氨基酸）' });
      return;
    }

    safeSetState({ loading: true, error: null, result: null });

    try {
      const response = await fetch('/api/v1/ai/peptide/advanced/analyze/deep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
        body: JSON.stringify({ sequence: state.sequence }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `分析失败 (${response.status})`;

        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = `${errorMessage}: ${errorText.slice(0, 200)}`;
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        safeSetState({ result: data.data });
      } else {
        safeSetState({ error: data.detail || '分析失败：服务器返回异常' });
      }
    } catch (err: any) {
      logger.error('深度分析失败:', err);
      safeSetState({ error: err.message || '网络错误，请检查连接后重试' });
    } finally {
      safeSetState({ loading: false });
    }
  }, [state.sequence, safeSetState]);

  const saveAnalysis = useCallback(async () => {
    if (!state.result || !state.sequence) return;

    safeSetState({ saving: true });
    try {
      const response = await peptideAnalysisApi.createAnalysis({
        sequence: state.sequence,
        analysis_mode: 'deep',
        tags: [],
        notes: '',
      });

      safeSetState({ currentAnalysisId: response.data.id });
      alert(`✅ 分析已保存！ID: ${response.data.id}`);
      await loadHistory(1);
    } catch (err: any) {
      logger.error('保存失败:', err);
      alert('❌ 保存失败: ' + (err.message || '未知错误'));
    } finally {
      safeSetState({ saving: false });
    }
  }, [state.result, state.sequence, safeSetState, loadHistory]);

  const loadFromHistory = useCallback(
    async (id: number) => {
      try {
        const analysis = await peptideAnalysisApi.getAnalysis(id);

        safeSetState({
          sequence: analysis.sequence,
          currentAnalysisId: analysis.id,
          editingNotes: analysis.notes || '',
          editingTags: (analysis.tags || []).join(', '),
          showHistoryPanel: false,
        });

        if (analysis.details && analysis.details.length > 0) {
          const reconstructedResult = {
            sequence: analysis.sequence,
            details: analysis.details,
            basic_properties: analysis.details.find((d) => d.dimension_type === 'basic')?.data || {},
            secondary_structure: analysis.details.find((d) => d.dimension_type === 'structure')?.data || {},
            bioactivity_predictions: analysis.details.find((d) => d.dimension_type === 'bioactivity')?.data || {},
            safety_assessment: analysis.details.find((d) => d.dimension_type === 'safety')?.data || {},
            overall_scores: analysis.details.find((d) => d.dimension_type === 'overall')?.data || {},
          };
          safeSetState({ result: reconstructedResult });
        }
      } catch (err: any) {
        logger.error('加载失败:', err);
        alert('❌ 加载失败: ' + (err.message || '未知错误'));
      }
    },
    [safeSetState],
  );

  const updateMetadata = useCallback(async () => {
    if (!state.currentAnalysisId) return;

    try {
      await peptideAnalysisApi.updateAnalysis(state.currentAnalysisId, {
        tags: state.editingTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        notes: state.editingNotes,
      });

      safeSetState({ isEditing: false });
      alert('✅ 已更新');
      await loadHistory(state.historyPage);
    } catch (err: any) {
      logger.error('更新失败:', err);
      alert('❌ 更新失败');
    }
  }, [state.currentAnalysisId, state.editingTags, state.editingNotes, state.historyPage, safeSetState, loadHistory]);

  const deleteAnalysis = useCallback(async () => {
    if (!state.currentAnalysisId) return;

    safeSetState({ deleteLoading: true });
    try {
      await peptideAnalysisApi.deleteAnalysis(state.currentAnalysisId);

      safeSetState({
        currentAnalysisId: null,
        result: null,
        sequence: '',
        showDeleteConfirm: false,
      });

      alert('✅ 已删除');
      await loadHistory(state.historyPage);
    } catch (err: any) {
      logger.error('删除失败:', err);
      alert('❌ 删除失败');
    } finally {
      safeSetState({ deleteLoading: false });
    }
  }, [state.currentAnalysisId, safeSetState, loadHistory, state.historyPage]);

  const actions: AnalysisActions = {
    setSequence: (seq) => safeSetState({ sequence: seq.toUpperCase() }),
    analyze,
    saveAnalysis,
    loadFromHistory,
    updateMetadata,
    deleteAnalysis,
    toggleSection: (section) =>
      safeSetState((prev) => ({
        expandedSections: { ...prev.expandedSections, [section]: !prev.expandedSections[section] },
      })),
    toggleHistory: () => safeSetState((prev) => ({ showHistoryPanel: !prev.showHistoryPanel })),
    startEditing: () => safeSetState({ isEditing: true }),
    cancelEditing: () => safeSetState({ isEditing: false }),
    confirmDelete: () => safeSetState({ showDeleteConfirm: true }),
    cancelDelete: () => safeSetState({ showDeleteConfirm: false }),
    reset: () =>
      safeSetState({
        sequence: '',
        result: null,
        error: null,
        currentAnalysisId: null,
        showDeleteConfirm: false,
        isEditing: false,
      }),
  };

  return [state, actions];
}

// ════════════════════════════════════════════
// 2. 请求去重 Hook
// ════════════════════════════════════════════

export function useRequestDeduplication<T>(
  requestFn: (...args: any[]) => Promise<T>,
  options: {
    deduplicationInterval?: number;
    onError?: (error: Error) => void;
  } = {},
): [(...args: any[]) => Promise<T | null>, { loading: boolean }] {
  const { deduplicationInterval = 1000, onError } = options;
  const [loading, setLoading] = useState(false);
  const lastRequestTime = useRef(0);
  const currentRequestRef = useRef<Promise<T> | null>(null);

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      const now = Date.now();

      if (now - lastRequestTime.current < deduplicationInterval && currentRequestRef.current) {
        return currentRequestRef.current;
      }

      setLoading(true);
      lastRequestTime.current = now;

      try {
        currentRequestRef.current = requestFn(...args);
        const result = await currentRequestRef.current;
        return result;
      } catch (error) {
        onError?.(error as Error);
        return null;
      } finally {
        setLoading(false);
        currentRequestRef.current = null;
      }
    },
    [requestFn, deduplicationInterval, onError],
  );

  return [execute, { loading }];
}

// ════════════════════════════════════════════
// 3. 简单内存缓存 Hook
// ════════════════════════════════════════════

const cacheStore = new Map<string, { data: any; timestamp: number; ttl: number }>();

export function useCachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: {
    ttl?: number;
    enabled?: boolean;
  } = {},
): { data: T | null; loading: boolean; error: Error | null; refetch: () => Promise<void> } {
  const { ttl = 5 * 60 * 1000, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    if (!enabled) return;

    // 检查缓存
    const cached = cacheStore.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      setData(cached.data);
      return;
    }

    setLoading(true);
    try {
      const result = await queryFn();
      setData(result);
      cacheStore.set(key, { data: result, timestamp: Date.now(), ttl });
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [key, queryFn, enabled, ttl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async (): Promise<void> => {
    cacheStore.delete(key);
    await fetchData();
  }, [key, fetchData]);

  return { data, loading, error, refetch };
}

// ════════════════════════════════════════════
// 4. 错误边界组件
// ════════════════════════════════════════════

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('ErrorBoundary caught:', error.message, errorInfo.componentStack || '');
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-6 bg-error-50 dark:bg-error-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-error-100 dark:bg-error-800 rounded-full">
              <svg className="w-6 h-6 text-error-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-error-800 dark:text-error-200">组件出错</h3>
              <p className="text-sm text-error-600 dark:text-error-300 mt-1">
                {this.state.error?.message || '发生了未知错误'}
              </p>
            </div>
          </div>

          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-error-600 text-white rounded-lg hover:bg-error-700 transition-colors"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
