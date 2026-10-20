/**
 * @module fileSecurity
 * @description 文件安全验证和消毒工具
 * 提供文件名消毒、MIME类型验证、安全ID生成等核心安全功能
 *
 * 安全特性：
 * - 基于魔数（Magic Bytes）的真实MIME类型检测
 * - 路径遍历攻击防护（../）
 * - 危险文件扩展名黑名单
 * - 加密安全的唯一标识符生成
 */

const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'vbe', 'js', 'jse',
  'wsf', 'wsh', 'msc', 'jar', 'sh', 'bash', 'zsh', 'csh', 'tcsh',
  'ps1', 'psm1', 'psd1', 'vb', 'vbscript', 'hta', 'cpl', 'msi',
  'inf', 'reg', 'ads', 'ins', 'isp', 'dll', 'sys', 'drv', 'ocx',
])

const MAX_FILENAME_LENGTH = 255
const DATA_URL_MAX_SIZE = 5 * 1024 * 1024

export interface MagicBytePattern {
  bytes: number[]
  offset: number
  mimeType: string
}

const MAGIC_BYTE_PATTERNS: MagicBytePattern[] = [
  { bytes: [0xFF, 0xD8, 0xFF], offset: 0, mimeType: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, mimeType: 'image/png' },
  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, mimeType: 'image/gif' },
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mimeType: 'image/webp' },
  { bytes: [0x42, 0x4D], offset: 0, mimeType: 'image/bmp' },
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mimeType: 'application/pdf' },
  { bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], offset: 0, mimeType: 'application/vnd.ms-office' },
  { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0, mimeType: 'application/zip' },
]

export class FileSecurityError extends Error {
  public readonly code: string
  public readonly userMessage: string

  constructor(code: string, message: string, userMessage?: string) {
    super(message)
    this.name = 'FileSecurityError'
    this.code = code
    this.userMessage = userMessage || message
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FileSecurityError)
    }
  }
}

export function sanitizeFileName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw new FileSecurityError(
      'INVALID_FILENAME',
      '文件名不能为空或非字符串',
      '文件名无效，请使用有效的文件名',
    )
  }

  let sanitized = name.trim()

  // 先基于原始输入检测路径遍历（../ 或 ..\），恶意路径应被拒绝而非静默改名
  const pathTraversalPattern = /\.\.[\\/]|\.\.$/
  if (pathTraversalPattern.test(sanitized)) {
    throw new FileSecurityError(
      'PATH_TRAVERSAL',
      `检测到路径遍历尝试: ${name}`,
      '文件名包含非法路径字符，已拒绝处理',
    )
  }

  sanitized = sanitized.replace(/[\\/?*|"<>]/g, '_')

  const nullBytesRemoved = sanitized.replace(/\0/g, '')
  if (nullBytesRemoved.length !== sanitized.length) {
    throw new FileSecurityError(
      'NULL_BYTE_INJECTION',
      '文件名包含空字节注入',
      '文件名格式异常，可能存在安全风险',
    )
  }
  sanitized = nullBytesRemoved

  // eslint-disable-next-line no-control-regex -- 需要匹配/移除 ASCII 控制字符（安全清洗）
  const controlCharsRemoved = sanitized.replace(/[\x00-\x1F\x7F]/g, '')
  if (controlCharsRemoved.length < sanitized.length) {
    sanitized = controlCharsRemoved
  }

  if (sanitized === '.' || sanitized === '..') {
    throw new FileSecurityError(
      'RESERVED_NAME',
      '文件名为系统保留名称',
      '使用了系统保留的文件名',
    )
  }

  if (sanitized.length > MAX_FILENAME_LENGTH) {
    const ext = sanitized.includes('.') ? '.' + sanitized.split('.').pop() : ''
    const baseName = sanitized.slice(0, MAX_FILENAME_LENGTH - ext.length)
    sanitized = baseName + ext
  }

  if (!sanitized || sanitized.startsWith('.')) {
    sanitized = 'unnamed_file' + (sanitized.includes('.') ? sanitized.substring(sanitized.indexOf('.')) : '')
  }

  return sanitized
}

export function hasDangerousExtension(filename: string): boolean {
  const extension = filename.split('.').pop()?.toLowerCase().trim()
  if (!extension) return false
  return DANGEROUS_EXTENSIONS.has(extension)
}

export async function validateMimeType(file: File): Promise<string> {
  if (!file || !(file instanceof File)) {
    throw new FileSecurityError(
      'INVALID_FILE',
      '无效的文件对象',
      '无法识别的文件格式',
    )
  }

  const declaredMimeType = file.type?.toLowerCase() || ''

  try {
    const headerBytes = await readFileHeader(file, 16)

    let detectedMimeType = ''
    for (const pattern of MAGIC_BYTE_PATTERNS) {
      if (matchMagicBytes(headerBytes, pattern.bytes, pattern.offset)) {
        detectedMimeType = pattern.mimeType
        break
      }
    }

    if (!detectedMimeType && declaredMimeType) {
      detectedMimeType = declaredMimeType
    } else if (!detectedMimeType) {
      detectedMimeType = 'application/octet-stream'
    }

    if (declaredMimeType && declaredMimeType !== 'application/octet-stream') {
      const isCompatible = isMimeTypeCompatible(declaredMimeType, detectedMimeType)
      if (!isCompatible) {
        throw new FileSecurityError(
          'MIME_MISMATCH',
          `声明的MIME类型 (${declaredMimeType}) 与实际内容不匹配 (${detectedMimeType})`,
          '文件类型与实际内容不符，可能已被篡改或损坏',
        )
      }
    }

    return detectedMimeType
  } catch (error) {
    if (error instanceof FileSecurityError) {
      throw error
    }
    throw new FileSecurityError(
      'VALIDATION_FAILED',
      `MIME类型验证失败: ${error instanceof Error ? error.message : '未知错误'}`,
      '文件验证失败，请检查文件是否完整',
    )
  }
}

function readFileHeader(file: File, byteCount: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const slice = file.slice(0, Math.min(byteCount, file.size))
    const reader = new FileReader()

    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer
      resolve(new Uint8Array(arrayBuffer))
    }

    reader.onerror = () => {
      reject(new Error('读取文件头失败'))
    }

    reader.readAsArrayBuffer(slice)
  })
}

