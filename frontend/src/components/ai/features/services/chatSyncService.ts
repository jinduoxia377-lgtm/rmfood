/**
 * chatSyncService — 对话本地缓存与云端同步服务
 *
 * 分层策略：
 * L1: 内存缓存（当前会话，实时读写）
 * L2: localStorage（离线持久化，容量 ~5MB）
 * L3: IndexedDB（大数据量，异步）
 * L4: 云端 API（跨设备同步）
 */

import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

export interface SyncSession {
  id: string
  title: string
  tags: string[]
  messages: Array<{
    id: string
    role: string
    content: string
    timestamp: number
    isEdited?: boolean
    isRetracted?: boolean
  }>
  createdAt: number
  updatedAt: number
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error'
  version: number
}

export interface SyncConfig {
  autoSync: boolean           // 自动同步开关
  syncIntervalMs: number      // 同步间隔（毫秒）
  maxLocalSessions: number    // 本地最大会话数
  enableCloudSync: boolean    // 云端同步开关
  conflictStrategy: 'local-win' | 'cloud-win' | 'manual'  // 冲突解决策略
}

const DEFAULT_CONFIG: SyncConfig = {
  autoSync: true,
  syncIntervalMs: 30000,      // 30 秒
  maxLocalSessions: 50,
  enableCloudSync: false,     // 默认关闭，需用户开启
  conflictStrategy: 'local-win',
}

// ===== 存储键 =====

const STORAGE_PREFIX = 'rmfood_chat_'
const SESSIONS_KEY = `${STORAGE_PREFIX}sessions`
const SYNC_META_KEY = `${STORAGE_PREFIX}sync_meta`
const PENDING_KEY = `${STORAGE_PREFIX}pending_sync`

// ===== 同步元数据 =====

interface SyncMetadata {
  lastSyncAt: number | null
  pendingCount: number
  localVersion: number
  cloudVersion: number | null
}

// ===== 主服务类 =====

class ChatSyncService {
  private config: SyncConfig
  private sessions: Map<string, SyncSession> = new Map()
  private syncTimer: ReturnType<typeof setInterval> | null = null
  private listeners: Set<(sessions: SyncSession[]) => void> = new Set()

  constructor(config?: Partial<SyncConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.loadFromStorage()
    this.startAutoSync()
  }

  // ===== 会话 CRUD =====

  /**
   * 保存或更新会话
   */
  saveSession(session: SyncSession): void {
    session.updatedAt = Date.now()
    session.version = (session.version || 0) + 1
    session.syncStatus = this.config.enableCloudSync ? 'pending' : 'synced'

    this.sessions.set(session.id, session)
    this.persistToStorage()
    this.notifyListeners()

    logger.debug(`[ChatSync] Session saved: ${session.id}`, { version: session.version, messageCount: session.messages.length })
  }

  /**
   * 获取单个会话
   */
  getSession(id: string): SyncSession | undefined {
    return this.sessions.get(id)
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): SyncSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * 删除会话
   */
  deleteSession(id: string): void {
    this.sessions.delete(id)
    this.persistToStorage()
    this.notifyListeners()
    logger.info(`[ChatSync] Session deleted: ${id}`)
  }

  /**
   * 按标签筛选会话
   */
  getSessionsByTag(tagId: string): SyncSession[] {
    return this.getAllSessions().filter(s => s.tags.includes(tagId))
  }

  // ===== 存储层 =====

