/**
 * KnowledgeBasePanel - RAG 知识库管理面板
 *
 * 展示知识库中{t('ai.knowledge.docList')}、统计信息，支持上传、删除、{t('ai.knowledge.retrievalTest')}和质量指标。
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Database,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Eye,
  ChevronDown,
  ChevronUp,
  Network,
  BookOpen,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  listDocumentsWithSummary,
  deleteDocument,
  getRAGStats,
  searchChunks,
  type RAGStats,
  type RAGDocumentsSummary,
  type SearchChunkResult,
} from '@/api/rag';
import { useRAGContext } from '@/hooks/useRAGContext';
import { logger } from '@/utils/safeLogger';
import { DocumentUploader } from './DocumentUploader';
import { TerminologyLookup } from './TerminologyLookup';
import { DocumentListView } from './DocumentListView';
import { KnowledgeGraphPanel } from './KnowledgeGraphPanel';
import { getRelevanceLabel, getRankBadge } from './relevance';
import { getSourceDisplayName } from './sourceDisplay';
import { Card, Button } from '@/components/ui';
import { AncientBooksPanel } from './AncientBooksPanel';
import { clsx } from 'clsx';

// ═══════════════════════════════════════════
// 命名常量（替换魔法数字）
// ═══════════════════════════════════════════

/** 索引覆盖率目标知识块数 */
const TARGET_CHUNK_COUNT = 10000;
/** 质量指标面板刷新间隔（毫秒） */
const STATS_REFETCH_INTERVAL_MS = 30000;

interface KnowledgeBasePanelProps {
  isEmbedded?: boolean;
}

type TFunc = ReturnType<typeof useTranslation>['t'];

/**
 * P2-5: 把种子注入失败原因码映射为 i18n 文案（seedError 为 null 时回退未知错误）。
 * 原因码由 useRAGContext.toSeedErrorCode 产生（embedding_unavailable / network / server / unknown）。
 */
function seedErrorReasonText(code: string | null, t: TFunc): string {
  switch (code) {
    case 'embedding_unavailable': return t('ai.knowledge.seedErrorEmbedding');
    case 'network': return t('ai.knowledge.seedErrorNetwork');
    case 'server': return t('ai.knowledge.seedErrorServer');
    case 'unknown':
    default:
      return t('ai.knowledge.seedErrorUnknown');
  }
}

