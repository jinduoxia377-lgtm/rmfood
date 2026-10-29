/**
 * DocumentUploader - RAG 知识库文档上传组件
 *
 * 支持拖拽/点击上传 PDF、TXT、CSV、MD 文件
 * 实时显示上传进度和解析结果
 */

import React, { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { uploadDocument, type DocumentInfo } from '@/api/rag'
import { clsx } from 'clsx'

interface DocumentUploaderProps {
  onUploadSuccess?: (doc: DocumentInfo) => void
  maxSizeMB?: number
}

const ACCEPTED_TYPES = '.pdf,.txt,.csv,.md'
const ACCEPTED_TYPES_LABEL = 'PDF, TXT, CSV, MD'

export function DocumentUploader({ onUploadSuccess, maxSizeMB = 20 }: DocumentUploaderProps) {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    // 验证类型
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_TYPES.includes(ext)) {
      setUploadResult({ type: 'error', message: t('ai.knowledge.unsupportedType', { ext, types: ACCEPTED_TYPES_LABEL }) })
      return
    }

    // 验证大小
    if (file.size > maxSizeMB * 1024 * 1024) {
      setUploadResult({ type: 'error', message: t('ai.knowledge.fileTooLarge', { maxSize: maxSizeMB }) })
      return
    }

    setIsUploading(true)
    setProgress(0)
    setUploadResult(null)

    try {
      const doc = await uploadDocument(file, (p) => setProgress(p))
      setUploadResult({ type: 'success', message: t('ai.knowledge.uploadSuccess', { filename: doc.filename, count: doc.chunk_count }) })
      onUploadSuccess?.(doc)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || t('ai.knowledge.uploadFailed')
      setUploadResult({ type: 'error', message: msg })
    } finally {
      setIsUploading(false)
    }
  }, [maxSizeMB, onUploadSuccess])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    if (inputRef.current) inputRef.current.value = ''
  }, [handleFile])

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200',
          isDragging
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
            : 'border-neutral-300 dark:border-neutral-600 hover:border-primary-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
          isUploading && 'pointer-events-none opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleChange}
          className="hidden"
          aria-label={t('ai.knowledge.selectFileLabel')}
        />

        {isUploading ? (
          <div className="space-y-2">
            <Loader2 className="w-8 h-8 mx-auto text-primary-500 animate-spin" />
            <p className="text-sm text-[var(--text-secondary)]">{t('ai.knowledge.uploading')}</p>
            <div className="w-full max-w-xs mx-auto bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
              <div
                className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-[var(--text-muted)]">{progress}%</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)]">
              {t('ai.knowledge.dropHint')} <span className="text-primary-500">{t('ai.knowledge.clickSelect')}</span>
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {t('ai.knowledge.formatHint', { types: ACCEPTED_TYPES_LABEL, maxSize: maxSizeMB })}
            </p>
          </div>
        )}
      </div>

      {/* Result message */}
      {uploadResult && (
        <div className={clsx(
          'flex items-start gap-2 p-3 rounded-lg text-sm',
          uploadResult.type === 'success'
            ? 'bg-success-50 dark:bg-success-950/30 text-success-700 dark:text-success-600'
            : 'bg-error-50 dark:bg-error-950/30 text-error-700 dark:text-error-600',
        )}>
          {uploadResult.type === 'success'
            ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          }
          <p className="flex-1">{uploadResult.message}</p>
          <button onClick={() => setUploadResult(null)} className="shrink-0 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
