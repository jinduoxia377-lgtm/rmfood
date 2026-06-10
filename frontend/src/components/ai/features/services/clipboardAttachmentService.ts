import { logger } from '@/utils/safeLogger'
import {
  FileSecurityError,
  sanitizeFileName,
  validateMimeType,
  hasDangerousExtension,
  generateSecureId,
  validateDataUrlSize,
  formatFileSize,
} from '@/utils/fileSecurity'

export type AttachmentType = 'image' | 'document' | 'text' | 'unknown'

export interface Attachment {
  id: string
  name: string
  originalName?: string
  type: AttachmentType
  file?: File
  dataUrl?: string
  text?: string
  mimeType: string
  detectedMimeType?: string
  size: number
  thumbnail?: string
  createdAt: number
  securityValidated: boolean
}

export interface DropZoneOptions {
  accept?: string[]
  maxSize?: number
  maxFiles?: number
  enableSecurityValidation?: boolean
}

export interface PasteHandlerOptions {
  handleImages?: boolean
  handleFiles?: boolean
  handleText?: boolean
  enableSecurityValidation?: boolean
}

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024
const DEFAULT_MAX_FILES = 10
const DATA_URL_MAX_SIZE = 5 * 1024 * 1024

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp']
const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/markdown',
]

export class UnsupportedFileTypeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedFileTypeError'
  }
}

export class FileTooLargeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileTooLargeError'
  }
}

export class TooManyFilesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TooManyFilesError'
  }
}

export class ClipboardAttachmentService {
  private listeners = new Map<string, Set<(data: any) => void>>()

  constructor() {
    logger.debug('[ClipboardAttachmentService] 初始化（安全增强版）')
  }

  getAttachmentType(mimeType: string): AttachmentType {
    if (IMAGE_MIME_TYPES.includes(mimeType)) return 'image'
    if (DOCUMENT_MIME_TYPES.includes(mimeType)) return 'document'
    if (mimeType.startsWith('text/')) return 'text'
    return 'unknown'
  }

  generateId(): string {
    return generateSecureId()
  }

  private async performSecurityValidation(file: File): Promise<{
    sanitizedName: string
    detectedMimeType: string
  }> {
    logger.debug('[ClipboardAttachmentService] 执行安全验证', { fileName: file.name })

    const originalName = file.name

    try {
      const sanitizedName = sanitizeFileName(originalName)

      if (hasDangerousExtension(sanitizedName)) {
        throw new FileSecurityError(
          'DANGEROUS_EXTENSION',
          `检测到危险文件扩展名: ${sanitizedName}`,
          `不允许上传 .${sanitizedName.split('.').pop()} 类型的文件`,
        )
      }

      const detectedMimeType = await validateMimeType(file)

      logger.info('[ClipboardAttachmentService] 安全验证通过', {
        originalName,
        sanitizedName,
        declaredType: file.type,
        detectedType: detectedMimeType,
      })

      return { sanitizedName, detectedMimeType }
    } catch (error) {
      if (error instanceof FileSecurityError) {
        logger.error('[ClipboardAttachmentService] 安全验证失败', {
          code: error.code,
          message: error.message,
          fileName: file.name,
        })
        throw error
      }

      throw new FileSecurityError(
        'VALIDATION_ERROR',
        `安全验证异常: ${error instanceof Error ? error.message : '未知错误'}`,
        '文件安全检查失败，请确认文件完整性后重试',
      )
    }
  }

  async fileToAttachment(file: File, enableSecurityValidation = true): Promise<Attachment> {
    let sanitizedName = file.name
    let detectedMimeType: string | undefined
    let securityValidated = false

    if (enableSecurityValidation) {
      try {
        const validation = await this.performSecurityValidation(file)
        sanitizedName = validation.sanitizedName
        detectedMimeType = validation.detectedMimeType
        securityValidated = true
      } catch (error) {
        if (error instanceof FileSecurityError) {
          throw error
        }

        logger.warn('[ClipboardAttachmentService] 安全验证失败，使用基本模式', {
          error: error instanceof Error ? error.message : '未知错误',
        })
      }
    }

    const effectiveMimeType = detectedMimeType || file.type
    const type = this.getAttachmentType(effectiveMimeType)

    const attachment: Attachment = {
      id: this.generateId(),
      name: sanitizedName,
      originalName: file.name !== sanitizedName ? file.name : undefined,
      type,
      file,
      mimeType: effectiveMimeType,
      detectedMimeType,
      size: file.size,
      createdAt: Date.now(),
      securityValidated,
    }

    if (type === 'image') {
      attachment.dataUrl = await this.fileToDataUrlWithLimit(file)
      attachment.thumbnail = await this.generateThumbnail(file)
    }

    return attachment
  }

  async textToAttachment(text: string): Promise<Attachment> {
    return {
      id: this.generateId(),
      name: '剪贴板文本',
      type: 'text',
      text,
      mimeType: 'text/plain',
      size: new Blob([text]).size,
      createdAt: Date.now(),
      securityValidated: true,
    }
  }

  async fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  private async fileToDataUrlWithLimit(file: File): Promise<string> {
    const dataUrl = await this.fileToDataUrl(file)

    try {
      validateDataUrlSize(dataUrl)
    } catch (error) {
      if (error instanceof FileSecurityError) {
        throw new FileTooLargeError(error.userMessage || `图片大小超过限制 (${formatFileSize(DATA_URL_MAX_SIZE)})`)
      }
      throw error
    }

    return dataUrl
  }

