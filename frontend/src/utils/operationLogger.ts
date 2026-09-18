import type { OperationAction, OperationLogDetail } from '@/types/formula'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/safeLogger'
import { formulaApi } from '@/api/formula'

interface PendingOperationLog {
  id: string
  action: OperationAction | string
  target_type: string
  target_id: string
  target_name: string
  details?: OperationLogDetail | Record<string, unknown>
  result: 'success' | 'failure' | 'partial'
  error_message?: string
  operatorId: string
  operatorName: string
  operatorRole: string
  ip_address?: string
  user_agent?: string
  created_at: string
  metadata?: Record<string, unknown>
  isCustom?: boolean
}

const DB_NAME = 'rmfood_operation_logs'
const DB_STORE = 'logs'
const DB_VERSION = 1
const MAX_CACHE_SIZE = 1000
const FLUSH_INTERVAL_MS = 30000
const BATCH_SIZE = 50

class OperationLogger {
  private db: IDBDatabase | null = null
  private pendingQueue: PendingOperationLog[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private isFlushing = false
  private initialized = false

  constructor() {
    this.initDB()
    this.startFlushTimer()
    this.setupOnlineListener()
  }

  private async initDB(): Promise<void> {
    if (this.initialized) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        logger.error('[OperationLogger] Failed to open IndexedDB:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        this.initialized = true
        logger.info('[OperationLogger] IndexedDB initialized successfully')
        this.loadPendingLogs().then(resolve).catch(reject)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(DB_STORE)) {
          const store = db.createObjectStore(DB_STORE, { keyPath: 'id' })
          store.createIndex('created_at', 'created_at', { unique: false })
          store.createIndex('action', 'action', { unique: false })
          store.createIndex('operator_id', 'operatorId', { unique: false })
          store.createIndex('result', 'result', { unique: false })
        }
      }
    })
  }

  private async loadPendingLogs(): Promise<void> {
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DB_STORE], 'readonly')
      const store = transaction.objectStore(DB_STORE)
      const request = store.getAll()

      request.onsuccess = () => {
        this.pendingQueue = request.result || []
        if (this.pendingQueue.length > MAX_CACHE_SIZE) {
          this.pendingQueue = this.pendingQueue.slice(-MAX_CACHE_SIZE)
        }
        resolve()
      }

      request.onerror = () => {
        logger.error('[OperationLogger] Failed to load pending logs:', request.error)
        reject(request.error)
      }
    })
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return

    this.flushTimer = setInterval(() => {
      if (navigator.onLine) {
        this.flush()
      }
    }, FLUSH_INTERVAL_MS)
  }

  private setupOnlineListener(): void {
    window.addEventListener('online', () => {
      logger.info('[OperationLogger] Network online, flushing logs...')
      setTimeout(() => this.flush(), 1000)
    })
  }

  private getUserInfo(): { id: string; name: string; role: string } {
    try {
      const user = useAuthStore.getState().user
      if (user) {
        return {
          id: String(user.id),
          name: user.fullName || user.username || 'Unknown',
          role: String(user.role || 'unknown'),
        }
      }
    } catch (error) {
      logger.warn('[OperationLogger] Failed to get user info:', error)
    }
    return { id: 'anonymous', name: 'Anonymous', role: 'unknown' }
  }

  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  private async saveToIndexedDB(log: PendingOperationLog): Promise<void> {
    if (!this.db) {
      await this.initDB()
    }

    if (!this.db) {
      logger.warn('[OperationLogger] IndexedDB not available, skipping persistence')
      return
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DB_STORE], 'readwrite')
      const store = transaction.objectStore(DB_STORE)

      if (this.pendingQueue.length >= MAX_CACHE_SIZE) {
        const oldestLog = this.pendingQueue[0]
        store.delete(oldestLog.id)
      }

      const request = store.put(log)

      request.onsuccess = () => resolve()
      request.onerror = () => {
        logger.error('[OperationLogger] Failed to save log to IndexedDB:', request.error)
        reject(request.error)
      }
    })
  }

  private async removeFromIndexedDB(ids: string[]): Promise<void> {
    if (!this.db || ids.length === 0) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DB_STORE], 'readwrite')
      const store = transaction.objectStore(DB_STORE)

      ids.forEach((id) => store.delete(id))

      transaction.oncomplete = () => resolve()
      transaction.onerror = () => {
        logger.error('[OperationLogger] Failed to remove logs from IndexedDB:', transaction.error)
        reject(transaction.error)
      }
    })
  }

  log(params: {
    action: OperationAction
    target_type: 'formula' | 'ingredient' | 'template' | 'system'
    target_id: string
    target_name: string
    details?: OperationLogDetail
    result: 'success' | 'failure' | 'partial'
    error_message?: string
  }): void {
    const userInfo = this.getUserInfo()
    const logEntry: PendingOperationLog = {
      id: this.generateId(),
      ...params,
      operatorId: userInfo.id,
      operatorName: userInfo.name,
      operatorRole: userInfo.role,
      ip_address: undefined,
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString(),
    }

    this.addToQueue(logEntry)
  }

  logCustom(params: {
    action: string
    target_type: string
    target_id: string
    target_name: string
    metadata?: Record<string, unknown>
  }): void {
    const userInfo = this.getUserInfo()
    const logEntry: PendingOperationLog = {
      id: this.generateId(),
      action: params.action,
      target_type: params.target_type,
      target_id: params.target_id,
      target_name: params.target_name,
      result: 'success',
      operatorId: userInfo.id,
      operatorName: userInfo.name,
      operatorRole: userInfo.role,
      ip_address: undefined,
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString(),
      metadata: params.metadata,
      isCustom: true,
    }

    this.addToQueue(logEntry)
  }

  private addToQueue(log: PendingOperationLog): void {
    this.pendingQueue.push(log)

    if (this.pendingQueue.length > MAX_CACHE_SIZE) {
      const removed = this.pendingQueue.splice(0, this.pendingQueue.length - MAX_CACHE_SIZE)
      this.removeFromIndexedDB(removed.map((l) => l.id)).catch((err) =>
        logger.warn('[OperationLogger] Failed to remove overflow logs:', err),
      )
    }

    this.saveToIndexedDB(log).catch((err) =>
      logger.warn('[OperationLogger] Failed to persist log to IndexedDB:', err),
    )

    logger.debug(`[OperationLogger] Log queued: ${log.action} on ${log.target_type}/${log.target_name}`)
  }

  getPendingLogs(): PendingOperationLog[] {
    return [...this.pendingQueue]
  }

  async flush(): Promise<{ uploaded: number; failed: number }> {
    if (this.isFlushing || this.pendingQueue.length === 0) {
      return { uploaded: 0, failed: 0 }
    }

    this.isFlushing = true
    let uploaded = 0
    let failed = 0

    try {
      while (this.pendingQueue.length > 0) {
        const batch = this.pendingQueue.splice(0, BATCH_SIZE)
        const batchIds = batch.map((l) => l.id)

        try {
          const payload = batch.map((log) => ({
            action: log.action,
            target_type: log.target_type,
            target_id: log.target_id,
            target_name: log.target_name,
            details: log.details || {},
            result: log.result,
            error_message: log.error_message,
            operator_id: log.operatorId,
            operator_name: log.operatorName,
            operator_role: log.operatorRole,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            created_at: log.created_at,
            ...(log.metadata && { metadata: log.metadata }),
          }))

          await formulaApi.createBatchOperationLogs(payload as unknown as Array<{ action: string; target_type: string; target_id: string; target_name: string; details?: Record<string, unknown>; result: string; error_message?: string; operator_id: string; operator_name: string; operator_role: string; ip_address?: string; user_agent?: string; created_at: string; metadata?: Record<string, unknown> }>)
          uploaded += batch.length
          this.removeFromIndexedDB(batchIds).catch((err) =>
            logger.warn('[OperationLogger] Failed to remove uploaded logs from IndexedDB:', err),
          )
        } catch (error) {
          failed += batch.length
          this.pendingQueue.unshift(...batch)
          logger.error('[OperationLogger] Batch upload failed:', error)
          break
        }
      }

      if (uploaded > 0) {
        logger.info(`[OperationLogger] Flushed ${uploaded} logs (${failed} failed)`)
      }
    } catch (error) {
      logger.error('[OperationLogger] Flush error:', error)
    } finally {
      this.isFlushing = false
    }

    return { uploaded, failed }
  }

  clearUploaded(): void {
    this.pendingQueue = []

    if (this.db) {
      const transaction = this.db.transaction([DB_STORE], 'readwrite')
      const store = transaction.objectStore(DB_STORE)
      store.clear()

      transaction.oncomplete = () => {
        logger.info('[OperationLogger] All logs cleared')
      }

      transaction.onerror = () => {
        logger.error('[OperationLogger] Failed to clear logs:', transaction.error)
      }
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    if (navigator.onLine && this.pendingQueue.length > 0) {
      this.flush().catch((err) =>
        logger.warn('[OperationLogger] Final flush failed on destroy:', err),
      )
    }

    if (this.db) {
      this.db.close()
      this.db = null
    }

    this.initialized = false
  }
}

