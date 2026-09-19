/**
 * 🔒 P5-2: 前端持久化与离线支持
 *
 * 提供:
 * 1. **持久化存储** - localStorage / IndexedDB / Cache API
 * 2. **离线数据同步** - Service Worker + Background Sync
 * 3. **数据一致性** - 版本控制 + 冲突解决
 * 4. **状态恢复** - 页面刷新/崩溃后状态恢复
 *
 * 使用方式:
 *   import { createPersistentStore, OfflineManager } from '@/utils/persistentStore'
 *
 *   // 持久化存储
 *   const store = createPersistentStore('user_preferences')
 *   store.set('theme', 'dark')
 *   const theme = store.get('theme')
 *
 *   // 离线管理
 *   OfflineManager.init()
 *   await OfflineManager.syncWhenOnline()
 */

import { useCallback, useEffect, useRef, useState } from 'react';


import { logger } from '@/utils/safeLogger';
// ════════════════════════════════════════════
// 🔒 P5-2: 存储引擎抽象
// ════════════════════════════════════════════

type StorageEngine = 'localStorage' | 'sessionStorage' | 'IndexedDB' | 'Cache';

interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  size(): Promise<number>;
  _evictOldData?: () => void;
}

// ─────────────────────────────────────────────
// LocalStorage 适配器
// ─────────────────────────────────────────────

const LocalStorageAdapter: StorageAdapter = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return null;
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // 存储配额不足，尝试清理旧数据
      this._evictOldData?.();
      localStorage.setItem(key, JSON.stringify(value));
    }
  },

  async delete(key: string): Promise<void> {
    localStorage.removeItem(key);
  },

  async clear(): Promise<void> {
    localStorage.clear();
  },

  async keys(): Promise<string[]> {
    return Object.keys(localStorage);
  },

  async size(): Promise<number> {
    let size = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        size += localStorage.getItem(key)?.length || 0;
      }
    }
    return size;
  },

  _evictOldData(): void {
    // 清理带 _persist_ 标记的旧数据
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('_evict_'));
    keys.forEach((k) => localStorage.removeItem(k));
  },
};

// ─────────────────────────────────────────────
// IndexedDB 适配器（用于大数据）
// ─────────────────────────────────────────────

class IndexedDBAdapter implements StorageAdapter {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null = null;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private async _getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this._getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const request = store.get(key);

        request.onsuccess = () => {
          resolve(request.result?.value ?? null);
        };
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this._getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.put({ key, value, timestamp: Date.now() });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      logger.error('[IndexedDB] Write failed:', e);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const db = await this._getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.delete(key);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Ignore
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this._getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        store.clear();

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Ignore
    }
  }

  async keys(): Promise<string[]> {
    try {
      const db = await this._getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const request = store.getAllKeys();

        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return [];
    }
  }

  async size(): Promise<number> {
    const keys = await this.keys();
    let totalSize = 0;
    for (const key of keys) {
      const item = await this.get(key);
      if (item) {
        totalSize += JSON.stringify(item).length;
      }
    }
    return totalSize;
  }
}

// ════════════════════════════════════════════
// 🔒 P5-2: 持久化存储 Hook
// ════════════════════════════════════════════

interface PersistentStoreOptions {
  storage?: StorageEngine;
  namespace?: string;
  version?: number;
  ttl?: number; // 过期时间（毫秒）
  onVersionMismatch?: (oldData: any, newData: any) => any;
}