  async generateThumbnail(file: File, maxWidth = 200, maxHeight = 200): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const thumbnail = canvas.toDataURL('image/png')
          URL.revokeObjectURL(url)
          resolve(thumbnail)
        } else {
          URL.revokeObjectURL(url)
          reject(new Error('无法获取 canvas 上下文'))
        }
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('图片加载失败'))
      }

      img.src = url
    })
  }

  validateFile(file: File, options: DropZoneOptions = {}): void {
    const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE
    const accept = options.accept
    const enableSecurityValidation = options.enableSecurityValidation ?? true

    if (file.size > maxSize) {
      throw new FileTooLargeError(`文件 ${file.name} 超过大小限制 (${formatFileSize(maxSize)})`)
    }

    if (enableSecurityValidation) {
      const sanitizedName = sanitizeFileName(file.name)

      if (hasDangerousExtension(sanitizedName)) {
        throw new FileSecurityError(
          'DANGEROUS_EXTENSION',
          `检测到危险文件扩展名: ${sanitizedName}`,
          `不允许上传此类型的文件 (.${sanitizedName.split('.').pop()})`,
        )
      }
    }

    if (accept && accept.length > 0) {
      const sanitizedFile = new File([file], sanitizeFileName(file.name), { type: file.type })
      const fileExtension = `.${sanitizeFileName(file.name).split('.').pop()?.toLowerCase()}`
      const mimeTypeMatch = accept.some(type =>
        sanitizedFile.type.includes(type) || fileExtension === type,
      )

      if (!mimeTypeMatch) {
        throw new UnsupportedFileTypeError(`不支持的文件类型: ${file.type}`)
      }
    }
  }

  async handleFiles(files: FileList, options: DropZoneOptions = {}): Promise<Attachment[]> {
    const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES
    const fileArray = Array.from(files)
    const enableSecurityValidation = options.enableSecurityValidation ?? true

    if (fileArray.length > maxFiles) {
      throw new TooManyFilesError(`最多只能上传 ${maxFiles} 个文件`)
    }

    const attachments: Attachment[] = []

    for (const file of fileArray) {
      this.validateFile(file, options)
      const attachment = await this.fileToAttachment(file, enableSecurityValidation)
      attachments.push(attachment)
    }

    logger.debug('[ClipboardAttachmentService] 处理文件完成', {
      count: attachments.length,
      securityEnabled: enableSecurityValidation,
    })
    return attachments
  }

  async handlePaste(event: ClipboardEvent, options: PasteHandlerOptions = {}): Promise<Attachment[]> {
    const {
      handleImages = true,
      handleFiles = true,
      handleText = true,
      enableSecurityValidation = true,
    } = options

    const attachments: Attachment[] = []

    logger.debug('[ClipboardAttachmentService] 处理粘贴事件', {
      hasFiles: !!event.clipboardData?.files.length,
      hasItems: !!event.clipboardData?.items?.length,
      securityEnabled: enableSecurityValidation,
    })

    if (handleFiles && event.clipboardData?.files.length) {
      const fileAttachments = await this.handleFiles(
        event.clipboardData.files,
        { ...options, enableSecurityValidation },
      )
      attachments.push(...fileAttachments)
    }

    if (handleImages && event.clipboardData?.items) {
      for (const item of event.clipboardData.items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            const attachment = await this.fileToAttachment(file, enableSecurityValidation)
            attachments.push(attachment)
          }
        }
      }
    }

    if (handleText && attachments.length === 0) {
      const text = event.clipboardData?.getData('text')
      if (text?.trim()) {
        const textAttachment = await this.textToAttachment(text)
        attachments.push(textAttachment)
      }
    }

    if (attachments.length > 0) {
      this.emit('paste', attachments)
    }

    return attachments
  }

  setupDropZone(element: HTMLElement, options: DropZoneOptions = {}): () => void {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      element.classList.add('dragover')
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      element.classList.remove('dragover')
    }

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      element.classList.remove('dragover')

      if (e.dataTransfer?.files.length) {
        try {
          const attachments = await this.handleFiles(e.dataTransfer.files, options)
          this.emit('drop', attachments)
        } catch (error) {
          logger.error('[ClipboardAttachmentService] 拖放处理失败', error)
          this.emit('error', error)
        }
      }
    }

    element.addEventListener('dragover', handleDragOver)
    element.addEventListener('dragleave', handleDragLeave)
    element.addEventListener('drop', handleDrop)

    logger.debug('[ClipboardAttachmentService] 拖放区已设置', {
      securityEnabled: options.enableSecurityValidation ?? true,
    })

    return () => {
      element.removeEventListener('dragover', handleDragOver)
      element.removeEventListener('dragleave', handleDragLeave)
      element.removeEventListener('drop', handleDrop)
      element.classList.remove('dragover')
      logger.debug('[ClipboardAttachmentService] 拖放区已清理')
    }
  }

  setupPasteHandler(element: HTMLElement, options: PasteHandlerOptions = {}): () => void {
    const handlePaste = async (e: ClipboardEvent) => {
      try {
        const attachments = await this.handlePaste(e, options)
        if (attachments.length > 0) {
          e.preventDefault()
        }
      } catch (error) {
        logger.error('[ClipboardAttachmentService] 粘贴处理失败', error)
        this.emit('error', error)
      }
    }

    element.addEventListener('paste', handlePaste as unknown as EventListener)
    logger.debug('[ClipboardAttachmentService] 粘贴处理器已设置', {
      securityEnabled: options.enableSecurityValidation ?? true,
    })

    return () => {
      element.removeEventListener('paste', handlePaste as unknown as EventListener)
      logger.debug('[ClipboardAttachmentService] 粘贴处理器已清理')
    }
  }

  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: (data: any) => void): void {
    this.listeners.get(event)?.delete(callback)
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(callback => callback(data))
  }
}

export const clipboardAttachmentService = new ClipboardAttachmentService()
export default clipboardAttachmentService
