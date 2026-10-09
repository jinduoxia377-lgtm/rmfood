// 文件交付组件
import React, { useState, useEffect } from 'react'
import { Card, Button, Progress, Alert, Badge, Modal } from '@/components/ui'
import type { TaskStatus as TaskStatusType } from '@/types/fileGenerator'
import { FileFormat } from '@/types/fileGenerator'
import { fileGeneratorApi } from '@/api/fileGenerator'
import { Download, Eye, RefreshCw, X, Clock, Check, AlertCircle, FileText, Table, File } from 'lucide-react'
import { logger } from '@/utils/safeLogger';


interface FileDeliveryProps {
  taskId: string
  filename: string
  format: FileFormat
  onClose: () => void
}

export function FileDelivery({ taskId, filename, format, onClose }: FileDeliveryProps) {
  const [status, setStatus] = useState<TaskStatusType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const formatIcon = {
    [FileFormat.PDF]: <File className="w-4 h-4" />,
    [FileFormat.DOCX]: <FileText className="w-4 h-4" />,
    [FileFormat.XLSX]: <Table className="w-4 h-4" />,
    [FileFormat.MARKDOWN]: <FileText className="w-4 h-4" />,
  }

  const formatName = {
    [FileFormat.PDF]: 'PDF',
    [FileFormat.DOCX]: 'Word',
    [FileFormat.XLSX]: 'Excel',
    [FileFormat.MARKDOWN]: 'Markdown',
  }

  const statusIcon = {
    pending: <Clock className="w-4 h-4" />,
    processing: <RefreshCw className="w-4 h-4 animate-spin" />,
    completed: <Check className="w-4 h-4" />,
    failed: <AlertCircle className="w-4 h-4" />,
  }

  const statusText = {
    pending: '等待中',
    processing: '处理中',
    completed: '已完成',
    failed: '失败',
  }

  const statusColor = {
    pending: 'bg-secondary-100 text-secondary-700',
    processing: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-success-100 text-success-700',
    failed: 'bg-error-100 text-error-700',
  }

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const taskStatus = await fileGeneratorApi.getTaskStatus(taskId)
        setStatus(taskStatus)

        if (taskStatus.status === 'completed' || taskStatus.status === 'failed') {
          setIsLoading(false)
        } else {
          // 继续轮询
          setTimeout(pollStatus, 1000)
        }
      } catch (err) {
        setError('获取任务状态失败')
        setIsLoading(false)
      }
    }

    pollStatus()
  }, [taskId])

  const handleDownload = async () => {
    if (status?.status !== 'completed') return

    setIsDownloading(true)
    try {
      const blob = await fileGeneratorApi.downloadFile(taskId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('文件下载失败')
    } finally {
      setIsDownloading(false)
    }
  }

  const handlePreview = async () => {
    if (status?.status !== 'completed') return

    try {
      const blob = await fileGeneratorApi.downloadFile(taskId)
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      setShowPreview(true)
    } catch (err) {
      setError('文件预览失败')
    }
  }

  return (
    <Card className="p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          {formatIcon[format]}
          文件生成状态
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          icon={<X className="w-4 h-4" />}
        >
          关闭
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          {error}
        </Alert>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{filename}</p>
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{formatName[format]} 格式</p>
          </div>
          <Badge className={status ? statusColor[status.status] : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700'}>
            {status ? (
              <div className="flex items-center gap-1">
                {statusIcon[status.status]}
                <span>{statusText[status.status]}</span>
              </div>
            ) : (
              '加载中...'
            )}
          </Badge>
        </div>

        {status && status.status !== 'completed' && status.status !== 'failed' && (
          <div>
            <Progress value={status.progress} className="w-full" />
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-2">
              处理进度: {status.progress}%
            </p>
          </div>
        )}

        {status?.error_message && (
          <Alert variant="destructive" className="mt-4">
            <p className="text-sm">生成失败: {status.error_message}</p>
          </Alert>
        )}

        {status?.status === 'completed' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>文件大小:</span>
              <span>{(status.file_size || 0) / 1024}.toFixed(2) KB</span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handlePreview}
                variant="secondary"
                icon={<Eye className="w-4 h-4" />}
              >
                预览
              </Button>
              <Button
                onClick={handleDownload}
                loading={isDownloading}
                icon={<Download className="w-4 h-4" />}
              >
                下载
              </Button>
            </div>
          </div>
        )}

        {status?.status === 'failed' && (
          <Button
            variant="secondary"
            onClick={() => window.location.reload()}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            重试
          </Button>
        )}
      </div>

      {/* 预览模态框 */}
      {showPreview && previewUrl && (
        <Modal open={showPreview} onClose={() => setShowPreview(false)} title="文件预览">
          <div className="h-96 overflow-auto">
            {format === FileFormat.PDF ? (
              <iframe
                src={previewUrl}
                width="100%"
                height="100%"
                title="PDF 预览"
              />
            ) : (
              <div className="p-4 bg-slate-50 dark:bg-neutral-800 rounded-lg">
                <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  此文件格式不支持在线预览，请下载后查看
                </p>
                <Button
                  className="mt-4"
                  onClick={handleDownload}
                  loading={isDownloading}
                  icon={<Download className="w-4 h-4" />}
                >
                  下载文件
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </Card>
  )
}

export function FileGenerationButton({
  content,
  filename,
  format,
  template = 'default',
  children,
}: {
  content: any
  filename: string
  format: FileFormat
  template?: string
  children: React.ReactNode
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [showDelivery, setShowDelivery] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const id = await fileGeneratorApi.generateFileAsync({
        content,
        format,
        filename,
        template,
      })
      setTaskId(id)
      setShowDelivery(true)
    } catch (error) {
      logger.error('文件生成失败:', error)
      alert('文件生成失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <>
      <Button
        onClick={handleGenerate}
        loading={isGenerating}
      >
        {children}
      </Button>

      {showDelivery && taskId && (
        <Modal
          open={showDelivery}
          onClose={() => setShowDelivery(false)}
          title="文件生成"
          maxWidth="sm:max-w-md"
        >
          <FileDelivery
            taskId={taskId}
            filename={filename}
            format={format}
            onClose={() => setShowDelivery(false)}
          />
        </Modal>
      )}
    </>
  )
}
