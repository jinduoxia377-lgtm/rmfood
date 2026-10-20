import { logger } from '@/utils/safeLogger';

interface StorageData<T> {
  data: T;
  version: number;
  timestamp: number;
  expiresAt?: number;
}

const CURRENT_VERSION = 8;

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export class StorageService {
  private storage: Storage;
  private lruCache = new Map<string, number>();
  private static MAX_HISTORY_SIZE = 1000;

  constructor(storage?: Storage) {
    this.storage = storage || localStorage;
  }

  /**
   * 获取存储的内容
   */
  get<T>(key: string): T | null {
    try {
      const raw = this.storage.getItem(key);
      if (!raw) return null;

      if (!raw.startsWith('{')) {
        // 非 JSON 信封内容视为脏数据/未通过本服务写入的数据（本服务 set 始终写 JSON 信封）
        return null;
      }

      const parsed: StorageData<T> = JSON.parse(raw);

      // 过期检查
      if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
        logger.info(`[StorageService] 数据已过期，自动清理: ${key}`);
        this.remove(key);
        return null;
      }

      this.updateLRU(key);
      return parsed.data ?? (parsed as unknown as T);
    } catch (error) {
      logger.warn(`[StorageService] get failed for ${key}:`, error);
      return null;
    }
  }

  /**
   * 设置存储的内容
   */
  set<T>(key: string, value: T, options?: { expiresInMs?: number }): void {
    try {
      const data: StorageData<T> = {
        data: value,
        version: CURRENT_VERSION,
        timestamp: Date.now(),
        expiresAt: options?.expiresInMs ? Date.now() + options.expiresInMs : undefined,
      };

      this.storage.setItem(key, JSON.stringify(data));
      this.updateLRU(key);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.handleQuotaExceeded();
        throw new QuotaExceededError(`存储配额已满: ${key}`);
      }
      logger.error(`[StorageService] set failed for ${key}:`, error);
      throw error;
    }
  }

  /**
   * 删除存储的内容
   */
  remove(key: string): void {
    try {
      this.storage.removeItem(key);
      this.lruCache.delete(key);
    } catch (error) {
      logger.error(`[StorageService] remove failed for ${key}:`, error);
    }
  }

  /**
   * 检查键是否存在
   */
  exists(key: string): boolean {
    return this.storage.getItem(key) !== null;
  }

  /**
   * 获取所有匹配前缀的键
   */
  keys(prefix?: string): string[] {
    const keys: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key) {
        if (!prefix || key.startsWith(prefix)) {
          keys.push(key);
        }
      }
    }
    return keys;
  }

  /**
   * 清理所有匹配前缀的键
   */
  clearByPrefix(prefix: string): void {
    this.keys(prefix).forEach(key => this.remove(key));
  }

  /**
   * 更新 LRU 缓存
   */
  private updateLRU(key: string): void {
    this.lruCache.delete(key);
    this.lruCache.set(key, Date.now());

    if (this.lruCache.size > StorageService.MAX_HISTORY_SIZE) {
      const sorted = Array.from(this.lruCache.entries()).sort((a, b) => a[1] - b[1]);
      const toRemove = sorted.slice(0, this.lruCache.size - StorageService.MAX_HISTORY_SIZE);
      toRemove.forEach(([k]) => this.lruCache.delete(k));
    }
  }

  /**
   * 处理配额超限
   */
  private handleQuotaExceeded(): void {
    logger.warn('[StorageService] 存储配额超限，执行清理');
    this.cleanExpiredData();
  }

  /**
   * 清理过期数据
   */
  cleanExpiredData(): void {
    const keys = this.keys();
    const now = Date.now();

    keys.forEach(key => {
      try {
        const raw = this.storage.getItem(key);
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (parsed.expiresAt && parsed.expiresAt < now) {
          this.remove(key);
        }
      } catch {
        // 忽略解析错误
      }
    });
  }

  /**
   * 获取统计信息
   */
  getStats(): { used: number; total: number; itemCount: number } {
    let used = 0;
    let itemCount = 0;

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key) {
        const value = this.storage.getItem(key);
        if (value) {
          used += value.length * 2; // UTF-16 encoding
          itemCount++;
        }
      }
    }

    const total = 5 * 1024 * 1024; // 5MB typical limit

    return { used, total, itemCount };
  }
}

export const storageService = new StorageService();
export default storageService;
