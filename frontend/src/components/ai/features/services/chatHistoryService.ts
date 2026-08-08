import { logger } from '@/utils/safeLogger';
import { chatHistoryStorage } from './chatHistoryStorage';
import type {
  ChatSession,
  ChatMessage,
  ChatTopic,
  HistorySearchFilters,
  HistoryStatistics,
} from '../types/chatHistory.types';
import { ChatTopicLabels } from '../types/chatHistory.types';

export interface IChatHistoryService {
  saveSession(session: ChatSession): Promise<void>;
  getSession(id: string): Promise<ChatSession | null>;
  getAllSessions(filters?: HistorySearchFilters): Promise<ChatSession[]>;
  deleteSession(id: string): Promise<void>;
  clearAll(): Promise<void>;
  getStatistics(): Promise<HistoryStatistics>;
  search(keyword: string, filters?: Omit<HistorySearchFilters, 'keyword'>): Promise<ChatSession[]>;
  getSessionsByTopic(topic: ChatTopic): Promise<ChatSession[]>;
  getSessionsByTag(tag: string): Promise<ChatSession[]>;
  getRecentSessions(limit?: number): Promise<ChatSession[]>;
  getTopics(): Promise<{ topic: ChatTopic; label: string; count: number }[]>;
  getAllTags(): Promise<{ tag: string; count: number }[]>;
  updateSessionTitle(id: string, title: string): Promise<void>;
  addTagToSession(id: string, tag: string): Promise<void>;
  removeTagFromSession(id: string, tag: string): Promise<void>;
  appendMessage(sessionId: string, message: ChatMessage): Promise<void>;
}

export class ChatHistoryService implements IChatHistoryService {
  private storage = chatHistoryStorage;

  async saveSession(session: ChatSession): Promise<void> {
    try {
      await this.storage.saveSession(session);
      logger.info(`[ChatHistoryService] Session saved: ${session.id}`);
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to save session:', error);
      throw error;
    }
  }

  async getSession(id: string): Promise<ChatSession | null> {
    try {
      const session = await this.storage.getSession(id);
      if (session) {
        logger.debug(`[ChatHistoryService] Session retrieved: ${id}`);
      }
      return session;
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to get session:', error);
      throw error;
    }
  }

  async getAllSessions(filters?: HistorySearchFilters): Promise<ChatSession[]> {
    try {
      const sessions = await this.storage.getAllSessions(filters);
      logger.debug(`[ChatHistoryService] Retrieved ${sessions.length} sessions`);
      return sessions;
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to get all sessions:', error);
      throw error;
    }
  }

  async deleteSession(id: string): Promise<void> {
    try {
      await this.storage.deleteSession(id);
      logger.info(`[ChatHistoryService] Session deleted: ${id}`);
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to delete session:', error);
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    try {
      await this.storage.clearAll();
      logger.info('[ChatHistoryService] All sessions cleared');
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to clear sessions:', error);
      throw error;
    }
  }

  async getStatistics(): Promise<HistoryStatistics> {
    try {
      const stats = await this.storage.getStatistics();
      logger.debug('[ChatHistoryService] Statistics retrieved');
      return stats;
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to get statistics:', error);
      throw error;
    }
  }

  async search(keyword: string, filters?: Omit<HistorySearchFilters, 'keyword'>): Promise<ChatSession[]> {
    try {
      const allFilters: HistorySearchFilters = {
        keyword,
        ...filters,
      };
      const results = await this.storage.getAllSessions(allFilters);
      logger.debug(`[ChatHistoryService] Search completed: ${results.length} results for "${keyword}"`);
      return results;
    } catch (error) {
      logger.error('[ChatHistoryService] Search failed:', error);
      throw error;
    }
  }

  async getSessionsByTopic(topic: ChatTopic): Promise<ChatSession[]> {
    try {
      const sessions = await this.storage.getAllSessions({ topic });
      logger.debug(`[ChatHistoryService] Retrieved ${sessions.length} sessions for topic: ${topic}`);
      return sessions;
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to get sessions by topic:', error);
      throw error;
    }
  }

  async getSessionsByTag(tag: string): Promise<ChatSession[]> {
    try {
      const sessions = await this.storage.getAllSessions({ tags: [tag] });
      logger.debug(`[ChatHistoryService] Retrieved ${sessions.length} sessions for tag: ${tag}`);
      return sessions;
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to get sessions by tag:', error);
      throw error;
    }
  }

  async getRecentSessions(limit = 10): Promise<ChatSession[]> {
    try {
      const sessions = await this.storage.getAllSessions();
      const recent = sessions.slice(0, limit);
      logger.debug(`[ChatHistoryService] Retrieved ${recent.length} recent sessions`);
      return recent;
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to get recent sessions:', error);
      throw error;
    }
  }

  async getTopics(): Promise<{ topic: ChatTopic; label: string; count: number }[]> {
    try {
      const stats = await this.storage.getStatistics();
      const topics = Object.entries(stats.sessionsByTopic).map(([topic, count]) => ({
        topic: topic as ChatTopic,
        label: ChatTopicLabels[topic as ChatTopic] || topic,
        count,
      }));
      logger.debug('[ChatHistoryService] Topics retrieved');
      return topics;
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to get topics:', error);
      throw error;
    }
  }

  async getAllTags(): Promise<{ tag: string; count: number }[]> {
    try {
      const stats = await this.storage.getStatistics();
      logger.debug('[ChatHistoryService] Tags retrieved');
      return stats.topTags;
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to get tags:', error);
      throw error;
    }
  }

  async updateSessionTitle(id: string, title: string): Promise<void> {
    try {
      const session = await this.storage.getSession(id);
      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }

      session.title = title;
      session.metadata.updatedAt = Date.now();
      await this.storage.saveSession(session);
      logger.info(`[ChatHistoryService] Session title updated: ${id}`);
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to update session title:', error);
      throw error;
    }
  }

  async addTagToSession(id: string, tag: string): Promise<void> {
    try {
      const session = await this.storage.getSession(id);
      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }

      if (session.metadata.tags.includes(tag)) {
        return;
      }

      session.metadata.tags.push(tag);
      session.metadata.updatedAt = Date.now();
      await this.storage.saveSession(session);
      logger.info(`[ChatHistoryService] Tag added to session: ${id}, tag: ${tag}`);
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to add tag:', error);
      throw error;
    }
  }

  async removeTagFromSession(id: string, tag: string): Promise<void> {
    try {
      const session = await this.storage.getSession(id);
      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }

      const index = session.metadata.tags.indexOf(tag);
      if (index === -1) {
        return;
      }

      session.metadata.tags.splice(index, 1);
      session.metadata.updatedAt = Date.now();
      await this.storage.saveSession(session);
      logger.info(`[ChatHistoryService] Tag removed from session: ${id}, tag: ${tag}`);
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to remove tag:', error);
      throw error;
    }
  }

  async appendMessage(sessionId: string, message: ChatMessage): Promise<void> {
    try {
      const session = await this.storage.getSession(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      session.messages.push(message);
      session.metadata.messageCount = session.messages.length;
      session.metadata.updatedAt = Date.now();

      if (!session.title || session.title === '') {
        const userMessage = session.messages.find((m) => m.role === 'user');
        if (userMessage) {
          session.title = userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : '');
        }
      }

      await this.storage.saveSession(session);
      logger.info(`[ChatHistoryService] Message appended to session: ${sessionId}`);
    } catch (error) {
      logger.error('[ChatHistoryService] Failed to append message:', error);
      throw error;
    }
  }
}

export const chatHistoryService = new ChatHistoryService();
export default chatHistoryService;
