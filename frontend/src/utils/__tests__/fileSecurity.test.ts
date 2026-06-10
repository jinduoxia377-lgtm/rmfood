import { describe, it, expect } from 'vitest'
import {
  FileSecurityError,
  sanitizeFileName,
  hasDangerousExtension,
  validateMimeType,
  generateSecureId,
  validateDataUrlSize,
  formatFileSize,
  createSecurityReport
} from '../fileSecurity'

describe('FileSecurityError', () => {
  it('应该正确创建错误实例', () => {
    const error = new FileSecurityError('TEST_CODE', '测试消息', '用户友好消息')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(FileSecurityError)
    expect(error.name).toBe('FileSecurityError')
    expect(error.code).toBe('TEST_CODE')
    expect(error.message).toBe('测试消息')
    expect(error.userMessage).toBe('用户友好消息')
  })

  it('当未提供用户消息时，应使用默认消息', () => {
    const error = new FileSecurityError('TEST_CODE', '技术消息')

    expect(error.userMessage).toBe('技术消息')
  })

  it('应该保留错误堆栈信息', () => {
    const error = new FileSecurityError('STACK_TEST', '堆栈测试')

    expect(error.stack).toBeDefined()
  })
})

describe('sanitizeFileName', () => {
  it('应该处理正常的文件名', () => {
    const result = sanitizeFileName('document.pdf')
    expect(result).toBe('document.pdf')
  })

  it('应该支持中文文件名', () => {
    const result = sanitizeFileName('配方文档_2024版.docx')
    expect(result).toBe('配方文档_2024版.docx')
  })

  it('应该移除路径遍历字符 ../', () => {
    expect(() => sanitizeFileName('../../../etc/passwd')).toThrow(FileSecurityError)
    expect(() => sanitizeFileName('..\\..\\windows\\system32')).toThrow(FileSecurityError)
  })

  it('应该移除危险字符', () => {
    expect(sanitizeFileName('file<name>.txt')).toBe('file_name_.txt')
    expect(sanitizeFileName('file"name>.txt')).toBe('file_name_.txt')
    expect(sanitizeFileName('file|name?.txt')).toBe('file_name_.txt')
    expect(sanitizeFileName('file/name.txt')).toBe('file_name.txt')
    expect(sanitizeFileName('file\\name.txt')).toBe('file_name.txt')
  })

  it('应该拒绝空字节注入', () => {
    expect(() => sanitizeFileName('file\0name.txt')).toThrow(FileSecurityError)
  })

  it('应该拒绝空字符串或非字符串输入', () => {
    expect(() => sanitizeFileName('')).toThrow(FileSecurityError)
    expect(() => sanitizeFileName(null as any)).toThrow(FileSecurityError)
    expect(() => sanitizeFileName(undefined as any)).toThrow(FileSecurityError)
  })

  it('应该拒绝系统保留名称', () => {
    expect(() => sanitizeFileName('.')).toThrow(FileSecurityError)
    expect(() => sanitizeFileName('..')).toThrow(FileSecurityError)
  })

  it('应该移除控制字符', () => {
    const result = sanitizeFileName('file\x00name.txt')
    expect(result).not.toContain('\x00')
  })

  it('应该截断过长的文件名', () => {
    const longName = 'a'.repeat(300) + '.txt'
    const result = sanitizeFileName(longName)

    expect(result.length).toBeLessThanOrEqual(255)
    expect(result.endsWith('.txt')).toBe(true)
  })

  it('应该处理以点开头的隐藏文件', () => {
    const result = sanitizeFileName('.gitignore')
    expect(result.startsWith('unnamed_file')).toBe(true)
    expect(result.endsWith('.gitignore')).toBe(true)
  })

  it('应该修剪空白字符', () => {
    const result = sanitizeFileName('  document.pdf  ')
    expect(result).toBe('document.pdf')
  })
})

describe('hasDangerousExtension', () => {
  it('应该检测可执行文件扩展名', () => {
    expect(hasDangerousExtension('malware.exe')).toBe(true)
    expect(hasDangerousExtension('script.bat')).toBe(true)
    expect(hasDangerousExtension('script.sh')).toBe(true)
    expect(hasDangerousExtension('macro.vbs')).toBe(true)
  })

  it('应该允许安全扩展名', () => {
    expect(hasDangerousExtension('document.pdf')).toBe(false)
    expect(hasDangerousExtension('image.png')).toBe(false)
    expect(hasDangerousExtension('data.csv')).toBe(false)
    expect(hasDangerousExtension('archive.zip')).toBe(false)
  })

  it('应该不区分大小写', () => {
    expect(hasDangerousExtension('program.EXE')).toBe(true)
    expect(hasDangerousExtension('script.BAT')).toBe(true)
    expect(hasDangerousExtension('shell.SH')).toBe(true)
  })

  it('应该处理无扩展名文件', () => {
    expect(hasDangerousExtension('README')).toBe(false)
    expect(hasDangerousExtension('Makefile')).toBe(false)
  })
})

