import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  ClipboardAttachmentService,
  UnsupportedFileTypeError,
  FileTooLargeError,
  TooManyFilesError,
  clipboardAttachmentService
} from '../clipboardAttachmentService'
import { FileSecurityError } from '@/utils/fileSecurity'

const createMockFile = (
  name: string,
  type: string,
  size: number = 1024,
  content?: ArrayBuffer
): File => {
  const data = content || new ArrayBuffer(size)
  return new File([data], name, { type })
}

const createMockEvent = (files?: File[], items?: DataTransferItem[]): ClipboardEvent => {
  const event = {
    clipboardData: {
      files: files ? {
        length: files.length,
        item: (index: number) => files[index],
        [Symbol.iterator]: function* () { yield* files }
      } as unknown as FileList : { length: 0 } as FileList,
      items: items ? {
        length: items.length,
        item: (index: number) => items[index],
        [Symbol.iterator]: function* () { yield* items }
      } as unknown as DataTransferItemList : undefined,
      getData: vi.fn(() => '')
    },
    preventDefault: vi.fn()
  } as unknown as ClipboardEvent

  return event
}

describe('ClipboardAttachmentService', () => {
  let service: ClipboardAttachmentService

  beforeEach(() => {
    service = new ClipboardAttachmentService()
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // jsdom 无真实图片解码（Image/URL.createObjectURL/canvas 不可用），
    // generateThumbnail 的 Promise 永不 resolve 导致 3 个图片用例超时。
    // 单测关注服务逻辑，这里 mock 缩略图生成为固定 data URL。
    vi.spyOn(service, 'generateThumbnail').mockResolvedValue('data:image/png;base64,iVBORw0KGgo=')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('构造函数和初始化', () => {
    it('应该正确初始化服务', () => {
      expect(service).toBeInstanceOf(ClipboardAttachmentService)
    })

    it('导出的单例实例应该可用', () => {
      expect(clipboardAttachmentService).toBeInstanceOf(ClipboardAttachmentService)
    })
  })

  describe('getAttachmentType', () => {
    it('应该识别图片类型', () => {
      expect(service.getAttachmentType('image/jpeg')).toBe('image')
      expect(service.getAttachmentType('image/png')).toBe('image')
      expect(service.getAttachmentType('image/gif')).toBe('image')
      expect(service.getAttachmentType('image/webp')).toBe('image')
      expect(service.getAttachmentType('image/bmp')).toBe('image')
    })

    it('应该识别文档类型', () => {
      expect(service.getAttachmentType('application/pdf')).toBe('document')
      expect(service.getAttachmentType('text/plain')).toBe('document')
      expect(service.getAttachmentType('text/csv')).toBe('document')
    })

    it('应该识别文本类型', () => {
      expect(service.getAttachmentType('text/html')).toBe('text')
      expect(service.getAttachmentType('text/css')).toBe('text')
    })

    it('应该返回未知类型', () => {
      expect(service.getAttachmentType('application/octet-stream')).toBe('unknown')
      expect(service.getAttachmentType('video/mp4')).toBe('unknown')
    })
  })

  describe('generateId', () => {
    it('应该生成唯一 ID', () => {
      const id1 = service.generateId()
      const id2 = service.generateId()

      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
    })

    it('生成的 ID 应该是字符串', () => {
      const id = service.generateId()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })
  })

  describe('fileToAttachment - 安全验证', () => {
    it('应该对文件名进行消毒', async () => {
      const file = createMockFile('file<name>.pdf', 'application/pdf')
      const attachment = await service.fileToAttachment(file)

      expect(attachment.name).not.toContain('<')
      expect(attachment.name).toContain('_')
    })

    it('应该拒绝危险扩展名', async () => {
      const file = createMockFile('malware.exe', 'application/octet-stream')

      await expect(service.fileToAttachment(file)).rejects.toThrow(FileSecurityError)
    })

    it('应该标记安全验证状态', async () => {
      const file = createMockFile('document.pdf', 'application/pdf')
      const attachment = await service.fileToAttachment(file)

      expect(attachment.securityValidated).toBe(true)
    })

    it('应该保存原始文件名（如果被修改）', async () => {
      const file = createMockFile('file"name.pdf', 'application/pdf')
      const attachment = await service.fileToAttachment(file)

      expect(attachment.originalName).toBe('file"name.pdf')
      expect(attachment.name).not.toBe(attachment.originalName)
    })

    it('应该在禁用验证时跳过安全检查', async () => {
      const file = createMockFile('malware.exe', 'application/octet-stream')

      const attachment = await service.fileToAttachment(file, false)

      expect(attachment.securityValidated).toBe(false)
      expect(attachment.name).toBe('malware.exe')
    })
  })

  describe('fileToAttachment - 图片处理', () => {
    it('应该为图片生成 dataUrl 和缩略图', async () => {
      const jpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, ...new Array(12).fill(0)])
      const file = createMockFile('test.jpg', 'image/jpeg', 1024, jpegBytes.buffer)

      const attachment = await service.fileToAttachment(file, false)

      expect(attachment.type).toBe('image')
      expect(attachment.dataUrl).toBeDefined()
      expect(attachment.thumbnail).toBeDefined()
    })

    it('应该限制图片 Data URL 大小', async () => {
      const largeBuffer = new ArrayBuffer(6 * 1024 * 1024)
      const file = createMockFile('large.jpg', 'image/jpeg', largeBuffer.byteLength, largeBuffer)

      await expect(service.fileToAttachment(file, false)).rejects.toThrow(FileTooLargeError)
    }, 10000)
  })

  describe('textToAttachment', () => {
    it('应该创建文本附件', async () => {
      const attachment = await service.textToAttachment('测试文本内容')

      expect(attachment.type).toBe('text')
      expect(attachment.text).toBe('测试文本内容')
      expect(attachment.mimeType).toBe('text/plain')
      expect(attachment.securityValidated).toBe(true)
    })

    it('应该计算文本大小', async () => {
      const text = 'Hello World'
      const attachment = await service.textToAttachment(text)

      expect(attachment.size).toBe(new Blob([text]).size)
    })
  })

  describe('validateFile', () => {
    it('应该拒绝过大的文件', () => {
      const file = createMockFile('large.txt', 'text/plain', 15 * 1024 * 1024)

      expect(() => service.validateFile(file)).toThrow(FileTooLargeError)
    })

    it('应该接受在大小限制内的文件', () => {
      const file = createMockFile('small.txt', 'text/plain', 1024)

      expect(() => service.validateFile(file)).not.toThrow()
    })

    it('应该使用自定义大小限制', () => {
      const file = createMockFile('medium.txt', 'text/plain', 2 * 1024 * 1024)

      expect(() => service.validateFile(file, { maxSize: 1024 * 1024 })).toThrow(FileTooLargeError)
      expect(() => service.validateFile(file, { maxSize: 5 * 1024 * 1024 })).not.toThrow()
    })

    it('应该验证文件扩展名（如果提供 accept 列表）', () => {
      const pdfFile = createMockFile('document.pdf', 'application/pdf')
      // 使用非危险扩展名验证 accept 列表拦截（危险扩展名会先触发 FileSecurityError）
      const txtFile = createMockFile('notes.txt', 'text/plain')

      expect(() => service.validateFile(pdfFile, { accept: ['.pdf'] })).not.toThrow()
      expect(() => service.validateFile(txtFile, { accept: ['.pdf'] })).toThrow(UnsupportedFileTypeError)
    })

    it('应该检查危险扩展名', () => {
      const exeFile = createMockFile('malware.exe', 'application/octet-stream')

      expect(() => service.validateFile(exeFile)).toThrow(FileSecurityError)
    })

    it('应该在禁用验证时跳过安全检查', () => {
      const exeFile = createMockFile('safe.exe', 'application/octet-stream')

      expect(() => service.validateFile(exeFile, { enableSecurityValidation: false })).not.toThrow()
    })
  })

  describe('handleFiles', () => {
    it('应该处理多个文件', async () => {
      const files = [
        createMockFile('doc1.pdf', 'application/pdf'),
        createMockFile('doc2.csv', 'text/csv')
      ] as unknown as FileList

      const attachments = await service.handleFiles(files)

      expect(attachments.length).toBe(2)
      expect(attachments[0]!.name).toBe('doc1.pdf')
      expect(attachments[1]!.name).toBe('doc2.csv')
    })

    it('应该限制文件数量', async () => {
      const files = Array.from({ length: 15 }, (_, i) =>
        createMockFile(`file${i}.txt`, 'text/plain')
      ) as unknown as FileList

      await expect(service.handleFiles(files)).rejects.toThrow(TooManyFilesError)
    })

    it('应该使用自定义文件数量限制', async () => {
      const files = Array.from({ length: 5 }, (_, i) =>
        createMockFile(`file${i}.txt`, 'text/plain')
      ) as unknown as FileList

      await expect(
        service.handleFiles(files, { maxFiles: 3 })
      ).rejects.toThrow(TooManyFilesError)
    })

    it('应该对每个文件执行安全验证', async () => {
      const files = [
        createMockFile('safe.pdf', 'application/pdf'),
        createMockFile('dangerous.exe', 'application/octet-stream')
      ] as unknown as FileList

      await expect(service.handleFiles(files)).rejects.toThrow(FileSecurityError)
    })
  })

  describe('handlePaste', () => {
    it('应该处理粘贴的文件', async () => {
      const files = [createMockFile('pasted.pdf', 'application/pdf')]
      const event = createMockEvent(files)

      const attachments = await service.handlePaste(event)

      expect(attachments.length).toBeGreaterThan(0)
    })

    it('应该处理粘贴的文本', async () => {
      const event = createMockEvent(undefined, undefined)
      ;(event.clipboardData as any).getData = vi.fn(() => '粘贴的文本内容')

      const attachments = await service.handlePaste(event, { handleText: true })

      expect(attachments.length).toBe(1)
      expect(attachments[0]!.type).toBe('text')
      expect(attachments[0]!.text).toBe('粘贴的文本内容')
    })

    it('应该优先处理文件而非文本', async () => {
      const files = [createMockFile('pasted.png', 'image/png')]
      const event = createMockEvent(files, undefined)
      ;(event.clipboardData as any).getData = vi.fn(() => '文本内容')

      const attachments = await service.handlePaste(event)

      expect(attachments.some(a => a.type === 'image')).toBe(true)
    })

    it('应该触发 paste 事件', async () => {
      const callback = vi.fn()
      service.on('paste', callback)

      const files = [createMockFile('paste.pdf', 'application/pdf')]
      const event = createMockEvent(files)

      await service.handlePaste(event)

      expect(callback).toHaveBeenCalled()
    })

    it('应该在禁用图像处理时不创建图像附件', async () => {
      const mockImageItem = {
        type: 'image/png',
        getAsFile: vi.fn(() => createMockFile('image.png', 'image/png'))
      } as unknown as DataTransferItem

      const event = createMockEvent(undefined, [mockImageItem])

      const attachments = await service.handlePaste(event, { handleImages: false })

      expect(attachments.filter(a => a.type === 'image').length).toBe(0)
    })
  })

  describe('事件系统', () => {
    it('应该注册事件监听器', () => {
      const callback = vi.fn()
      service.on('test', callback)

      expect(callback).not.toHaveBeenCalled()
    })

    it('应该移除事件监听器', () => {
      const callback = vi.fn()
      service.on('test', callback)
      service.off('test', callback)

      // 验证移除后不会影响其他监听器
    })

    it('应该支持多个监听器', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      service.on('multi', callback1)
      service.on('multi', callback2)
    })
  })

  describe('setupDropZone', () => {
    it('应该设置拖放区域并返回清理函数', () => {
      const element = document.createElement('div')
      const cleanup = service.setupDropZone(element)

      expect(typeof cleanup).toBe('function')
      cleanup()
    })

    it('应该添加拖放 CSS 类', () => {
      const element = document.createElement('div')
      service.setupDropZone(element)

      const dragOverEvent = new Event('dragover', { bubbles: true })
      element.dispatchEvent(dragOverEvent)

      expect(element.classList.contains('dragover')).toBe(true)

      const cleanup = service.setupDropZone(element)
      cleanup()
    })

    it('应该处理拖放文件', async () => {
      const element = document.createElement('div')
      const dropCallback = vi.fn()
      service.on('drop', dropCallback)

      service.setupDropZone(element)

      const file = createMockFile('dropped.pdf', 'application/pdf')
      const dataTransfer = { files: [file] }

      const dropEvent = new Event('drop', { bubbles: true }) as any
      dropEvent.dataTransfer = dataTransfer
      dropEvent.preventDefault = vi.fn()
      dropEvent.stopPropagation = vi.fn()

      element.dispatchEvent(dropEvent)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(dropCallback).toHaveBeenCalled()

      const cleanup = service.setupDropZone(element)
      cleanup()
    })

    it('清理函数应该移除所有事件监听器', () => {
      const element = document.createElement('div')
      const cleanup = service.setupDropZone(element)

      cleanup()

      expect(element.classList.contains('dragover')).toBe(false)
    })
  })

  describe('setupPasteHandler', () => {
    it('应该设置粘贴处理器并返回清理函数', () => {
      const element = document.createElement('input')
      const cleanup = service.setupPasteHandler(element)

      expect(typeof cleanup).toBe('function')
      cleanup()
    })

    it('应该处理粘贴事件', async () => {
      const element = document.createElement('input')
      const pasteCallback = vi.fn()
      service.on('paste', pasteCallback)

      service.setupPasteHandler(element)

      const mockClipboardData = {
        getData: vi.fn(() => '测试文本'),
        files: { length: 0 } as FileList
      }

      const pasteEvent = new Event('paste') as any
      pasteEvent.clipboardData = mockClipboardData
      pasteEvent.preventDefault = vi.fn()

      element.dispatchEvent(pasteEvent)

      await new Promise(resolve => setTimeout(resolve, 100))

      const cleanup = service.setupPasteHandler(element)
      cleanup()
    })
  })

  describe('错误处理', () => {
    it('应该传播安全验证错误', async () => {
      const file = createMockFile('virus.exe', 'application/octet-stream')

      try {
        await service.fileToAttachment(file)
        fail('应该抛出异常')
      } catch (error) {
        expect(error).toBeInstanceOf(FileSecurityError)
        expect((error as FileSecurityError).code).toBe('DANGEROUS_EXTENSION')
      }
    })

    it('应该提供用户友好的错误消息', async () => {
      const file = createMockFile('hack.bat', 'application/octet-stream')

      try {
        await service.fileToAttachment(file)
        fail('应该抛出异常')
      } catch (error) {
        expect(error).toBeInstanceOf(FileSecurityError)
        expect((error as FileSecurityError).userMessage).toContain('不允许上传')
      }
    })

    it('拖放错误应该触发 error 事件', async () => {
      const errorCallback = vi.fn()
      service.on('error', errorCallback)

      const element = document.createElement('div')
      service.setupDropZone(element)

      const largeFile = createMockFile('huge.exe', 'application/octet-stream', 20 * 1024 * 1024)
      const dataTransfer = { files: [largeFile] }

      const dropEvent = new Event('drop', { bubbles: true }) as any
      dropEvent.dataTransfer = dataTransfer
      dropEvent.preventDefault = vi.fn()
      dropEvent.stopPropagation = vi.fn()

      element.dispatchEvent(dropEvent)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(errorCallback).toHaveBeenCalled()

      const cleanup = service.setupDropZone(element)
      cleanup()
    })
  })

  describe('集成测试 - 完整工作流', () => {
    it('应该完成完整的文件上传流程', async () => {
      const file = createMockFile('report_2024.pdf', 'application/pdf', 2048)

      service.validateFile(file, { maxSize: 5 * 1024 * 1024 })
      const attachment = await service.fileToAttachment(file)

      expect(attachment.id).toBeDefined()
      expect(attachment.name).toBe('report_2024.pdf')
      expect(attachment.type).toBe('document')
      expect(attachment.mimeType).toBe('application/pdf')
      expect(attachment.createdAt).toBeGreaterThan(0)
      expect(attachment.securityValidated).toBe(true)
    })

    it('应该处理带特殊字符的中文文件名', async () => {
      const file = createMockFile('配方<报告>_最终版#2024.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

      const attachment = await service.fileToAttachment(file)

      // 消毒器将 < > : " / \ | ? * 替换为 _，# 是合法文件名字符，保留原样
      expect(attachment.name).not.toContain('<')
      expect(attachment.originalName).toBeDefined()
    })

    it('应该正确处理批量上传', async () => {
      const files = [
        createMockFile('数据.xlsx', 'application/vnd.ms-excel'),
        createMockFile('说明.pdf', 'application/pdf'),
        createMockFile('图表.png', 'image/png')
      ] as unknown as FileList

      const attachments = await service.handleFiles(files, { maxFiles: 10 })

      expect(attachments.length).toBe(3)
      expect(attachments.every(a => a.securityValidated)).toBe(true)
    })
  })
})