export const operationLogger = new OperationLogger()

export function useOperationLogger() {
  return {
    log: operationLogger.log.bind(operationLogger),
    logCustom: operationLogger.logCustom.bind(operationLogger),
  }
}

export function withOperationLogging<T extends (...args: any[]) => any>(
  action: OperationAction,
  targetType: string,
  fn: T,
): T {
  return ((...args: Parameters<T>) => {
    const targetId = String(args[0]?.id || args[0] || 'unknown')
    const targetName = String(args[0]?.name || args[0]?.title || targetId)

    let result: ReturnType<T>
    let logResult: 'success' | 'failure' | 'partial' = 'success'
    let errorMessage: string | undefined

    try {
      result = fn(...args)

// @ts-expect-error - See type definition
      if (result instanceof Promise) {
        return result
          .then((res: unknown) => {
            operationLogger.log({
              action,
              target_type: targetType as 'formula' | 'ingredient' | 'template' | 'system',
              target_id: targetId,
              target_name: targetName,
              result: 'success',
            })
            return res
          })
          .catch((error: Error) => {
            logResult = 'failure'
            errorMessage = error.message
            operationLogger.log({
              action,
              target_type: targetType as 'formula' | 'ingredient' | 'template' | 'system',
              target_id: targetId,
              target_name: targetName,
              result: 'failure',
              error_message: errorMessage,
            })
            throw error
          }) as ReturnType<T>
      }

      operationLogger.log({
        action,
        target_type: targetType as 'formula' | 'ingredient' | 'template' | 'system',
        target_id: targetId,
        target_name: targetName,
        result: 'success',
      })

      return result
    } catch (error: any) {
      logResult = 'failure'
      errorMessage = error?.message

      operationLogger.log({
        action,
        target_type: targetType as 'formula' | 'ingredient' | 'template' | 'system',
        target_id: targetId,
        target_name: targetName,
        result: 'failure',
        error_message: errorMessage,
      })

      throw error
    }
  }) as T
}

export default operationLogger
