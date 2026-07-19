// 文件生成历史记录组件
import React, { useState, useEffect } from 'react'
import { Card, Button, Badge, EmptyState, Modal, Divider } from '@/components/ui'
import { FileFormat } from '@/types/fileGenerator'
import { fileGeneratorApi } from '@/api/fileGenerator'
import { Download, Eye, Trash2, FileText, Table, File, Clock, Check, AlertCircle } from 'lucide-react'
import { logger } from '@/utils/safeLogger';


interface FileHistoryItem {
  task_id: string
  filename: string
  format: FileFormat
  size: number
  created_at: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

export function FileHistory() {
  const [history, setHistory] = useState<FileHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

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
    processing: <Clock className="w-4 h-4" />,
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

  const loadHistory = async () => {
    setIsLoading(true)
    try {
      // 这里应该从后端API获取历史记录
      // 暂时使用模拟数据
      const mockHistory: FileHistoryItem[] = [
        {
          task_id: 'task_1',
          filename: 'AI对话_2026-04-25.md',
          format: FileFormat.MARKDOWN,
          size: 1024,
          created_at: new Date().toISOString(),
          status: 'completed',
        },
        {
          task_id: 'task_2',
          filename: '中药配方报告_2026-04-25.pdf',
          format: FileFormat.PDF,
          size: 51200,
          created_at: new Date(Date.now() - 3600000).toISOString(),
          status: 'completed',
        },
        {
          task_id: 'task_3',
          filename: '实验数据_2026-04-25.xlsx',
          format: FileFormat.XLSX,
          size: 20480,
          created_at: new Date(Date.now() - 7200000).toISOString(),
          status: 'completed',
        },
      ]
      setHistory(mockHistory)
    } catch (error) {
      logger.error('加载历史记录失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (showHistory) {
      loadHistory()
    }
  }, [showHistory])

  const handleDownload = async (taskId: string, filename: string) => {
    try {
      const blob = await fileGeneratorApi.downloadFile(taskId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      logger.error('文件下载失败:', error)
      alert('文件下载失败，请重试')
    }
  }

  const handlePreview = async (taskId: string, format: FileFormat) => {
    try {
      const blob = await fileGeneratorApi.downloadFile(taskId)
      const url = URL.createObjectURL(blob)
      setSelectedFile(url)
    } catch (error) {
      logger.error('文件预览失败:', error)
      alert('文件预览失败，请重试')
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowHistory(true)}
      >
        历史记录
      </Button>

      <Modal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        title="文件生成历史"
        maxWidth="lg"
      >
        <Card className="p-4">
          {history.length > 0 ? (
            <div className="space-y-4">
              {history.map((item) => (
                <div key={item.task_id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {formatIcon[item.format]}
                      <span className="font-medium">{item.filename}</span>
                    </div>
                    <Badge className={statusColor[item.status]}>
                      <div className="flex items-center gap-1">
                        {statusIcon[item.status]}
                        <span>{statusText[item.status]}</span>
                      </div>
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-xs text-neutral-500">格式</div>
                      <div className="text-sm">{formatName[item.format]}</div>
                    </div>
                    <div>
                      <div className="text-xs text-neutral-500">大小</div>
                      <div className="text-sm">{(item.size / 1024).toFixed(2)} KB</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-neutral-500">创建时间</div>
                      <div className="text-sm">{new Date(item.created_at).toLocaleString('zh-CN')}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreview(item.task_id, item.format)}
                      icon={<Eye className="w-4 h-4" />}
                    >
                      预览
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(item.task_id, item.filename)}
                      icon={<Download className="w-4 h-4" />}
                    >
                      下载
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="暂无文件历史" />
          )}
        </Card>
      </Modal>

      {/* 预览模态框 */}
      {selectedFile && (
        <Modal
          open={!!selectedFile}
          onClose={() => setSelectedFile(null)}
          title="文件预览"
        >
          <div className="h-96 overflow-auto">
            <iframe
              src={selectedFile}
              width="100%"
              height="100%"
              title="File Preview"
            />
          </div>
        </Modal>
      )}
    </>
  )
}
