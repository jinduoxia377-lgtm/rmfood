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
  Trash2,
  FileText,
  FileSpreadsheet,
  File,
  Loader2,
  RefreshCw,
  Search,
  Eye,
  ChevronDown,
  ChevronUp,
  Network,
} from 'lucide-react';
import {
  listDocuments,
  deleteDocument,
  getRAGStats,
  searchChunks,
  type RAGStats,
  type SearchChunkResult,
} from '@/api/rag';
import { databaseApi } from '@/api/database';
import { DocumentUploader } from './DocumentUploader';
import { TerminologyLookup } from './TerminologyLookup';
import { Card, Button } from '@/components/ui';
import { KnowledgeGraph } from '../features/components/KnowledgeGraph';
import { clsx } from 'clsx';
import type { GraphNode, GraphLink } from '../features/components/KnowledgeGraph';

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

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="w-4 h-4 text-error-500" />,
  txt: <FileText className="w-4 h-4 text-secondary-500" />,
  csv: <FileSpreadsheet className="w-4 h-4 text-success-500" />,
  md: <FileText className="w-4 h-4 text-accent-500" />,
};

function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || <File className="w-4 h-4 text-[var(--text-muted)]" />;
}

/* ─── 质量指标 ─── */
function QualityMetrics({ stats, docCount }: { stats: RAGStats; docCount: number }) {
  const { t } = useTranslation();
  const coveragePercent = Math.min((stats.total_chunks / TARGET_CHUNK_COUNT) * 100, 100);
  const lastIndexed = stats.last_updated ? new Date(stats.last_updated).toLocaleDateString('zh-CN') : '从未';

  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Eye className="w-4 h-4 text-primary-500" />
        质量指标
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-base font-bold text-primary-700 dark:text-primary-700">
            {stats.total_docs ?? docCount}
          </div>
          <div className="text-xs text-[var(--text-muted)]">{t('ai.knowledge.docCount')}</div>
        </div>
        <div>
          <div className="text-base font-bold text-secondary-600 dark:text-secondary-700">{stats.total_chunks}</div>
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
            展开 <ChevronDown className="w-3 h-3" />
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
          收起 <ChevronUp className="w-3 h-3" />
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
                  <span className="font-semibold text-primary-700 dark:text-primary-700">
                    相似度: {(r.similarity * 100).toFixed(1)}%
                  </span>
                  <span className="text-[var(--text-muted)]">{r.doc_filename}</span>
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

/* ─── {t('ai.knowledge.knowledgeGraph')}视图 ─── */
function KnowledgeGraphView() {
  const { t } = useTranslation()
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [centerNode, setCenterNode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleLoadGraph = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const center = centerNode.trim() || '黄芪'
      const data = await databaseApi.findSubgraph(center, 2)
      const nodes: GraphNode[] = (data.nodes || []).map((n: any) => ({
        id: n.id ?? n.node_id ?? String(n.node_label),
        label: n.node_label ?? n.label ?? n.id,
        category: n.node_type ?? n.group ?? 'herb',
        value: n.importance ?? 10,
        description: n.description ?? '',
        metadata: n.metadata ?? {},
      }))
      const links: GraphLink[] = (data.edges || []).map((e: any) => ({
        source: e.source ?? e.from,
        target: e.target ?? e.to,
        label: e.relation ?? e.type ?? '',
        type: e.relation_type ?? 'related',
        value: e.strength ?? 1,
      }))
      setGraphData({ nodes, links })
    } catch (err) {
      setError((err as Error).message || t('ai.knowledge.loadGraphFailed'))
    } finally {
      setLoading(false)
    }
  }, [centerNode, t])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          value={centerNode}
          onChange={(e) => setCenterNode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLoadGraph()}
          placeholder={t('ai.knowledge.nodePlaceholder')}
          className="flex-1 px-3 py-1.5 text-sm border border-[var(--border-color)] rounded-lg bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <Button onClick={handleLoadGraph} disabled={loading || !centerNode.trim()} size="sm">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('ai.knowledge.loadGraph')}
        </Button>
      </div>
      {error && <p className="text-xs text-error-500">{error}</p>}
      {graphData && (
        <div className="rounded-xl border border-[var(--border-color)] overflow-hidden" style={{ height: 520 }}>
          <KnowledgeGraph nodes={graphData.nodes} links={graphData.links} />
        </div>
      )}
      {!graphData && !loading && !error && (
        <div className="text-center py-12 text-sm text-[var(--text-muted)]">
          {t('ai.knowledge.graphHint')}
        </div>
      )}
    </div>
  )
}

export function KnowledgeBasePanel({ isEmbedded = false }: KnowledgeBasePanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient();
  const [deletingFile, setDeletingFile] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['rag-stats'],
    queryFn: getRAGStats,
    refetchInterval: STATS_REFETCH_INTERVAL_MS,
  });

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['rag-documents'],
    queryFn: listDocuments,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rag-documents'] });
      queryClient.invalidateQueries({ queryKey: ['rag-stats'] });
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
  }, [queryClient]);

  const docs = documents || [];
  const isLoading = statsLoading || docsLoading;

  return (
    <div className={clsx('space-y-4', isEmbedded ? '' : 'p-4')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary-700 dark:text-primary-700" />
          <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)] dark:text-white">{t('ai.knowledge.title')}</h2>
          {stats && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-700 rounded-full">
              {stats.total_chunks} 个文档块
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
        <KnowledgeGraphView />
      ) : (
        <>
          {/* Upload */}
          <DocumentUploader onUploadSuccess={handleUploadSuccess} />

          {/* Quality Metrics */}
          {stats && <QualityMetrics stats={stats} docCount={docs.length} />}

          {/* Search Tester */}
          <SearchTester />

          {/* Terminology Lookup（本地术语词典 terminology-dict.json） */}
          <TerminologyLookup />

          {/* Document list */}
      <div className="space-y-1">
        <h3 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {t('ai.knowledge.importedDocs', { count: docs.length })}
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[var(--text-muted)] animate-spin" />
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--text-muted)]">
            暂无文档，请上传 PDF、TXT、CSV 或 Markdown 文件
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {docs.map((doc) => (
              <div key={doc.filename} className="flex items-center justify-between py-2.5 group">
                <div className="flex items-center gap-2 min-w-0">
                  {getFileIcon(doc.filename)}
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--text-secondary)] truncate">{doc.filename}</div>
                    <div className="text-xs text-[var(--text-muted)]">{t('ai.knowledge.chunksCount', { count: doc.chunks })}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.filename)}
                  disabled={deletingFile === doc.filename}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-error-50 dark:hover:bg-error-950/30 transition-all"
                  title={t('ai.knowledge.deleteDoc', { filename: doc.filename })}
                >
                  {deletingFile === doc.filename ? (
                    <Loader2 className="w-3.5 h-3.5 text-error-500 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 text-error-400 hover:text-error-600" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
        </div>
        </>
      )}
    </div>
  );
}
