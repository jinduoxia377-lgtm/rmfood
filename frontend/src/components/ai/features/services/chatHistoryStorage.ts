import { logger } from '@/utils/safeLogger';
import { ChatTopic, DEFAULT_STORAGE_CONFIG, MAX_TAGS_PER_SESSION } from '../types/chatHistory.types';
import type {
  ChatSession,
  HistorySearchFilters,
  HistoryStatistics,
  HistoryStorageConfig,
} from '../types/chatHistory.types';

export class ChatHistoryStorage {
  private config: HistoryStorageConfig;
  private db: IDBDatabase | null = null;
  private isIndexedDBEnabled = true;
  private initPromise: Promise<void> | null = null;

  constructor(config: Partial<HistoryStorageConfig> = {}) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    try {
      if (!('indexedDB' in window)) {
        logger.warn('[ChatHistoryStorage] IndexedDB not available, falling back to localStorage');
        this.isIndexedDBEnabled = false;
        return;
      }

      return new Promise((resolve) => {
        const request = indexedDB.open(this.config.indexedDBName, 2);

        request.onerror = () => {
          logger.warn('[ChatHistoryStorage] IndexedDB init failed, falling back to localStorage');
          this.isIndexedDBEnabled = false;
          resolve();
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          logger.info('[ChatHistoryStorage] IndexedDB initialized successfully');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const database = (event.target as IDBOpenDBRequest).result;

          if (!database.objectStoreNames.contains('sessions')) {
            const sessionStore = database.createObjectStore('sessions', { keyPath: 'id' });
            sessionStore.createIndex('topic', 'metadata.topic', { unique: false });
            sessionStore.createIndex('createdAt', 'metadata.createdAt', { unique: false });
            sessionStore.createIndex('updatedAt', 'metadata.updatedAt', { unique: false });
          }

          if (!database.objectStoreNames.contains('tags')) {
            database.createObjectStore('tags', { keyPath: 'name' });
          }
        };
      });
    } catch {
      logger.warn('[ChatHistoryStorage] IndexedDB init exception, falling back to localStorage');
      this.isIndexedDBEnabled = false;
    }
  }

  private async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  async saveSession(session: ChatSession): Promise<void> {
    await this.waitForInit();

    if (session.metadata.tags.length > MAX_TAGS_PER_SESSION) {
      throw new Error(`最多支持 ${MAX_TAGS_PER_SESSION} 个标签`);
    }

    if (this.isIndexedDBEnabled && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        const request = store.put(session);

        request.onsuccess = () => {
          logger.info(`[ChatHistoryStorage] Session saved to IndexedDB: ${session.id}`);
          this.syncToLocalStorage([session]);
          resolve();
        };

        request.onerror = () => {
          logger.error('[ChatHistoryStorage] Failed to save session to IndexedDB');
          reject(request.error);
        };
      });
    } else {
      await this.saveToLocalStorage([session]);
    }
  }

  async getSession(id: string): Promise<ChatSession | null> {
    await this.waitForInit();

    if (this.isIndexedDBEnabled && this.db) {
      return new Promise((resolve) => {
        const transaction = this.db!.transaction(['sessions'], 'readonly');
        const store = transaction.objectStore('sessions');
        const request = store.get(id);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          logger.error('[ChatHistoryStorage] Failed to get session from IndexedDB');
          resolve(this.getFromLocalStorage(id));
        };
      });
    } else {
      return this.getFromLocalStorage(id);
    }
  }

  async getAllSessions(filters?: HistorySearchFilters): Promise<ChatSession[]> {
    await this.waitForInit();

    let sessions: ChatSession[] = [];

    if (this.isIndexedDBEnabled && this.db) {
      sessions = await new Promise((resolve) => {
        const transaction = this.db!.transaction(['sessions'], 'readonly');
        const store = transaction.objectStore('sessions');
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          logger.error('[ChatHistoryStorage] Failed to get all sessions from IndexedDB');
          resolve([]);
        };
      });
    } else {
      sessions = this.getAllFromLocalStorage();
    }

    const filtered = this.applyFilters(sessions, filters);
    // 统一裁剪到配置上限（与 localStorage 保存路径一致），避免 IndexedDB 无界增长导致超限
    return filtered.slice(0, this.config.maxSessions);
  }

  async deleteSession(id: string): Promise<void> {
    await this.waitForInit();

    if (this.isIndexedDBEnabled && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        const request = store.delete(id);

        request.onsuccess = () => {
          logger.info(`[ChatHistoryStorage] Session deleted from IndexedDB: ${id}`);
          this.deleteFromLocalStorage(id);
          resolve();
        };

        request.onerror = () => {
          logger.error('[ChatHistoryStorage] Failed to delete session from IndexedDB');
          reject(request.error);
        };
      });
    } else {
      this.deleteFromLocalStorage(id);
    }
  }

  async clearAll(): Promise<void> {
    await this.waitForInit();

    if (this.isIndexedDBEnabled && this.db) {
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        const request = store.clear();

        request.onsuccess = () => {
          logger.info('[ChatHistoryStorage] All sessions cleared from IndexedDB');
          localStorage.removeItem(this.config.localStorageKey);
          resolve();
        };

        request.onerror = () => {
          logger.error('[ChatHistoryStorage] Failed to clear sessions from IndexedDB');
          reject(request.error);
        };
      });
    } else {
      localStorage.removeItem(this.config.localStorageKey);
    }
  }

  async getStatistics(): Promise<HistoryStatistics> {
    const sessions = await this.getAllSessions();

    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const sessionsByTopic: Record<ChatTopic, number> = {} as Record<ChatTopic, number>;
    Object.values(ChatTopic).forEach((topic) => {
      sessionsByTopic[topic] = 0;
    });

    const tagCounts: Record<string, number> = {};

    sessions.forEach((session) => {
      sessionsByTopic[session.metadata.topic]++;
      session.metadata.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return {
      totalSessions: sessions.length,
      totalMessages: sessions.reduce((sum, s) => sum + s.metadata.messageCount, 0),
      sessionsByTopic,
      topTags,
      sessionsLastWeek: sessions.filter((s) => s.metadata.createdAt >= oneWeekAgo).length,
      sessionsLastMonth: sessions.filter((s) => s.metadata.createdAt >= oneMonthAgo).length,
    };
  }

  async migrateFromLocalStorage(): Promise<number> {
    await this.waitForInit();

    if (!this.isIndexedDBEnabled || !this.db) {
      return 0;
    }

    const localStorageData = localStorage.getItem(this.config.localStorageKey);
    if (!localStorageData) {
      return 0;
    }

    try {
      const sessions: ChatSession[] = JSON.parse(localStorageData);
      if (!Array.isArray(sessions)) {
        return 0;
      }

      const migratedCount = await new Promise<number>((resolve) => {
        let count = 0;
        const transaction = this.db!.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');

        sessions.forEach((session) => {
          const request = store.put(session);
          request.onsuccess = () => count++;
        });

        transaction.oncomplete = () => {
          logger.info(`[ChatHistoryStorage] Migrated ${count} sessions from localStorage`);
          resolve(count);
        };
      });

      localStorage.removeItem(this.config.localStorageKey);
      return migratedCount;
    } catch (error) {
      logger.error('[ChatHistoryStorage] Failed to migrate from localStorage:', error);
      return 0;
    }
  }

  private applyFilters(sessions: ChatSession[], filters?: HistorySearchFilters): ChatSession[] {
    let filtered = [...sessions];

    if (filters) {
      filtered = filtered.filter((session) => {
        if (filters.keyword) {
          const keyword = filters.keyword.toLowerCase();
          if (
            !session.title.toLowerCase().includes(keyword) &&
            !session.messages.some((m) => m.content.toLowerCase().includes(keyword))
          ) {
            return false;
          }
        }

        if (filters.topic && session.metadata.topic !== filters.topic) {
          return false;
        }

        if (filters.tags && filters.tags.length > 0) {
          if (!filters.tags.some((tag) => session.metadata.tags.includes(tag))) {
            return false;
          }
        }

        if (filters.dateFrom && session.metadata.createdAt < filters.dateFrom) {
          return false;
        }

        if (filters.dateTo && session.metadata.createdAt > filters.dateTo) {
          return false;
        }

        if (filters.minMessages && session.metadata.messageCount < filters.minMessages) {
          return false;
        }

        if (filters.maxMessages && session.metadata.messageCount > filters.maxMessages) {
          return false;
        }

        return true;
      });
    }

    return filtered.sort((a, b) => b.metadata.updatedAt - a.metadata.updatedAt);
  }

  private async saveToLocalStorage(sessions: ChatSession[]): Promise<void> {
    try {
      const existing = this.getAllFromLocalStorage();
      const updated = existing.filter((s) => !sessions.some((newS) => newS.id === s.id));
      updated.push(...sessions);

      const trimmed = updated.slice(0, this.config.maxSessions);
      localStorage.setItem(this.config.localStorageKey, JSON.stringify(trimmed));
      logger.info(`[ChatHistoryStorage] Sessions saved to localStorage: ${trimmed.length}`);
    } catch (error) {
      logger.error('[ChatHistoryStorage] Failed to save to localStorage:', error);
      throw error;
    }
  }

  private getFromLocalStorage(id: string): ChatSession | null {
    const sessions = this.getAllFromLocalStorage();
    return sessions.find((s) => s.id === id) || null;
  }

  private getAllFromLocalStorage(): ChatSession[] {
    try {
      const data = localStorage.getItem(this.config.localStorageKey);
      if (!data) return [];
      const parsed = JSON.parse(data ?? '{}');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private deleteFromLocalStorage(id: string): void {
    const sessions = this.getAllFromLocalStorage().filter((s) => s.id !== id);
    localStorage.setItem(this.config.localStorageKey, JSON.stringify(sessions));
  }

  private syncToLocalStorage(sessions: ChatSession[]): void {
    try {
      this.saveToLocalStorage(sessions);
    } catch {
      logger.warn('[ChatHistoryStorage] Failed to sync to localStorage');
    }
  }

  getStorageStats(): { type: 'indexedDB' | 'localStorage'; count: number } {
    if (this.isIndexedDBEnabled) {
      return { type: 'indexedDB', count: 0 };
    }
    return { type: 'localStorage', count: this.getAllFromLocalStorage().length };
  }
}

export const chatHistoryStorage = new ChatHistoryStorage();
export default chatHistoryStorage;