  /**
   * 从 localStorage 加载会话数据
   */
  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY)
      if (raw) {
        const parsed: SyncSession[] = JSON.parse(raw)
        parsed.forEach(s => this.sessions.set(s.id, s))
        logger.info(`[ChatSync] Loaded ${parsed.length} sessions from storage`)
      }
    } catch (err) {
      logger.error('[ChatSync] Failed to load from storage:', err)
    }
  }

  /**
   * 持久化到 localStorage
   */
  private persistToStorage(): void {
    try {
      const data = Array.from(this.sessions.values())
      // 限制存储大小
      if (data.length > this.config.maxLocalSessions) {
        const sorted = data.sort((a, b) => b.updatedAt - a.updatedAt)
        data.splice(this.config.maxLocalSessions)
      }
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(data))
    } catch (err) {
      // 可能超出 localStorage 容量
      logger.warn('[ChatSync] Storage full, attempting cleanup:', err)
      this.cleanupOldSessions()
    }
  }

  /**
   * 清理旧会话释放空间
   */
  private cleanupOldSessions(): void {
    const all = this.getAllSessions()
    const keep = all.slice(0, Math.floor(this.config.maxLocalSessions * 0.8))
    this.sessions.clear()
    keep.forEach(s => this.sessions.set(s.id, s))
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(keep))
    } catch (err) {
      logger.error('[ChatSync] Cleanup failed:', err)
    }
  }

  // ===== 云端同步 =====

  private startAutoSync(): void {
    if (!this.config.autoSync || !this.config.enableCloudSync) return

    this.syncTimer = setInterval(() => {
      this.syncToCloud()
    }, this.config.syncIntervalMs)

    // 页面可见性变化时立即同步
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.syncToCloud()
      }
    })

    logger.info(`[ChatSync] Auto-sync started (interval: ${this.config.syncIntervalMs}ms)`)
  }

  async syncToCloud(): Promise<void> {
    if (!this.config.enableCloudSync) return

    const pending = this.getAllSessions().filter(s => s.syncStatus === 'pending')
    if (pending.length === 0) return

    logger.info(`[ChatSync] Syncing ${pending.length} sessions to cloud...`)

    try {
      // TODO: 接入实际云端 API
      // const response = await fetch('/api/v1/chat/sync', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      //   body: JSON.stringify({ sessions: pending }),
      // })

      // 模拟成功
      pending.forEach(s => {
        s.syncStatus = 'synced'
        this.sessions.set(s.id, s)
      })

      this.updateSyncMeta({ lastSyncAt: Date.now(), pendingCount: 0 })
      this.persistToStorage()
      this.notifyListeners()

      logger.info(`[ChatSync] Cloud sync completed for ${pending.length} sessions`)
    } catch (err) {
      logger.error('[ChatSync] Cloud sync failed:', err)
      pending.forEach(s => {
        s.syncStatus = 'error'
        this.sessions.set(s.id, s)
      })
    }
  }

  private updateSyncMeta(meta: Partial<SyncMetadata>): void {
    try {
      const existingRaw = localStorage.getItem(SYNC_META_KEY)
      const existing: SyncMetadata = existingRaw ? JSON.parse(existingRaw) : {}
      const updated = { ...existing, ...meta }
      localStorage.setItem(SYNC_META_KEY, JSON.stringify(updated))
    } catch {
      // ignore
    }
  }

  // ===== 变更通知 =====

  subscribe(listener: (sessions: SyncSession[]) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    const data = this.getAllSessions()
    this.listeners.forEach(l => l(data))
  }

  // ===== 配置管理 =====

  updateConfig(updates: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...updates }
    if (updates.autoSync !== false && updates.enableCloudSync) {
      this.startAutoSync()
    } else if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
    }
  }

  getConfig(): SyncConfig {
    return { ...this.config }
  }

  // ===== 统计信息 =====

  getStats(): {
    totalSessions: number
    totalMessages: number
    pendingSync: number
    storageSize: string
  } {
    const sessions = this.getAllSessions()
    const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0)
    const pending = sessions.filter(s => s.syncStatus === 'pending').length

    try {
      const raw = localStorage.getItem(SESSIONS_KEY) || ''
      const bytes = new TextEncoder().encode(raw).length
      const sizeStr = bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`
      return { totalSessions: sessions.length, totalMessages, pendingSync: pending, storageSize: sizeStr }
    } catch {
      return { totalSessions: sessions.length, totalMessages, pendingSync: pending, storageSize: 'N/A' }
    }
  }

  // ===== 清理 =====

  destroy(): void {
    if (this.syncTimer) clearInterval(this.syncTimer)
    this.listeners.clear()
    this.sessions.clear()
  }

  clearAll(): void {
    this.sessions.clear()
    localStorage.removeItem(SESSIONS_KEY)
    localStorage.removeItem(SYNC_META_KEY)
    this.notifyListeners()
  }
}

// 单例实例
export const chatSyncService = new ChatSyncService()
export default chatSyncService
