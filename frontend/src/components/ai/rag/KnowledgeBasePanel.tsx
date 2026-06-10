/**
 * KnowledgeBasePanel - RAG 知识库管理面板
 *
 * 展示知识库中文档列表、统计信息，支持上传和删除。
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Database, Trash2, FileText, FileSpreadsheet, File, Loader2, RefreshCw } from 'lucide-react'
import { listDocuments, deleteDocument, getRAGStats, type RAGStats, type DocumentInfo } from '@/api/rag'
import { DocumentUploader } from './DocumentUploader'
import { clsx } from 'clsx'

interface KnowledgeBasePanelProps {
  /** 嵌入到 AI 页面时可选传递 */
  isEmbedded?: boolean
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="w-4 h-4 text-red-500" />,
  txt: <FileText className="w-4 h-4 text-blue-500" />,
  csv: <FileSpreadsheet className="w-4 h-4 text-green-500" />,
  md: <FileText className="w-4 h-4 text-purple-500" />,
}

function getFileIcon(filename: string): React.ReactNode {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return FILE_ICONS[ext] || <File className="w-4 h-4 text-gray-400" />
}

export function KnowledgeBasePanel({ isEmbedded = false }: KnowledgeBasePanelProps) {
  const queryClient = useQueryClient()
  const [deletingFile, setDeletingFile] = useState<string | null>(null)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['rag-stats'],
    queryFn: getRAGStats,
    refetchInterval: 30000,
  })

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['rag-documents'],
    queryFn: listDocuments,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rag-documents'] })
      queryClient.invalidateQueries({ queryKey: ['rag-stats'] })
    },
  })

  const handleDelete = useCallback(async (filename: string) => {
    setDeletingFile(filename)
    try {
      await deleteMutation.mutateAsync(filename)
    } finally {
      setDeletingFile(null)
    }
  }, [deleteMutation])

  const handleUploadSuccess = useCallback((_doc: DocumentInfo) => {
    queryClient.invalidateQueries({ queryKey: ['rag-documents'] })
    queryClient.invalidateQueries({ queryKey: ['rag-stats'] })
  }, [queryClient])

  const docs = documents || []
  const isLoading = statsLoading || docsLoading

  return (
    <div className={clsx('space-y-4', isEmbedded ? '' : 'p-4')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">知识库</h2>
          {stats && (
            <span className="px-2 py-0.5 text-xs font-medium bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded-full">
              {stats.total_chunks} 个文档块
            </span>
          )}
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['rag-stats'] })}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="刷新"
        >
          <RefreshCw className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Upload */}
      <DocumentUploader onUploadSuccess={handleUploadSuccess} />

      {/* Document list */}
      <div className="space-y-1">
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          已导入文档 ({docs.length})
        </h3>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : docs.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
            暂无文档，请上传 PDF、TXT、CSV 或 Markdown 文件
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {docs.map((doc) => (
              <div
                key={doc}
                className="flex items-center justify-between py-2.5 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getFileIcon(doc)}
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {doc}
                  </span>
                </div>
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deletingFile === doc}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                  title={`删除 ${doc}`}
                >
                  {deletingFile === doc
                    ? <Loader2 className="w-3.5 h-3.5 text-red-500 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
