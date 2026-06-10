/**
 * IndexedDB 本地存储服务
 * 提供配方数据的本地持久化和缓存
 */
import { logger } from '@/utils/safeLogger'
import {
  DATA_MIGRATIONS,
} from '@/types/storage'
import type {
  StoredUserPreference,
  StoredGenerationHistory,
  StoredFormulaVersion,
  StoredShareData,
  SyncMetadata,
  ConflictResolution,
  SyncQueueItem,
} from '@/types/storage'

const DB_NAME = 'rmfood_database'
const DB_VERSION = 1

class LocalStorageService {
  private db: IDBDatabase | null = null
  private dbPromise: Promise<IDBDatabase> | null = null

  async initDatabase(): Promise<IDBDatabase> {
    if (this.db) return this.db
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        logger.error('IndexedDB 初始化失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        logger.info('IndexedDB 初始化成功')
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        this.createStores(db)
      }
    })

    return this.dbPromise
  }

  private createStores(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains('user_preferences')) {
      const prefStore = db.createObjectStore('user_preferences', { keyPath: 'id' })
      prefStore.createIndex('lastUpdated', 'lastUpdated', { unique: false })
    }

    if (!db.objectStoreNames.contains('generation_history')) {
      const histStore = db.createObjectStore('generation_history', { keyPath: 'id' })
      histStore.createIndex('createdAt', 'createdAt', { unique: false })
      histStore.createIndex('liked', 'liked', { unique: false })
    }

    if (!db.objectStoreNames.contains('formula_versions')) {
      const verStore = db.createObjectStore('formula_versions', { keyPath: 'id' })
      verStore.createIndex('formulaId', 'formulaId', { unique: false })
      verStore.createIndex('createdAt', 'createdAt', { unique: false })
    }

    if (!db.objectStoreNames.contains('share_data')) {
      const shareStore = db.createObjectStore('share_data', { keyPath: 'shareId' })
      shareStore.createIndex('createdAt', 'createdAt', { unique: false })
      shareStore.createIndex('expiresAt', 'expiresAt', { unique: false })
    }

    if (!db.objectStoreNames.contains('sync_queue')) {
      const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' })
      syncStore.createIndex('timestamp', 'timestamp', { unique: false })
      syncStore.createIndex('entityType', 'entityType', { unique: false })
    }

    if (!db.objectStoreNames.contains('sync_metadata')) {
      db.createObjectStore('sync_metadata', { keyPath: 'id' })
    }

    if (!db.objectStoreNames.contains('conflicts')) {
      const conflictStore = db.createObjectStore('conflicts', { keyPath: 'conflictId' })
      conflictStore.createIndex('resolved', 'resolved', { unique: false })
    }
  }

  private async getStore(
    storeName: string,
    mode: IDBTransactionMode = 'readonly',
  ): Promise<IDBObjectStore> {
    const db = await this.initDatabase()
    const transaction = db.transaction(storeName, mode)
    return transaction.objectStore(storeName)
  }

  async saveUserPreference(preference: StoredUserPreference): Promise<void> {
    const store = await this.getStore('user_preferences', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put({ id: 'current', ...preference })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getUserPreference(): Promise<StoredUserPreference | null> {
    const store = await this.getStore('user_preferences')
    return new Promise((resolve, reject) => {
      const request = store.get('current')
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async saveGenerationHistory(history: StoredGenerationHistory): Promise<void> {
    const store = await this.getStore('generation_history', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(history)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async saveGenerationHistories(histories: StoredGenerationHistory[]): Promise<void> {
    const db = await this.initDatabase()
    const transaction = db.transaction('generation_history', 'readwrite')
    const store = transaction.objectStore('generation_history')

    return new Promise((resolve, reject) => {
      histories.forEach((h) => store.put(h))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async getGenerationHistory(): Promise<StoredGenerationHistory[]> {
    const store = await this.getStore('generation_history')
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const results = request.result.sort((a, b) => b.createdAt - a.createdAt)
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getGenerationHistoryById(id: string): Promise<StoredGenerationHistory | null> {
    const store = await this.getStore('generation_history')
    return new Promise((resolve, reject) => {
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async deleteGenerationHistory(id: string): Promise<void> {
    const store = await this.getStore('generation_history', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clearGenerationHistory(): Promise<void> {
    const store = await this.getStore('generation_history', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async saveFormulaVersion(version: StoredFormulaVersion): Promise<void> {
    const store = await this.getStore('formula_versions', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(version)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getFormulaVersions(formulaId: string): Promise<StoredFormulaVersion[]> {
    const store = await this.getStore('formula_versions')
    const index = store.index('formulaId')
    return new Promise((resolve, reject) => {
      const request = index.getAll(formulaId)
      request.onsuccess = () => {
        const results = request.result.sort((a, b) => b.versionNumber - a.versionNumber)
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async getFormulaVersionById(id: string): Promise<StoredFormulaVersion | null> {
    const store = await this.getStore('formula_versions')
    return new Promise((resolve, reject) => {
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async deleteFormulaVersion(id: string): Promise<void> {
    const store = await this.getStore('formula_versions', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async saveShareData(shareData: StoredShareData): Promise<void> {
    const store = await this.getStore('share_data', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(shareData)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getShareData(shareId: string): Promise<StoredShareData | null> {
    const store = await this.getStore('share_data')
    return new Promise((resolve, reject) => {
      const request = store.get(shareId)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async getAllShareData(): Promise<StoredShareData[]> {
    const store = await this.getStore('share_data')
    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async deleteShareData(shareId: string): Promise<void> {
    const store = await this.getStore('share_data', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(shareId)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async updateShareViewCount(shareId: string): Promise<void> {
    const store = await this.getStore('share_data', 'readwrite')
    return new Promise((resolve, reject) => {
      const getRequest = store.get(shareId)
      getRequest.onsuccess = () => {
        const data = getRequest.result
        if (data) {
          data.viewCount += 1
          const putRequest = store.put(data)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const store = await this.getStore('sync_queue', 'readwrite')
    const queueItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
      retryCount: 0,
    }
    return new Promise((resolve, reject) => {
      const request = store.put(queueItem)
      request.onsuccess = () => resolve(queueItem.id)
      request.onerror = () => reject(request.error)
    })
  }

  async getSyncQueue(entityType?: string): Promise<SyncQueueItem[]> {
    const store = await this.getStore('sync_queue')
    return new Promise((resolve, reject) => {
      if (entityType) {
        const index = store.index('entityType')
        const request = index.getAll(entityType)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      } else {
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }
    })
  }

  async removeSyncQueueItem(id: string): Promise<void> {
    const store = await this.getStore('sync_queue', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
    const store = await this.getStore('sync_queue', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put(item)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getSyncMetadata(): Promise<SyncMetadata | null> {
    const store = await this.getStore('sync_metadata')
    return new Promise((resolve, reject) => {
      const request = store.get('sync_status')
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
    const store = await this.getStore('sync_metadata', 'readwrite')
    return new Promise((resolve, reject) => {
      const request = store.put({ id: 'sync_status', ...metadata })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async addConflict(conflict: Omit<ConflictResolution, 'conflictId' | 'timestamp'>): Promise<string> {
    const store = await this.getStore('conflicts', 'readwrite')
    const conflictItem: ConflictResolution = {
      ...conflict,
      conflictId: `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
    }
    return new Promise((resolve, reject) => {
      const request = store.put(conflictItem)
      request.onsuccess = () => resolve(conflictItem.conflictId)
      request.onerror = () => reject(request.error)
    })
  }

  async getUnresolvedConflicts(): Promise<ConflictResolution[]> {
    const store = await this.getStore('conflicts')
    const index = store.index('resolved')
    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(false))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async resolveConflict(
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge',
    mergedData?: StoredFormulaVersion | StoredShareData,
  ): Promise<void> {
    const store = await this.getStore('conflicts', 'readwrite')
    return new Promise((resolve, reject) => {
      const getRequest = store.get(conflictId)
      getRequest.onsuccess = () => {
        const conflict = getRequest.result
        if (conflict) {
          conflict.resolved = true
          conflict.resolution = resolution
          if (mergedData) {
            conflict.mergedData = mergedData
          }
          const putRequest = store.put(conflict)
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          resolve()
        }
      }
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  async clearAllData(): Promise<void> {
    const db = await this.initDatabase()
    const storeNames = Array.from(db.objectStoreNames)

    for (const storeName of storeNames) {
      const store = await this.getStore(storeName, 'readwrite')
      await new Promise<void>((resolve, reject) => {
        const request = store.clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
  }

  async getStorageUsage(): Promise<{ used: number; quota: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate()
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
      }
    }
    return { used: 0, quota: 0 }
  }

  async runMigrations(): Promise<void> {
    const db = await this.initDatabase()
    const currentVersion = db.version

    for (const migration of DATA_MIGRATIONS) {
      if (migration.fromVersion === currentVersion) {
        logger.info(`运行数据迁移: v${migration.fromVersion} -> v${migration.toVersion}`)
        await migration.migrate(db)
      }
    }
  }
}

export const localStorageService = new LocalStorageService()
export default localStorageService
