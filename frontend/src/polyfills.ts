import { logger } from '@/utils/safeLogger';

/**
 * 浏览器环境 Polyfills
 * 为 Node.js 依赖库提供兼容性支持
 */

// Process polyfill - 用于 ExcelJS 等库
if (typeof (globalThis as Record<string, unknown>).process === 'undefined') {
  (globalThis as Record<string, unknown>).process = {
    env: {
      NODE_ENV: import.meta.env?.MODE || 'development',
      DEBUG: undefined,
      PRODUCTION: import.meta.env?.PROD || false,
    },
    version: 'v18.0.0',
    platform: 'browser' as const,
    arch: 'unknown' as string,
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
      write: (data: string) => logger.info(data),
      writeLine: (data?: string) => logger.info(data ?? ''),
    },
    stderr: {
      write: (data: string) => logger.error(data),
      writeLine: (data?: string) => logger.error(data ?? ''),
    },
    stdin: {},
    exit: (code?: number) => {
      if (code && code !== 0) {
        throw new Error(`Process exited with code ${code}`)
      }
    },
    on: (_event: string, _listener: unknown) => {},
    off: (_event: string, _listener: unknown) => {},
    removeAllListeners: (_event?: string) => {},
    emit: (_event: string, ..._args: unknown[]) => false,
    listeners: (_event: string) => [],
    once: (_event: string, _listener: unknown) => {},
    prependListener: (_event: string, _listener: unknown) => {},
    prependOnceListener: (_event: string, _listener: unknown) => {},
    removeListener: (_event: string, _listener: unknown) => {},
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
}

// Global polyfill
if (typeof global === 'undefined') {
  (globalThis as Record<string, unknown>).global = globalThis
}

// Buffer polyfill (如果需要)
if (typeof Buffer === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as Record<string, unknown>).Buffer = {
    from: (data: ArrayBuffer | string | number[], encoding?: BufferEncoding): Uint8Array => {
      if (typeof data === 'string') {
        if (encoding === 'base64') {
          const binaryString = atob(data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          return bytes
        }
        return new TextEncoder().encode(data)
      }
      if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data)
      }
      return new Uint8Array(data)
    },
    alloc: (size: number): Uint8Array => new Uint8Array(size),
    concat: (buffers: Uint8Array[]): Uint8Array => {
      const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0)
      const result = new Uint8Array(totalLength)
      let offset = 0
      for (const buf of buffers) {
        result.set(buf, offset)
        offset += buf.length
      }
      return result
    },
    isBuffer: (obj: unknown): obj is Uint8Array => obj instanceof Uint8Array,
  }
}

// __dirname and __filename polyfill
if (typeof __dirname === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as Record<string, unknown>).__dirname = '/'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as Record<string, unknown>).__filename = '/'
}