/* ─── 种子初始化卡片（P1-4 合并：吸收原 RAGKnowledgePanel 的种子注入能力，成为唯一知识库入口） ─── */
function SeedInitCard({ docCount }: { docCount: number }) {
  const { t } = useTranslation();
  const rag = useRAGContext();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleSeed = useCallback(async () => {
    setError(null);
    setProgress(0);
    try {
      // 通过共享 useRAGContext.triggerSeed() 同步全局状态（唯一的 RAGContextProvider）
      const success = await rag.triggerSeed();
      setProgress(success ? 100 : 0);
      if (!success) {
        // P2-5: 种子注入失败（Embedding 不可用等）——读取共享 Context 的原因码显示，
        // 此前 triggerSeed 吞异常返回 false 且面板无任何提示（静默失败）。
        setError(t('ai.knowledge.seedFailed', { reason: seedErrorReasonText(rag.seedError, t) }));
      }
    } catch (e) {
      logger.error('[KnowledgeBasePanel] 种子注入失败:', e);
      setError(t('ai.knowledge.seedFailed', { reason: seedErrorReasonText(rag.seedError, t) }));
    }
  }, [rag.triggerSeed, rag.seedError, t]);

  const chunksText = t('ai.knowledge.statsSummary', {
    chunks: rag.totalChunks.toLocaleString(),
    docs: docCount,
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        {rag.isSeeded ? (
          <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 text-warning-500 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)] dark:text-white">
            {rag.isSeeded ? t('ai.knowledge.ready') : t('ai.knowledge.notInitialized')}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {rag.isSeeded ? chunksText : t('ai.knowledge.seedHint')}
          </p>
        </div>
        <Button
          onClick={handleSeed}
          disabled={rag.isSeeding || rag.isSeeded}
          size="sm"
          className="flex items-center gap-1.5"
        >
          {rag.isSeeding ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {progress > 0 ? `${progress}%` : t('ai.knowledge.initializing')}
            </>
          ) : rag.isSeeded ? (
            <>
              <CheckCircle className="w-3.5 h-3.5" />
              {t('ai.knowledge.readyShort')}
            </>
          ) : (
            <>
              <Database className="w-3.5 h-3.5" />
              {t('ai.knowledge.initialize')}
            </>
          )}
        </Button>
      </div>
      {rag.isSeeding && progress > 0 && (
        <div className="h-1.5 bg-warning-200 dark:bg-warning-300/25 rounded-full overflow-hidden">
          <div className="h-full bg-success-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-error-50 dark:bg-error-300/15 border border-error-200 dark:border-error-900/30 rounded-lg text-xs text-error-600 dark:text-error-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="flex-shrink-0" aria-label={t('ai.knowledge.close')}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </Card>
  );
}

/* ─── 质量指标 ─── */
function QualityMetrics({ stats, docCount }: { stats: RAGStats; docCount: number }) {
  const { t } = useTranslation();
  // P1-3/P1-4: 知识块总数/是否就绪从共享 Context 读取（唯一 RAGContextProvider），
  // 不再各显示各的；react-query 的 stats.total_chunks 仅作兜底（Context 未同步时）。
  const { totalChunks } = useRAGContext();
  const effectiveChunks = totalChunks > 0 ? totalChunks : (stats.total_chunks ?? 0);
  const coveragePercent = Math.min((effectiveChunks / TARGET_CHUNK_COUNT) * 100, 100);
  const lastIndexed = stats.last_updated ? new Date(stats.last_updated).toLocaleDateString('zh-CN') : t('ai.knowledge.neverIndexed');

  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Eye className="w-4 h-4 text-primary-500" />
        {t('ai.knowledge.qualityMetrics')}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-base font-bold text-primary-700 dark:text-primary-700">
            {stats.total_docs ?? docCount}
          </div>
          <div className="text-xs text-[var(--text-muted)]">{t('ai.knowledge.docCount')}</div>
        </div>
        <div>
          <div className="text-base font-bold text-secondary-600 dark:text-secondary-700">{effectiveChunks}</div>
          <div className="text-xs text-[var(--text-muted)]">{t('ai.knowledge.chunkCount')}</div>
        </div>
        <div>
          <div className="text-base font-bold text-accent-600 dark:text-accent-700">{stats.embedding_dim || 768}</div>
          <div className="text-xs text-[var(--text-muted)]">{t('ai.knowledge.dimensions')}</div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-[var(--text-muted)]">
          <span>{t('ai.knowledge.indexCoverage')}</span>
          <span>{coveragePercent.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--border-color)] overflow-hidden">
          <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${coveragePercent}%` }} />
        </div>
        <div className="text-xs text-[var(--text-muted)]">{t('ai.knowledge.lastIndexed', { time: lastIndexed })}</div>
      </div>
    </Card>
  );
}

/* ─── {t('ai.knowledge.retrievalTest')} ─── */
function SearchTester() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [results, setResults] = useState<SearchChunkResult[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  const handleTest = useCallback(async () => {
    if (!query.trim()) return;
    setIsTesting(true);
    try {
      const data = await searchChunks(query, 5);
      setResults(data);
      setExpanded(true);
    } catch {
      setResults([]);
    } finally {
      setIsTesting(false);
    }
  }, [query]);

  if (!expanded) {
    return (
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Search className="w-4 h-4 text-secondary-500" />
            {t('ai.knowledge.retrievalTest')}
          </h3>
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1"
          >
            {t('ai.knowledge.expand')} <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            placeholder={t('ai.knowledge.testPlaceholder')}
            className="flex-1 px-3 py-2 text-sm border border-[var(--border-color)] rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <Button onClick={handleTest} disabled={isTesting || !query.trim()} className="px-4">
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('ai.knowledge.test')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Search className="w-4 h-4 text-secondary-500" />
          {t('ai.knowledge.retrievalTest')}
        </h3>
        <button
          onClick={() => setExpanded(false)}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1"
        >
          {t('ai.knowledge.collapseDetails')} <ChevronUp className="w-3 h-3" />
        </button>
      </div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleTest()}
          placeholder={t('ai.knowledge.testPlaceholder')}
          className="flex-1 px-3 py-2 text-sm border border-[var(--border-color)] rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <Button onClick={handleTest} disabled={isTesting || !query.trim()} className="px-4">
          {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('ai.knowledge.test')}
        </Button>
      </div>
      {results !== null && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <div className="text-center py-4 text-sm text-[var(--text-muted)]">{t('ai.knowledge.noMatch')}</div>
          ) : (
            results.map((r, i) => (
              <div key={i} className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/50 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  {/* P1-9：similarity 实为 RRF 融合分，不再渲染为百分比；改为排序徽标 + 相对强弱 */}
                  <span className="flex items-center gap-1.5 font-semibold text-primary-700 dark:text-primary-700">
                    <span className="px-1 py-0.5 text-[10px] font-semibold leading-none bg-primary-100 dark:bg-primary-300/20 text-primary-700 dark:text-primary-700 rounded">
                      {getRankBadge(i)}
                    </span>
                    {getRelevanceLabel(i, t)}
                  </span>
                  <span className="text-[var(--text-muted)]">{getSourceDisplayName(r.doc_filename, r.display_name)}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{r.content}</p>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}

export function KnowledgeBasePanel({ isEmbedded = false }: KnowledgeBasePanelProps) {
  const { t } = useTranslation()
  // P1-3/P1-4: 接入共享 useRAGContext —— 知识库「是否已就绪/总块数」这一顶层状态
  // 与 chat tab 的 TopBar 统一从同一 Provider 读取，不再各显示各的。
  const rag = useRAGContext()
  const queryClient = useQueryClient();
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'graph' | 'books'>('list');

  const { data: stats } = useQuery({
    queryKey: ['rag-stats'],
    queryFn: getRAGStats,
    refetchInterval: STATS_REFETCH_INTERVAL_MS,
  });

  // 文档列表：返回全量字段（display_name/category/dynasty/author/is_protected）+ 顶层 summary
  // 不传 page_size → 后端 page_size=0 返回全部，供 DocumentListView 客户端过滤/排序/分页
  const {
    data: documentsResponse,
    isLoading: docsLoading,
    error: docsErrorObj,
    refetch: refetchDocuments,
  } = useQuery({
    queryKey: ['rag-documents'],
    queryFn: () => listDocumentsWithSummary(),
  });
  const documentsError = docsErrorObj
    ? ((docsErrorObj as Error)?.message ?? t('ai.knowledge.docLoadError'))
    : null;

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rag-documents'] });
      queryClient.invalidateQueries({ queryKey: ['rag-stats'] });
      // P1-3/P1-4: 删除后刷新共享 Context（isSeeded/totalChunks），
      // 使 TopBar 与本面板保持同步。
      void rag.refreshSeedStatus();
      // P2-1: 删除文档后清空聊天区残留的 rag.chunks，
      // 避免「知识库参考」横幅仍引用已删除文档的来源。
      rag.clearChunks();
    },
  });

  const handleDelete = useCallback(
    async (filename: string) => {
      setDeletingFile(filename);
      try {
        await deleteMutation.mutateAsync(filename);
      } finally {
        setDeletingFile(null);
      }
    },
    [deleteMutation],
  );

  const handleUploadSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['rag-documents'] });
    queryClient.invalidateQueries({ queryKey: ['rag-stats'] });
    // P1-3/P1-4: 上传后刷新共享 Context，使 TopBar 与本面板同步。
    void rag.refreshSeedStatus();
  }, [queryClient, rag.refreshSeedStatus]);

  const docs = documentsResponse?.documents ?? [];
  const summary = documentsResponse?.summary;

  return (
    <div className={clsx('space-y-4', isEmbedded ? '' : 'p-4')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary-700 dark:text-primary-700" />
          <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)] dark:text-white">{t('ai.knowledge.title')}</h2>
          {rag.isSeeded && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-success-50 dark:bg-success-950/40 text-success-700 dark:text-success-700 rounded-full">
              {t('ai.knowledge.readyShort')}
            </span>
          )}
          {rag.totalChunks > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-700 rounded-full">
              {t('ai.knowledge.chunksCount', { count: rag.totalChunks })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-normal transition-all ${
              viewMode === 'list'
                ? 'bg-white dark:bg-neutral-700 shadow-sm text-[var(--text-primary)] dark:text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-secondary)]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            {t('ai.knowledge.docList')}
          </button>
          <button
            onClick={() => setViewMode('graph')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-normal transition-all ${
              viewMode === 'graph'
                ? 'bg-white dark:bg-neutral-700 shadow-sm text-[var(--text-primary)] dark:text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-secondary)]'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            {t('ai.knowledge.knowledgeGraph')}
          </button>
          <button
            onClick={() => setViewMode('books')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-normal transition-all ${
              viewMode === 'books'
                ? 'bg-white dark:bg-neutral-700 shadow-sm text-[var(--text-primary)] dark:text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] dark:hover:text-[var(--text-secondary)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            {t('ai.knowledge.ancientBooks')}
          </button>
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['rag-stats'] })}
          className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title={t('ai.knowledge.refresh')}
        >
          <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
        </button>
      </div>

      {viewMode === 'graph' ? (
        <KnowledgeGraphPanel />
      ) : viewMode === 'books' ? (
        <AncientBooksPanel />
      ) : (
        <>
          {/* 种子初始化（P1-4 合并：统一知识库入口，吸收原 RAGKnowledgePanel 的种子注入能力） */}
          <SeedInitCard docCount={docs.length} />

          {/* Upload */}
          <DocumentUploader onUploadSuccess={handleUploadSuccess} />

          {/* Quality Metrics */}
          {stats && <QualityMetrics stats={stats} docCount={docs.length} />}

          {/* Search Tester */}
          <SearchTester />

          {/* Terminology Lookup（本地术语词典 terminology-dict.json） */}
          <TerminologyLookup />

          {/* Document list（专业文档管理视图：分类/搜索/排序/版本历史/分页） */}
          <DocumentListView
            documents={docs}
            summary={summary as RAGDocumentsSummary | undefined}
            isLoading={docsLoading}
            error={documentsError}
            onRetry={() => void refetchDocuments()}
            onDelete={handleDelete}
            deletingFile={deletingFile}
          />
        </>
      )}
    </div>
  );
}