function createPersistentStore<T = any>(namespace: string, options: PersistentStoreOptions = {}) {
  const { storage = 'localStorage', version = 1, ttl, onVersionMismatch } = options;

  const prefix = `${namespace}:`;
  let adapter: StorageAdapter;

  if (storage === 'IndexedDB') {
    adapter = new IndexedDBAdapter('rmfood_db', namespace);
  } else {
    adapter = LocalStorageAdapter;
  }

  // ─────────────────────────────────────────────
  // 核心操作
  // ─────────────────────────────────────────────

  const _wrapKey = (key: string) => `${prefix}${key}`;
  const _wrapData = (value: T) => ({
    data: value,
    version,
    timestamp: Date.now(),
  });
  const _unwrapData = (wrapped: any): T | null => {
    if (!wrapped) return null;

    // 旧格式兼容
    if (wrapped.data !== undefined) {
      // TTL 检查
      if (ttl && wrapped.timestamp) {
        if (Date.now() - wrapped.timestamp > ttl) {
          return null;
        }
      }
      // 版本检查
      if (wrapped.version !== version && onVersionMismatch) {
        return onVersionMismatch(wrapped.data, null);
      }
      return wrapped.data;
    }

    // 新格式（直接存储）
    return wrapped;
  };

  return {
    async get<K extends keyof T>(key: K): Promise<T[K] | null> {
      const wrapped = await adapter.get(_wrapKey(key as string));
      return wrapped ? (_unwrapData(wrapped) as T[K]) : null;
    },

    async set<K extends keyof T>(key: K, value: T[K]): Promise<void> {
      await adapter.set(_wrapKey(key as string), _wrapData(value as T));
    },

    async delete(key: string): Promise<void> {
      await adapter.delete(_wrapKey(key));
    },

    async clear(): Promise<void> {
      const allKeys = await adapter.keys();
      const myKeys = allKeys.filter((k) => k.startsWith(prefix));
      for (const key of myKeys) {
        await adapter.delete(key);
      }
    },

    async has(key: string): Promise<boolean> {
      const value = await adapter.get(_wrapKey(key));
      return value !== null;
    },

    async size(): Promise<number> {
      const allKeys = await adapter.keys();
      const myKeys = allKeys.filter((k) => k.startsWith(prefix));
      return myKeys.length;
    },

    async getAll(): Promise<Partial<T>> {
      const allKeys = await adapter.keys();
      const myKeys = allKeys.filter((k) => k.startsWith(prefix));
      const result: Partial<T> = {};

      for (const key of myKeys) {
        const plainKey = key.replace(prefix, '');
        const wrapped = await adapter.get(key);
        if (wrapped) {
          (result as Record<string, unknown>)[plainKey] = _unwrapData(wrapped);
        }
      }

      return result;
    },

    async batchSet(data: Partial<T>): Promise<void> {
      const promises = Object.entries(data).map(([key, value]) => adapter.set(_wrapKey(key), _wrapData(value as T)));
      await Promise.all(promises);
    },
  };
}

// ════════════════════════════════════════════
// 🔒 P5-2: React Hook 封装
// ════════════════════════════════════════════