function matchMagicBytes(data: Uint8Array, pattern: number[], offset: number): boolean {
  for (let i = 0; i < pattern.length; i++) {
    if (data[offset + i] !== pattern[i]) {
      return false
    }
  }
  return true
}

function isMimeTypeCompatible(declared: string, detected: string): boolean {
  if (declared === detected) return true

  const declaredBase = declared.split('/')[0]
  const detectedBase = detected.split('/')[0]

  if (declaredBase === 'image' && detectedBase === 'image') return true
  if (declaredBase === 'text' && detectedBase === 'text') return true
  if (declared.includes('zip') && detected === 'application/zip') return true
  if (declared.includes('officedocument') && detected === 'application/vnd.ms-office') return true

  return false
}

export function generateSecureId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `${timestamp}-${randomPart}`
}

export function validateDataUrlSize(dataUrl: string): void {
  if (!dataUrl?.startsWith('data:')) {
    throw new FileSecurityError(
      'INVALID_DATA_URL',
      '无效的Data URL格式',
      '数据格式异常，无法处理',
    )
  }

  const base64Match = /base64,(.*)$/.exec(dataUrl)
  if (base64Match && base64Match[1]) {
    const base64Length = base64Match[1].length
    const estimatedSize = Math.ceil((base64Length * 3) / 4)

    if (estimatedSize > DATA_URL_MAX_SIZE) {
      throw new FileSecurityError(
        'DATA_URL_TOO_LARGE',
        `Data URL 大小超过限制: ${formatFileSize(estimatedSize)} > ${formatFileSize(DATA_URL_MAX_SIZE)}`,
        `文件过大，最大允许 ${formatFileSize(DATA_URL_MAX_SIZE)}`,
      )
    }
  } else {
    const urlEncodedSize = dataUrl.length
    if (urlEncodedSize > DATA_URL_MAX_SIZE * 4 / 3) {
      throw new FileSecurityError(
        'DATA_URL_TOO_LARGE',
        `Data URL 大小超过限制`,
        `文件过大，最大允许 ${formatFileSize(DATA_URL_MAX_SIZE)}`,
      )
    }
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`
}

export function createSecurityReport(file: File): Promise<{
  originalName: string
  sanitizedName: string
  declaredMimeType: string
  detectedMimeType: string
  hasDangerousExt: boolean
  size: number
  secureId: string
}> {
  return Promise.all([
    Promise.resolve(sanitizeFileName(file.name)),
    validateMimeType(file),
    Promise.resolve(hasDangerousExtension(file.name)),
    Promise.resolve(generateSecureId()),
  ]).then(([sanitizedName, detectedMimeType, hasDangerousExt, secureId]) => ({
    originalName: file.name,
    sanitizedName,
    declaredMimeType: file.type,
    detectedMimeType,
    hasDangerousExt,
    size: file.size,
    secureId,
  }))
}
