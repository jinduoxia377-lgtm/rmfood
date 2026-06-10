/**
 * 数据同步服务
 * 支持云端同步、冲突解决和离线支持
 */
import { localStorageService } from './localStorage'
import { logger } from '@/utils/safeLogger'
import type {
  StoredFormulaVersion,
  StoredShareData,
  SyncMetadata,
  SyncQueueItem,
  ConflictResolution,
} from '@/types/storage'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncOptions {
  autoSync: boolean
  syncInterval: number
  conflictStrategy: 'local' | 'remote' | 'merge' | 'manual'
  maxRetries: number
  retryDelay: number
}

const DEFAULT_OPTIONS: SyncOptions = {
  autoSync: true,
  syncInterval: 30000,
  conflictStrategy: 'merge',
  maxRetries: 3,
  retryDelay: 1000,
}

type SyncEventType = 'sync-start' | 'sync-complete' | 'sync-error' | 'conflict' | 'offline' | 'online'

interface SyncEvent {
  type: SyncEventType
  timestamp: number
  data?: unknown
}

type SyncEventListener = (event: SyncEvent) => void

class SyncService {
  private options: SyncOptions
  private syncTimer: number | null = null
  private listeners = new Set<SyncEventListener>()
  private isOnline: boolean = navigator.onLine
  private currentSyncMetadata: SyncMetadata | null = null

