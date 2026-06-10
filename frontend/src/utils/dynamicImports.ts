/**
 * 动态导入工具
 * 用于懒加载大型依赖库（如 ExcelJS、JSPDF 等）
 * 减少首屏加载时间和包体积
 */
import { logger } from '@/utils/safeLogger'


// 缓存已加载的模块
const moduleCache = new Map<string, unknown>()

/**
 * 确保 Node.js process 全局对象在浏览器环境中可用
 * 这是解决 "Cannot read properties of undefined (reading 'node')" 错误的关键
 */
function ensureProcessPolyfill(): void {
  // 检查 window 环境
  const win = window as unknown as Record<string, unknown>

  // 如果 process 不存在或 node 属性不存在，则创建完整的 polyfill
  if (!win.process || typeof (win.process as Record<string, unknown>).node === 'undefined') {
    win.process = {
      env: {
        NODE_ENV: 'development',
        DEBUG: undefined,
        PRODUCTION: false,
      },
      version: 'v18.0.0',
      platform: 'browser',
      arch: 'unknown',
      node: false,
      title: 'browser',
      browser: true,
      argv: [],
      execPath: '',
      cwd: () => '/',
      nextTick: (cb: (...args: unknown[]) => void, ...args: unknown[]) => {
        setTimeout(() => cb(...args), 0)
      },
      stdout: {
        write: (s: string) => logger.info(s),
        writeLine: (s?: string) => logger.info(s ?? ''),
      },
      stderr: {
        write: (s: string) => logger.error(s),
        writeLine: (s?: string) => logger.error(s ?? ''),
      },
      stdin: {} as Record<string, unknown>,
      exit: (code?: number) => {
        if (code && code !== 0) throw new Error(`Process exited with code ${code}`)
      },
      on: () => {},
      off: () => {},
      removeAllListeners: () => {},
      emit: () => false,
      listeners: () => [] as unknown[],
      once: () => {},
      prependListener: () => {},
      prependOnceListener: () => {},
      removeListener: () => {},
      uptime: () => Math.floor(performance.now() / 1000),
      memoryUsage: () => ({
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0,
      }),
      hrtime: (time?: [number, number]): [number, number] => {
        const now = performance.now() * 1e-6
        if (!time) return [Math.floor(now), (now % 1) * 1e9]
        const diff = now - (time[0] + time[1] * 1e-9)
        return [Math.floor(diff), (diff % 1) * 1e9]
      },
    }

    logger.debug('已注入 Node.js process polyfill 到浏览器环境')
  }
}

/**
 * 动态导入 ExcelJS
 * 用于 Excel 文件导出功能
 * 注意：必须在导入前确保 process 对象存在
 */
export async function importExcelJS(): Promise<typeof import('exceljs')> {
  const cacheKey = 'exceljs'

  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey) as typeof import('exceljs')
  }

  try {
    logger.debug('动态加载 ExcelJS 模块')

    ensureProcessPolyfill()
    const exceljs = await import('exceljs')
    moduleCache.set(cacheKey, exceljs)

    logger.info('ExcelJS 模块加载成功')
    return exceljs
  } catch (error) {
    logger.error('加载 ExcelJS 失败', error)
    throw new Error('无法加载 ExcelJS 库，请检查网络连接或重新安装依赖')
  }
}

/**
 * 动态导入 JSPDF
 * 用于 PDF 文件导出功能
 */
export async function importJSPDF(): Promise<typeof import('jspdf')> {
  const cacheKey = 'jspdf'

  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey) as typeof import('jspdf')
  }

  try {
    logger.debug('动态加载 JSPDF 模块')
    const jspdf = await import('jspdf')
    moduleCache.set(cacheKey, jspdf)
    return jspdf
  } catch (error) {
    logger.error('加载 JSPDF 失败', error)
    throw new Error('无法加载 JSPDF 库，请检查网络连接或重新安装依赖')
  }
}

/**
 * 动态导入 JSPDF AutoTable 插件
 */
export async function importJSPDFAutoTable(): Promise<typeof import('jspdf-autotable')> {
  const cacheKey = 'jspdf-autotable'

  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey) as typeof import('jspdf-autotable')
  }

  try {
    logger.debug('动态加载 JSPDF AutoTable 模块')
    const autoTable = await import('jspdf-autotable')
    moduleCache.set(cacheKey, autoTable)
    return autoTable
  } catch (error) {
    logger.error('加载 JSPDF AutoTable 失败', error)
    throw new Error('无法加载 JSPDF AutoTable 插件')
  }
}

/**
 * 动态导入 DOCX 库
 * 用于 Word 文档导出功能
 */
export async function importDOCX(): Promise<typeof import('docx')> {
  const cacheKey = 'docx'

  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey) as typeof import('docx')
  }

  try {
    logger.debug('动态加载 DOCX 模块')
    const docx = await import('docx')
    moduleCache.set(cacheKey, docx)
    return docx
  } catch (error) {
    logger.error('加载 DOCX 失败', error)
    throw new Error('无法加载 DOCX 库')
  }
}

/**
 * 动态导入 html2canvas
 * 用于截图和导出图片功能
 */
export async function importHtml2Canvas(): Promise<typeof import('html2canvas')> {
  const cacheKey = 'html2canvas'

  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey) as typeof import('html2canvas')
  }

  try {
    logger.debug('动态加载 html2canvas 模块')
    const html2canvas = await import('html2canvas')
    moduleCache.set(cacheKey, html2canvas)
    return html2canvas
  } catch (error) {
    logger.error('加载 html2canvas 失败', error)
    throw new Error('无法加载 html2canvas 库')
  }
}

/**
 * 清除所有缓存的模块
 * 用于内存管理或强制刷新
 */
export function clearModuleCache(): void {
  moduleCache.clear()
  logger.info('模块缓存已清除')
}

/**
 * 获取当前缓存状态
 */
export function getModuleCacheStatus(): { size: number; keys: string[] } {
  return {
    size: moduleCache.size,
    keys: Array.from(moduleCache.keys()),
  }
}
