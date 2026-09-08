/**
 * RAG 知识库管理面板
 *
 *展示知识库状态、文档列表、统计信息，
 *支持一键初始化种子数据和上传自定义文档。
 */
import React, { useState, useEffect, useCallback } from 'react'
import {
  Database, Plus, Trash2, RefreshCw, CheckCircle, AlertCircle,
  FileText, ChevronDown, ChevronUp, X, Upload, Search, Loader2,
} from 'lucide-react'
import {
  getSeedStatus, seedKnowledgeBase, listDocuments, deleteDocument,
  uploadDocument, getRAGStats, type RAGStats,
} from '@/api/rag'
import { Card } from '@/components/ui'
import { logger } from '@/utils/safeLogger'

interface KBPanelProps {
  onClose: () => void
  onSeedComplete?: (chunks: number, files: string[]) => void
}

interface KBDoc {
  filename: string
  chunks: number
  created_at: string
}

export function RAGKnowledgePanel({ onClose, onSeedComplete }: KBPanelProps) {
  const [isSeeded, setIsSeeded] = useState(false)
  const [totalChunks, setTotalChunks] = useState(0)
  const [isSeeding, setIsSeeding] = useState(false)
  const [seedingProgress, setSeedingProgress] = useState(0)
  const [docs, setDocs] = useState<KBDoc[]>([])
  const [stats, setStats] = useState<RAGStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true)
      const [status, docList, ragStats] = await Promise.all([
        getSeedStatus(),
        listDocuments().catch(() => []),
        getRAGStats().catch(() => null),
      ])
      setIsSeeded(status.is_seeded)
      setTotalChunks(status.total_chunks ?? 0)
      setStats(ragStats)
      setError(null)
    } catch (e) {
      logger.warn('[RAGKnowledgePanel] 加载状态失败:', e)
      setError('无法连接知识库服务')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const handleSeed = async () => {
    setIsSeeding(true)
    setSeedingProgress(0)
    try {
      const result = await seedKnowledgeBase()
      setIsSeeded(result.seeded || totalChunks > 0)
      setTotalChunks(result.total_chunks ?? totalChunks)
      setSeedingProgress(100)
      // 从 documents 字段获取文件名列表
      const files = (result as unknown as { files?: string[] }).files || []
      if (files.length || result.seeded) {
        onSeedComplete?.(result.total_chunks, files)
      }
      await loadStatus()
    } catch (e) {
      logger.error('[RAGKnowledgePanel] 种子注入失败:', e)
      setError('种子注入失败，请检查后端日志')
    } finally {
      setIsSeeding(false)
    }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setUploadProgress(0)
    try {
      const info = await uploadDocument(file, (p) => setUploadProgress(p))
      setDocs(prev => [...prev, {
        filename: info.filename,
        chunks: info.chunk_count,
        created_at: info.created_at,
      }])
      setTotalChunks(prev => prev + info.chunk_count)
      setIsSeeded(true)
      setUploadProgress(100)
    } catch (e) {
      logger.error('[RAGKnowledgePanel] 上传失败:', e)
      setError('文档上传失败')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (filename: string) => {
    try {
      await deleteDocument(filename)
      setDocs(prev => prev.filter(d => d.filename !== filename))
      await loadStatus()
    } catch (e) {
      logger.error('[RAGKnowledgePanel] 删除失败:', e)
    }
  }

  const toggleDocExpand = (filename: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }

  const filteredDocs = docs.filter(d =>
    d.filename.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSeeded ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-neutral-100 dark:bg-neutral-800'}`}>
              <Database className={`w-4 h-4 ${isSeeded ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-500'}`} />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-neutral-900 dark:text-white">知识库管理</h2>
              <p className="text-[10px] text-neutral-400">RAG 向量检索 · 药食同源知识引擎</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <X className="w-4 h-4 text-neutral-400" />
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* 状态卡片 */}
          <div className={`rounded-xl border p-4 ${
            isSeeded
              ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30'
              : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
          }`}>
            <div className="flex items-center gap-3">
              {isSeeded ? (
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              ) : isLoading ? (
                <RefreshCw className="w-5 h-5 text-neutral-400 animate-spin flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm {isSeeded ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}">
                  {isLoading ? '加载中…' : isSeeded ? '知识库已就绪' : '知识库未初始化'}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {isSeeded
                    ? `共 ${totalChunks.toLocaleString()} 个知识片段，{stats?.document_count ?? '?'} 篇文档`
                    : '内置药材库、药食同源目录、食品安全法规尚未注入'}
                </p>
              </div>
              <button
                onClick={handleSeed}
                disabled={isSeeding || isSeeded}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isSeeded
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 cursor-default'
                    : isSeeding
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 cursor-wait'
                      : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 shadow-sm'
                }`}
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {seedingProgress > 0 ? `${seedingProgress}%` : '初始化中…'}
                  </>
                ) : isSeeded ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    已就绪
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    初始化
                  </>
                )}
              </button>
            </div>

            {/* 进度条 */}
            {isSeeding && seedingProgress > 0 && (
              <div className="mt-3 h-1.5 bg-amber-200 dark:bg-amber-900/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${seedingProgress}%` }}
                />
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)} className="flex-shrink-0"><X className="w-3 h-3" /></button>
            </div>
          )}

          {/* 操作栏 */}
          <div className="flex items-center gap-2">
            {/* 搜索 */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索文档…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 placeholder:text-neutral-400"
              />
            </div>
            {/* 刷新 */}
            <button onClick={loadStatus} className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors" title="刷新">
              <RefreshCw className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          </div>

          {/* 文档列表 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                文档列表 ({filteredDocs.length})
              </span>
              {/* 上传按钮 */}
              <label className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 transition-colors cursor-pointer">
                <Upload className="w-3 h-3" />
                上传文档
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.csv,.html"
                  className="hidden"
                  disabled={uploading}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>

            {filteredDocs.length === 0 && !isLoading ? (
              <div className="text-center py-8 text-xs text-neutral-400 dark:text-neutral-600">
                {isSeeded ? '暂无文档' : '点击"初始化"加载内置知识库'}
              </div>
            ) : (
              filteredDocs.map(doc => {
                const expanded = expandedDocs.has(doc.filename)
                return (
                  <div key={doc.filename} className="rounded-lg border border-neutral-100 dark:border-neutral-800 overflow-hidden">
                    <button
                      onClick={() => toggleDocExpand(doc.filename)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">{doc.filename}</p>
                        <p className="text-[10px] text-neutral-400">{doc.chunks} 个片段</p>
                      </div>
                      <span className="text-[10px] text-neutral-400 flex-shrink-0">{new Date(doc.created_at).toLocaleDateString('zh-CN')}</span>
                      {expanded ? <ChevronUp className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />}
                    </button>
                    {expanded && (
                      <div className="border-t border-neutral-100 dark:border-neutral-800 px-3 py-2 flex items-center justify-end gap-2">
                        <span className="text-[10px] text-neutral-400 flex-1">点击删除将永久移除该文档的所有知识片段</span>
                        <button
                          onClick={() => handleDelete(doc.filename)}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* 上传进度 */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>上传中… {uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* 底部 */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
            关闭
          </button>
        </div>
      </Card>
    </div>
  )
}
