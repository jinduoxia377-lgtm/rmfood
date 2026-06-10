import { logger } from '@/utils/safeLogger'
import { eventBus, IEventBus } from '../services/eventBus'

type SyncStatus = 'online' | 'offline' | 'syncing' | 'error'
interface QueueItem {
  id: string
  type: 'message' | 'action'
  payload: any
  timestamp: number
  retryCount: number
  priority?: 'high' | 'medium' | 'low'
}

interface OfflineConfig {
  enabled: boolean
  maxQueueSize: number
  maxRetries: number
  retryDelayMs: number
  syncOnResume: boolean
  storageKey: string
  onStatusChange?: (status: SyncStatus) => void
  onSyncComplete?: (successCount: number, failCount: number) => void
}

class OfflineManager {
  private config: OfflineConfig
  private status: SyncStatus = 'online'
  private pendingQueue: QueueItem[] = []
  private isOnline = true
  private syncInProgress = false
  private eventBus: IEventBus

  constructor(config: Partial<OfflineConfig> = {}) {
    this.config = {
      enabled: true,
      maxQueueSize: 100,
      maxRetries: 3,
      retryDelayMs: 1000,
      syncOnResume: true,
      storageKey: 'rmfood_offline_queue',
      ...config,
    }

    this.eventBus = eventBus

    if (typeof window !== 'undefined') {
      this.initialize()
    }
  }