export function usePersistentState<T>(
  key: string,
  namespace: string,
  defaultValue: T,
  options: PersistentStoreOptions = {},
) {
  const store = useRef(createPersistentStore(namespace, options));
  const [state, setState] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);

  // 初始化加载
  useEffect(() => {
    const loadData = async () => {
      try {
        const stored = await store.current.get(key);
        if (stored !== null) {
          setState(stored);
        }
      } catch (e) {
        logger.warn(`[PersistentState] Failed to load ${key}:`, e);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [key]);

  // 设置值
  const setValue = useCallback(
    async (value: T | ((prev: T) => T)) => {
      const newValue = typeof value === 'function' ? (value as (prev: T) => T)(state) : value;

      setState(newValue);
      await store.current.set(key as string, newValue);
    },
    [key, state],
  );

  return [state, setValue, loading] as const;
}

// ════════════════════════════════════════════
// 🔒 P5-2: 离线管理器
// ════════════════════════════════════════════

interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  payload?: any;
  timestamp: number;
  retries: number;
}

class OfflineManagerClass {
  private isOnline: boolean = navigator.onLine;
  private syncQueue: SyncQueueItem[] = [];
  private listeners: Set<(online: boolean) => void> = new Set();
  private dbName = 'rmfood_offline';
  private storeName = 'sync_queue';

  async init() {
    // 监听网络状态
    window.addEventListener('online', this._handleOnline);
    window.addEventListener('offline', this._handleOffline);

    // 从 IndexedDB 恢复同步队列
    await this._loadQueue();

    // 注册 Service Worker
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        logger.info('[Offline] Service Worker registered:', reg.scope);
      } catch (e) {
        logger.warn('[Offline] Service Worker registration failed:', e);
      }
    }

    // 定期尝试同步
    setInterval(() => this._trySync(), 30000); // 每 30 秒

    logger.info('[Offline] Manager initialized, online:', this.isOnline);
  }

  destroy() {
    window.removeEventListener('online', this._handleOnline);
    window.removeEventListener('offline', this._handleOffline);
  }

  // ─────────────────────────────────────────────
  // 网络状态
  // ─────────────────────────────────────────────

  getOnlineStatus() {
    return this.isOnline;
  }

  onStatusChange(callback: (online: boolean) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private _handleOnline = () => {
    this.isOnline = true;
    this.listeners.forEach((cb) => cb(true));
    logger.info('[Offline] Network online');
    this._trySync();
  };

  private _handleOffline = () => {
    this.isOnline = false;
    this.listeners.forEach((cb) => cb(false));
    logger.info('[Offline] Network offline');
  };

  // ─────────────────────────────────────────────
  // 队列管理
  // ─────────────────────────────────────────────

  async queueOperation(endpoint: string, method: 'POST' | 'PUT' | 'DELETE', payload?: any): Promise<string> {
    const item: SyncQueueItem = {
      id: `sync_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      endpoint,
      method,
      payload,
      timestamp: Date.now(),
      retries: 0,
    };

    this.syncQueue.push(item);
    await this._saveQueue();

    logger.info(`[Offline] Queued: ${method} ${endpoint}`);

    // 如果在线，立即尝试同步
    if (this.isOnline) {
      this._trySync();
    }

    return item.id;
  }

  async getPendingCount(): Promise<number> {
    await this._loadQueue();
    return this.syncQueue.length;
  }

  async clearQueue(): Promise<void> {
    this.syncQueue = [];
    await this._saveQueue();
  }

  // ─────────────────────────────────────────────
  // 同步逻辑
  // ─────────────────────────────────────────────

  private async _trySync() {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    logger.info(`[Offline] Attempting sync: ${this.syncQueue.length} items`);

    const failedItems: SyncQueueItem[] = [];

    for (const item of this.syncQueue) {
      try {
        const response = await fetch(item.endpoint, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            'X-Offline-Sync': 'true',
          },
          body: item.payload ? JSON.stringify(item.payload) : undefined,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        logger.info(`[Offline] Synced: ${item.method} ${item.endpoint}`);
      } catch (e) {
        logger.warn(`[Offline] Sync failed: ${item.endpoint}`, e);
        item.retries++;

        // 超过 5 次重试则放弃
        if (item.retries < 5) {
          failedItems.push(item);
        } else {
          logger.error(`[Offline] Max retries exceeded for: ${item.endpoint}`);
        }
      }
    }

    this.syncQueue = failedItems;
    await this._saveQueue();

    if (failedItems.length === 0) {
      logger.info('[Offline] ✅ All items synced successfully');
    } else {
      logger.info(`[Offline] ⏳ ${failedItems.length} items pending`);
    }
  }

  async syncWhenOnline(): Promise<boolean> {
    if (!this.isOnline) {
      logger.info('[Offline] Cannot sync: offline');
      return false;
    }

    await this._trySync();
    return this.syncQueue.length === 0;
  }

  // ─────────────────────────────────────────────
  // IndexedDB 持久化
  // ─────────────────────────────────────────────

  private async _getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  private async _loadQueue() {
    try {
      const db = await this._getDB();
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        this.syncQueue = request.result || [];
      };
    } catch {
      // IndexedDB 可能不可用
    }
  }

  private async _saveQueue() {
    try {
      const db = await this._getDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);

      // 清空并重新写入
      store.clear();
      for (const item of this.syncQueue) {
        store.put(item);
      }
    } catch {
      // 忽略错误
    }
  }
}

// 全局单例
export const OfflineManager = new OfflineManagerClass();

// ════════════════════════════════════════════
// 🔒 P5-2: 数据版本控制
// ════════════════════════════════════════════

interface VersionedData<T> {
  data: T;
  version: number;
  createdAt: number;
  updatedAt: number;
  checksum: string;
}

function computeChecksum(data: any): string {
  const str = JSON.stringify(data, Object.keys(data).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function createVersionedData<T>(data: T, version: number = 1): VersionedData<T> {
  return {
    data,
    version,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    checksum: computeChecksum(data),
  };
}

export function updateVersionedData<T>(current: VersionedData<T>, newData: T): VersionedData<T> {
  return {
    ...current,
    data: newData,
    version: current.version + 1,
    updatedAt: Date.now(),
    checksum: computeChecksum(newData),
  };
}

export function validateVersionedData<T>(data: VersionedData<T>): boolean {
  const computed = computeChecksum(data.data);
  return computed === data.checksum;
}

export function mergeVersionedData<T>(
  local: VersionedData<T>,
  remote: VersionedData<T>,
  strategy: 'local-wins' | 'remote-wins' | 'newer-wins' = 'newer-wins',
): T {
  if (!validateVersionedData(remote)) {
    logger.warn('[VersionControl] Remote data checksum mismatch');
    return local.data;
  }

  switch (strategy) {
    case 'local-wins':
      return local.data;
    case 'remote-wins':
      return remote.data;
    case 'newer-wins':
    default:
      return local.updatedAt > remote.updatedAt ? local.data : remote.data;
  }
}

// ════════════════════════════════════════════
// 🔒 P5-2: 导出
// ════════════════════════════════════════════

export {
  LocalStorageAdapter,
  IndexedDBAdapter,
  type StorageAdapter,
  type StorageEngine,
  type PersistentStoreOptions,
  type SyncQueueItem,
  type VersionedData,
};

export default {
  createPersistentStore,
  usePersistentState,
  OfflineManager,
  createVersionedData,
  updateVersionedData,
  validateVersionedData,
  mergeVersionedData,
};
