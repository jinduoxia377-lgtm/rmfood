/**
 * useChatInputAttachments - 文件附件管理 Hook (v1.0)
 *
 * 职责：
 * - 文件粘贴处理（图片/文件）
 * - 拖拽上传处理
 * - 附件列表管理（添加/移除/清空）
 * - 文件类型和大小校验
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import { useCallback, useState } from 'react'
import { logger } from '@/utils/safeLogger'

export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  dataUrl?: string
  preview?: string
}

export interface AttachmentOptions {
  maxSize?: number       // 默认 10MB
  maxFiles?: number      // 默认 5
  accept?: string[]      // 默认所有
}

const DEFAULT_OPTIONS: AttachmentOptions = {
  maxSize: 10 * 1024 * 1024,
  maxFiles: 5,
  accept: ['image/*', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.md'],
}

export interface UseChatInputAttachmentsReturn {
  attachments: Attachment[]
  isDragging: boolean
  showAttachments: boolean
  setShowAttachments: (v: boolean) => void
  addAttachments: (files: Attachment[]) => void
  removeAttachment: (id: string) => void
  clearAttachments: () => void
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
  setupEventListeners: () => () => void
}

export function useChatInputAttachments(
  fileInputRef: React.RefObject<HTMLInputElement | null>,
  options: AttachmentOptions = DEFAULT_OPTIONS,
): UseChatInputAttachmentsReturn {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)

  const addAttachments = useCallback((newAttachments: Attachment[]) => {
    setAttachments(prev => {
      const combined = [...prev, ...newAttachments]
      if (combined.length > options.maxFiles!) {
        logger.warn(`[useChatInputAttachments] 超过最大文件数 ${options.maxFiles}`)
        return prev.concat(combined.slice(combined.length - options.maxFiles!))
      }
      return combined
    })
    setShowAttachments(true)
  }, [options.maxFiles])

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => {
      const filtered = prev.filter(a => a.id !== id)
      if (filtered.length === 0) setShowAttachments(false)
      return filtered
    })
  }, [])

  const clearAttachments = useCallback(() => {
    setAttachments([])
    setShowAttachments(false)
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    const newAttachments: Attachment[] = []

    for (const file of fileArray) {
      // 大小校验
      if (file.size > (options.maxSize ?? 10 * 1024 * 1024)) {
        logger.warn(`[useChatInputAttachments] 文件过大: ${file.name}`)
        continue
      }
      // 类型校验
      if (options.accept && options.accept.length > 0) {
        const ext = '.' + file.name.split('.').pop()?.toLowerCase()
        const isImage = file.type.startsWith('image/')
        const typeOk = isImage || options.accept.some(a => a === '*' || file.type.includes(a.replace('.', '')) || ext === a)
        if (!typeOk) {
          logger.warn(`[useChatInputAttachments] 不支持的文件类型: ${file.name}`)
          continue
        }
      }

      // 读取为 data URL（仅图片用于预览）
      let dataUrl: string | undefined
      let preview: string | undefined
      if (file.type.startsWith('image/')) {
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = (ev) => resolve(ev.target?.result as string)
          reader.readAsDataURL(file)
        })
        preview = dataUrl
      }

      newAttachments.push({
        id: `attach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
        preview,
      })
    }

    if (newAttachments.length > 0) {
      addAttachments(newAttachments)
    }

    // 重置 input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [fileInputRef, options, addAttachments])

  // 拖拽事件
  const setupEventListeners = useCallback(() => {
    const container = document.getElementById('chat-input-container')
    if (!container) return () => {}

    const handleDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true) }
    const handleDragLeave = () => setIsDragging(false)
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer?.files?.length) {
        const dt = new DataTransfer()
        Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f))
        if (fileInputRef.current) {
          fileInputRef.current.files = dt.files
          fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
    }

    container.addEventListener('dragover', handleDragOver)
    container.addEventListener('dragleave', handleDragLeave)
    container.addEventListener('drop', handleDrop)

    return () => {
      container.removeEventListener('dragover', handleDragOver)
      container.removeEventListener('dragleave', handleDragLeave)
      container.removeEventListener('drop', handleDrop)
    }
  }, [fileInputRef])

  return {
    attachments, isDragging, showAttachments, setShowAttachments,
    addAttachments, removeAttachment, clearAttachments,
    handleFileSelect, setupEventListeners,
  }
}