  private initialize(): void {
    if (!this.config.enabled) return

    this.loadQueueFromStorage()
    this.setupNetworkListeners()

    if (!navigator.onLine) {
      this.setStatus('offline')
    }

    logger.info('[OfflineManager] 初始化离线管理', {
      queueSize: this.pendingQueue.length,
      isOnline: navigator.onLine,
    })
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        this.syncPendingItems()
      }
    })
  }

  private handleOnline(): void {
    logger.info('[OfflineManager] 网络已恢复')
    this.isOnline = true

    if (this.config.syncOnResume) {
      this.syncPendingItems()
    }
  }

  private handleOffline(): void {
    logger.warn('[OfflineManager] 网络连接断开')
    this.isOnline = false
    this.setStatus('offline')
  }

  setStatus(status: SyncStatus): void {
    const previousStatus = this.status
    this.status = status

    logger.info(`[OfflineManager] 状态变更: ${previousStatus} → ${status}`)

    this.eventBus.emit('state:changed', {
      newState: `offline_${status}`,
      previousState: `offline_${previousStatus}`,
    })

    this.config.onStatusChange?.(status)
  }

  getStatus(): SyncStatus {
    return this.status
  }

  isOnlineStatus(): boolean {
    return this.isOnline
  }

  async enqueue<T>(type: 'message' | 'action', payload: T): Promise<string> {
    if (!this.config.enabled) {
      throw new Error('离线模式未启用')
    }

    const item: QueueItem = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    }

    if (this.pendingQueue.length >= this.config.maxQueueSize) {
      const removed = this.pendingQueue.shift()
      logger.warn(`[OfflineManager] 队列已满，移除最旧项: ${removed?.id}`)
    }

    this.pendingQueue.push(item)
    await this.persistQueue()

    this.eventBus.emit('export:started', {
      format: 'offline-queue',
      itemCount: this.pendingQueue.length,
    })

    logger.debug(`[OfflineManager] 新增队列项 [${type}]: ${item.id}`, {
      queueLength: this.pendingQueue.length,
    })

    if (this.isOnline && !this.syncInProgress) {
      this.syncPendingItems()
    }

    return item.id
  }

  removeItem(id: string): boolean {
    const index = this.pendingQueue.findIndex(item => item.id === id)
    if (index > -1) {
      this.pendingQueue.splice(index, 1)
      this.persistQueue()
      return true
    }
    return false
  }

  clearQueue(): void {
    const count = this.pendingQueue.length
    this.pendingQueue = []
    localStorage.removeItem(this.config.storageKey)
    logger.info(`[OfflineManager] 队列已清空 (${count} 项)`)
  }

  getQueueSize(): number {
    return this.pendingQueue.length
  }

  getPendingItems(): readonly QueueItem[] {
    return [...this.pendingQueue]
  }

  async syncPendingItems(): Promise<{ success: number; failed: number }> {
    if (this.syncInProgress || this.pendingQueue.length === 0) {
      return { success: 0, failed: 0 }
    }

    this.syncInProgress = true
    this.setStatus('syncing')

    let successCount = 0
    let failedCount = 0
    const failedItems: QueueItem[] = []

    logger.info(`[OfflineManager] 开始同步队列 (${this.pendingQueue.length} 项)`)

    for (const item of [...this.pendingQueue]) {
      try {
        await this.processItem(item)

        const index = this.pendingQueue.findIndex(i => i.id === item.id)
        if (index > -1) {
          this.pendingQueue.splice(index, 1)
        }

        successCount++
        logger.debug(`[OfflineManager] 同步成功: ${item.id}`)
      } catch (error) {
        item.retryCount++

        if (item.retryCount < this.config.maxRetries) {
          failedItems.push(item)
          logger.warn(
            `[OfflineManager] 同步失败，将重试 [${item.id}, 第${item.retryCount}次]:`,
            error,
          )

          await this.delay(this.config.retryDelayMs * item.retryCount)
        } else {
          failedCount++
          logger.error(
            `[OfflineManager] 同步最终失败 [${item.id}, 已重试${item.retryCount}次]:`,
            error,
          )

          this.eventBus.emit('message:error', {
            error: error as Error,
            messageId: item.id,
          })
        }
      }
    }

    this.pendingQueue = failedItems
    await this.persistQueue()

    this.syncInProgress = false

    if (!this.isOnline) {
      this.setStatus('offline')
    } else {
      this.setStatus('online')
    }

    logger.info(`[OfflineManager] 同步完成 (成功: ${successCount}, 失败: ${failedCount})`)

    this.eventBus.emit('export:completed', {
      filePath: '',
      success: failedCount === 0,
    })

    this.config.onSyncComplete?.(successCount, failedCount)

    return { success: successCount, failed: failedCount }
  }

  private async processItem(item: QueueItem): Promise<void> {
    switch (item.type) {
      case 'message':
        await this.syncMessage(item.payload)
        break
      case 'action':
        await this.syncAction(item.payload)
        break
      default:
        throw new Error(`未知队列项类型: ${(item as any).type}`)
    }
  }

  private async syncMessage(payload: any): Promise<void> {
    const response = await fetch('/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      },
      body: JSON.stringify({ question: payload.question }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    this.eventBus.emit('message:received', {
      content: data.content,
      senderId: 'assistant',
      timestamp: Date.now(),
      ...(data.formulas && { formulas: data.formulas }),
    })
  }

  private async syncAction(payload: any): Promise<void> {
    switch (payload.action) {
      case 'export':
        logger.info(`[OfflineManager] 同步导出操作:`, payload.format)
        break
      case 'clear_history':
        logger.info('[OfflineManager] 同步清空历史操作')
        break
      default:
        logger.warn(`[OfflineManager] 未知操作类型: ${payload.action}`)
    }
  }

  private async persistQueue(): Promise<void> {
    try {
      localStorage.setItem(
        this.config.storageKey,
        JSON.stringify({
          version: '1.0',
          timestamp: Date.now(),
          items: this.pendingQueue,
        }),
      )
    } catch (error) {
      logger.error('[OfflineManager] 持久化队列失败:', error)

      if ((error as any).name === 'QuotaExceededError') {
        this.handleQuotaExceeded()
      }
    }
  }

  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.config.storageKey)
      if (!stored) return

      const parsed = JSON.parse(stored)
      if (parsed.items && Array.isArray(parsed.items)) {
        this.pendingQueue = parsed.items

        logger.info(`[OfflineManager] 从存储恢复队列 (${this.pendingQueue.length} 项)`)

        if (parsed.timestamp) {
          const ageMinutes = (Date.now() - parsed.timestamp) / (1000 * 60)
          if (ageMinutes > 60) {
            logger.warn(`[OfflineManager] 队列数据较旧 (${ageMinutes.toFixed(0)} 分钟前)`)
          }
        }
      }
    } catch (error) {
      logger.error('[OfflineManager] 加载队列失败:', error)
      this.pendingQueue = []
    }
  }

  private handleQuotaExceeded(): void {
    logger.warn('[OfflineManager] 存储配额不足，清理旧数据')

    const sortedByTime = [...this.pendingQueue].sort((a, b) => a.timestamp - b.timestamp)
    const toRemove = Math.ceil(sortedByTime.length * 0.3)

    this.pendingQueue = sortedByTime.slice(toRemove)

    this.persistQueue().catch(err => {
      logger.error('[OfflineManager] 清理后持久化仍失败:', err)
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  getStatistics(): {
    queueSize: number
    status: SyncStatus
    oldestItemAge: number | null
    retryStats: { total: number; avg: number; max: number }
  } {
    const now = Date.now()
    const retries = this.pendingQueue.map(item => item.retryCount)

    return {
      queueSize: this.pendingQueue.length,
      status: this.status,
      oldestItemAge: this.pendingQueue.length > 0
        ? now - Math.min(...this.pendingQueue.map(item => item.timestamp))
        : null,
      retryStats: {
        total: retries.reduce((sum, r) => sum + r, 0),
        avg: retries.length > 0 ? retries.reduce((a, b) => a + b, 0) / retries.length : 0,
        max: retries.length > 0 ? Math.max(...retries) : 0,
      },
    }
  }

  destroy(): void {
    window.removeEventListener('online', this.handleOnline.bind(this))
    window.removeEventListener('offline', this.handleOffline.bind(this))

    if (this.syncInProgress) {
      this.syncInProgress = false
    }

    this.clearQueue()
    logger.info('[OfflineManager] 实例已销毁')
  }
}

export { OfflineManager, type OfflineConfig, type SyncStatus, type QueueItem }
export default OfflineManager