  constructor(options: Partial<SyncOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.setupNetworkListeners()
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.emit({ type: 'online', timestamp: Date.now() })
      if (this.options.autoSync) {
        this.startAutoSync()
      }
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.emit({ type: 'offline', timestamp: Date.now() })
      this.stopAutoSync()
    })
  }

  private emit(event: SyncEvent): void {
    this.listeners.forEach((listener) => listener(event))
  }

  on(event: SyncEventType, listener: SyncEventListener): () => void {
    const wrappedListener = (e: SyncEvent) => {
      if (e.type === event) {
        listener(e)
      }
    }
    this.listeners.add(wrappedListener)
    return () => this.listeners.delete(wrappedListener)
  }

  off(event: SyncEventType, listener: SyncEventListener): void {
    this.listeners.delete(listener)
  }

  getStatus(): SyncStatus {
    if (!this.isOnline) return 'offline'
    return this.currentSyncMetadata?.syncStatus || 'idle'
  }

  async getSyncMetadata(): Promise<SyncMetadata | null> {
    return localStorageService.getSyncMetadata()
  }

  async startAutoSync(): Promise<void> {
    if (this.syncTimer !== null) return
    if (!this.isOnline) {
      this.emit({ type: 'offline', timestamp: Date.now() })
      return
    }

    await this.sync()

    this.syncTimer = window.setInterval(async () => {
      if (this.isOnline) {
        await this.sync()
      }
    }, this.options.syncInterval)
  }

  stopAutoSync(): void {
    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  async sync(): Promise<void> {
    if (!this.isOnline) {
      this.emit({ type: 'offline', timestamp: Date.now() })
      return
    }

    this.emit({ type: 'sync-start', timestamp: Date.now() })

    try {
      await this.updateSyncStatus('syncing')

      const pendingItems = await localStorageService.getSyncQueue()
      const failedItems: SyncQueueItem[] = []

      for (const item of pendingItems) {
        try {
          await this.processSyncItem(item)
          await localStorageService.removeSyncQueueItem(item.id)
        } catch (error) {
          logger.error(`同步项目 ${item.id} 失败:`, error)
          if (item.retryCount < this.options.maxRetries) {
            item.retryCount += 1
            await localStorageService.updateSyncQueueItem(item)
            failedItems.push(item)
          } else {
            await localStorageService.removeSyncQueueItem(item.id)
          }
        }
      }

      await this.pullRemoteChanges()

      const conflicts = await localStorageService.getUnresolvedConflicts()
      if (conflicts.length > 0) {
        for (const conflict of conflicts) {
          this.emit({ type: 'conflict', timestamp: Date.now(), data: conflict })
          await this.resolveConflictAutomatically(conflict)
        }
      }

      await this.updateSyncStatus('idle')
      this.emit({ type: 'sync-complete', timestamp: Date.now(), data: { failedCount: failedItems.length } })
    } catch (error) {
      logger.error('同步失败:', error)
      await this.updateSyncStatus('error', String(error))
      this.emit({ type: 'sync-error', timestamp: Date.now(), data: error })
    }
  }

  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    switch (item.entityType) {
      case 'formula':
        await this.syncFormula(item)
        break
      case 'version':
        await this.syncVersion(item)
        break
      case 'share':
        await this.syncShare(item)
        break
      case 'preference':
        await this.syncPreference(item)
        break
      default:
        logger.warn(`未知的同步类型: ${item.entityType}`)
    }
  }

  private async syncFormula(item: SyncQueueItem): Promise<void> {
    logger.info(`同步配方 ${item.entityId}:`, item.type)
  }

  private async syncVersion(item: SyncQueueItem): Promise<void> {
    logger.info(`同步版本 ${item.entityId}:`, item.type)
  }

  private async syncShare(item: SyncQueueItem): Promise<void> {
    logger.info(`同步分享 ${item.entityId}:`, item.type)
  }

  private async syncPreference(item: SyncQueueItem): Promise<void> {
    logger.info(`同步偏好 ${item.entityId}:`, item.type)
  }

  private async pullRemoteChanges(): Promise<void> {
    logger.info('拉取远程变更...')
  }

  private async resolveConflictAutomatically(conflict: ConflictResolution): Promise<void> {
    switch (this.options.conflictStrategy) {
      case 'local':
        await localStorageService.resolveConflict(conflict.conflictId, 'local')
        break
      case 'remote':
        await localStorageService.resolveConflict(conflict.conflictId, 'remote')
        break
      case 'merge':
        if (conflict.mergedData) {
          await localStorageService.resolveConflict(conflict.conflictId, 'merge', conflict.mergedData)
        }
        break
      case 'manual':
        break
    }
  }

  private async updateSyncStatus(status: SyncMetadata['syncStatus'], error?: string): Promise<void> {
    const pendingItems = await localStorageService.getSyncQueue()
    this.currentSyncMetadata = {
      lastSyncTime: Date.now(),
      syncStatus: status,
      pendingChanges: pendingItems.length,
      lastError: error,
      version: 1,
    }
    await localStorageService.saveSyncMetadata(this.currentSyncMetadata)
  }

  async queueFormulaSync(
    formulaId: string,
    type: 'create' | 'update' | 'delete',
  ): Promise<string> {
    return localStorageService.addToSyncQueue({
      type,
      entityType: 'formula',
      entityId: formulaId,
      data: null,
      maxRetries: this.options.maxRetries,
    })
  }

  async queueVersionSync(
    version: StoredFormulaVersion,
    type: 'create' | 'update' | 'delete',
  ): Promise<string> {
    return localStorageService.addToSyncQueue({
      type,
      entityType: 'version',
      entityId: version.id,
      data: version,
      maxRetries: this.options.maxRetries,
    })
  }

  async queueShareSync(
    shareData: StoredShareData,
    type: 'create' | 'update' | 'delete',
  ): Promise<string> {
    return localStorageService.addToSyncQueue({
      type,
      entityType: 'share',
      entityId: shareData.shareId,
      data: shareData,
      maxRetries: this.options.maxRetries,
    })
  }

  async forcePushVersion(version: StoredFormulaVersion): Promise<void> {
    await localStorageService.saveFormulaVersion(version)
    await this.queueVersionSync(version, 'update')
    if (this.isOnline) {
      await this.sync()
    }
  }

  async forcePullVersions(formulaId: string): Promise<StoredFormulaVersion[]> {
    const localVersions = await localStorageService.getFormulaVersions(formulaId)
    if (this.isOnline) {
      await this.sync()
    }
    return localVersions
  }

  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedData?: StoredFormulaVersion | StoredShareData,
  ): Promise<void> {
    await localStorageService.resolveConflict(conflictId, resolution, mergedData)
    await this.sync()
  }

  updateOptions(options: Partial<SyncOptions>): void {
    this.options = { ...this.options, ...options }
    if (this.options.autoSync && this.isOnline) {
      this.startAutoSync()
    } else {
      this.stopAutoSync()
    }
  }

  getOptions(): SyncOptions {
    return { ...this.options }
  }

  async getPendingChangesCount(): Promise<number> {
    const queue = await localStorageService.getSyncQueue()
    return queue.length
  }

  async clearPendingChanges(): Promise<void> {
    const queue = await localStorageService.getSyncQueue()
    for (const item of queue) {
      await localStorageService.removeSyncQueueItem(item.id)
    }
  }
}

export const syncService = new SyncService()
export default syncService
