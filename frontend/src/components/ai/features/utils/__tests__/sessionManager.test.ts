/**
 * Session Manager 单元测试
 */
import { SessionManager } from '../sessionManager';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  describe('createSession', () => {
    test('应创建新会话并返回 ID', async () => {
      const sessionId = await manager.createSession('测试会话');
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });

    test('应设置当前会话', async () => {
      const sessionId = await manager.createSession();
      const current = manager.getCurrentSession();
      expect(current).not.toBeNull();
      expect(current?.id).toBe(sessionId);
    });

    test('无名称时应使用默认名称', async () => {
      const sessionId = await manager.createSession();
      const list = manager.getSessionList();
      const session = list.find(s => s.id === sessionId);
      expect(session?.name).toBeDefined();
    });
  });

  describe('switchSession', () => {
    test('应切换到指定会话', async () => {
      const id1 = await manager.createSession('会话1');
      const id2 = await manager.createSession('会话2');
      
      const result = await manager.switchSession(id2);
      expect(result).toBe(true);
      expect(manager.getCurrentSession()?.id).toBe(id2);
    });

    test('切换到不存在的会话应返回 false', async () => {
      const result = await manager.switchSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('deleteSession', () => {
    test('应删除会话', async () => {
      const sessionId = await manager.createSession();
      const result = await manager.deleteSession(sessionId);
      expect(result).toBe(true);
      expect(manager.getSessionList().length).toBe(0);
    });

    test('删除不存在的会话应返回 false', async () => {
      const result = await manager.deleteSession('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getSessionList', () => {
    test('空管理器应返回空列表', () => {
      const list = manager.getSessionList();
      expect(list).toHaveLength(0);
    });

    test('应返回所有会话信息', async () => {
      await manager.createSession('会话1');
      await manager.createSession('会话2');
      
      const list = manager.getSessionList();
      expect(list).toHaveLength(2);
      expect(list[0].messageCount).toBeDefined();
      expect(list[0].tokenCount).toBeDefined();
    });
  });

  describe('renameSession', () => {
    test('应重命名会话', async () => {
      const sessionId = await manager.createSession('原名');
      const result = manager.renameSession(sessionId, '新名字');
      expect(result).toBe(true);
      
      const list = manager.getSessionList();
      expect(list[0].name).toBe('新名字');
    });

    test('重命名不存在的会话应返回 false', () => {
      const result = manager.renameSession('non-existent', '新名字');
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    test('空管理器应返回零统计', () => {
      const stats = manager.getStats();
      expect(stats.totalSessions).toBe(0);
      expect(stats.totalMessages).toBe(0);
      expect(stats.totalTokens).toBe(0);
    });

    test('应有会话时应返回正确统计', async () => {
      await manager.createSession('测试');
      const stats = manager.getStats();
      expect(stats.totalSessions).toBe(1);
      expect(stats.totalMessages).toBeGreaterThanOrEqual(0);
    });
  });
});