describe('validateMimeType', () => {
  const createMockFile = (bytes: number[], mimeType: string = '', name: string = 'test.bin'): File => {
    const arrayBuffer = new Uint8Array(bytes).buffer
    return new File([arrayBuffer], name, { type: mimeType })
  }

  it('应该检测 JPEG 文件的魔数', async () => {
    const jpegBytes = [0xFF, 0xD8, 0xFF, 0xE0, ...new Array(12).fill(0)]
    const file = createMockFile(jpegBytes, 'image/jpeg', 'test.jpg')

    const result = await validateMimeType(file)
    expect(result).toBe('image/jpeg')
  })

  it('应该检测 PNG 文件的魔数', async () => {
    const pngBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    const file = createMockFile(pngBytes, 'image/png', 'test.png')

    const result = await validateMimeType(file)
    expect(result).toBe('image/png')
  })

  it('应该检测 PDF 文件的魔数', async () => {
    const pdfBytes = [0x25, 0x50, 0x44, 0x46, ...new Array(12).fill(0)]
    const file = createMockFile(pdfBytes, 'application/pdf', 'test.pdf')

    const result = await validateMimeType(file)
    expect(result).toBe('application/pdf')
  })

  it('应该检测 MIME 类型不匹配', async () => {
    const jpegBytes = [0xFF, 0xD8, 0xFF, 0xE0, ...new Array(12).fill(0)]
    const file = createMockFile(jpegBytes, 'text/plain', 'fake.txt')

    await expect(validateMimeType(file)).rejects.toThrow(FileSecurityError)
  })

  it('应该拒绝无效的文件对象', async () => {
    await expect(validateMimeType(null as any)).rejects.toThrow(FileSecurityError)
    await expect(validateMimeType(undefined as any)).rejects.toThrow(FileSecurityError)
    await expect(validateMimeType({} as any)).rejects.toThrow(FileSecurityError)
  })

  it('应该接受兼容的 MIME 类型变体', async () => {
    const pngBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
    const file = createMockFile(pngBytes, 'image/png; charset=utf-8', 'test.png')

    const result = await validateMimeType(file)
    expect(result).toContain('png')
  })

  it('应该处理未知文件类型', async () => {
    const unknownBytes = new Array(16).fill(0xAB)
    const file = createMockFile(unknownBytes, '', 'unknown.bin')

    const result = await validateMimeType(file)
    expect(result).toBeDefined()
  })
})

describe('generateSecureId', () => {
  it('应该生成唯一标识符', () => {
    const id1 = generateSecureId()
    const id2 = generateSecureId()

    expect(id1).toBeDefined()
    expect(id2).toBeDefined()
    expect(id1).not.toBe(id2)
  })

  it('生成的 ID 应该是非空字符串', () => {
    const id = generateSecureId()

    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('应该生成多个不同的 ID', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSecureId()))

    expect(ids.size).toBe(100)
  })

  it('使用 crypto.randomUUID() 时应符合 UUID 格式（如果可用）', () => {
    const id = generateSecureId()

    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    }
  })
})

describe('validateDataUrlSize', () => {
  it('应该接受有效的 Data URL', () => {
    const smallDataUrl = 'data:text/plain;base64,' + btoa('Hello World')
    expect(() => validateDataUrlSize(smallDataUrl)).not.toThrow()
  })

  it('应该拒绝过大的 Data URL', () => {
    const largeBase64 = 'A'.repeat(7 * 1024 * 1024)
    const largeDataUrl = `data:image/png;base64,${largeBase64}`

    expect(() => validateDataUrlSize(largeDataUrl)).toThrow(FileSecurityError)
  })

  it('应该拒绝无效的 Data URL 格式', () => {
    expect(() => validateDataUrlSize('not-a-data-url')).toThrow(FileSecurityError)
    expect(() => validateDataUrlSize('')).toThrow(FileSecurityError)
    expect(() => validateDataUrlSize(null as any)).toThrow(FileSecurityError)
  })

  it('应该在边界大小正常工作', () => {
    const boundaryBase64 = 'A'.repeat(5 * 1024 * 1024)
    const boundaryDataUrl = `data:image/png;base64,${boundaryBase64}`

    expect(() => validateDataUrlSize(boundaryDataUrl)).toThrow()
  })
})

describe('formatFileSize', () => {
  it('应该格式化字节数', () => {
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(1048576)).toBe('1 MB')
    expect(formatFileSize(1073741824)).toBe('1 GB')
  })

  it('应该处理小数值', () => {
    const result = formatFileSize(512)
    expect(result).toContain('B')
  })

  it('应该处理大数值', () => {
    const result = formatFileSize(5 * 1024 * 1024 * 1024)
    expect(result).toContain('GB')
  })
})

describe('createSecurityReport', () => {
  const createTestFile = (name: string, type: string): File => {
    return new File(['test content'], name, { type })
  }

  it('应该生成完整的安全报告', async () => {
    const file = createTestFile('document.pdf', 'application/pdf')
    const report = await createSecurityReport(file)

    expect(report.originalName).toBe('document.pdf')
    expect(report.sanitizedName).toBe('document.pdf')
    expect(report.declaredMimeType).toBe('application/pdf')
    expect(report.hasDangerousExt).toBe(false)
    expect(report.size).toBeGreaterThan(0)
    expect(report.secureId).toBeDefined()
    expect(report.secureId.length).toBeGreaterThan(0)
  })

  it('应该对危险文件标记 hasDangerousExt', async () => {
    const file = createTestFile('malware.exe', 'application/octet-stream')
    const report = await createSecurityReport(file)

    expect(report.hasDangerousExt).toBe(true)
  })

  it('应该消毒文件名', async () => {
    const file = createTestFile('file<name>.pdf', 'application/pdf')
    const report = await createSecurityReport(file)

    expect(report.sanitizedName).not.toContain('<')
    expect(report.sanitizedName).toBe('file_name_.pdf')
  })
})
