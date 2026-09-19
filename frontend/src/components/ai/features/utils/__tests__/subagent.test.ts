/**
 * Subagent 单元测试
 */
import { SubagentManager, getSubagentManager } from '../subagent';

describe('Subagent', () => {
  let manager: SubagentManager;

  beforeEach(() => {
    manager = new SubagentManager();
  });

  describe('spawn', () => {
    test('应创建子智能体', () => {
      const handle = manager.spawn({ name: '测试子智能体', prompt: 'Hello' });
      expect(handle).toBeDefined();
      expect(handle.id).toBeDefined();
    });

    test('应设置初始状态为 running', () => {
      const handle = manager.spawn({ name: '测试', prompt: 'Hello' });
      expect(handle.status).toBe('running');
    });
  });

  describe('get', () => {
    test('应能获取已创建的子智能体', () => {
      const handle = manager.spawn({ name: '测试', prompt: 'Hello' });
      const retrieved = manager.get(handle.id);
      expect(retrieved).toBe(handle);
    });

    test('获取不存在的子智能体应返回 undefined', () => {
      const result = manager.get('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('interrupt', () => {
    test('应中断正在运行的子智能体', () => {
      const handle = manager.spawn({ name: '测试', prompt: 'Hello' });
      const result = manager.interrupt(handle.id);
      expect(result).toBe(true);
    });

    test('中断不存在的子智能体应返回 false', () => {
      const result = manager.interrupt('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('waitFor', () => {
    test('应等待子智能体完成', async () => {
      const handle = manager.spawn({ name: '测试', prompt: 'Hello', maxSteps: 1 });
      const result = await manager.waitFor(handle.id, 5000);
      expect(result.status).toBe('completed');
    }, 10000);

    test('超时应抛出错误', async () => {
      const handle = manager.spawn({ name: '测试', prompt: 'Hello' });
      await expect(manager.waitFor(handle.id, 1)).rejects.toThrow();
    }, 5000);
  });

  describe('listAgents', () => {
    test('应返回所有子智能体列表', () => {
      manager.spawn({ name: 'Agent1', prompt: 'Hello' });
      manager.spawn({ name: 'Agent2', prompt: 'World' });
      
      const agents = manager.listAgents();
      expect(agents).toHaveLength(2);
      expect(agents[0].name).toBe('Agent1');
      expect(agents[1].name).toBe('Agent2');
    });
  });

  describe('cleanup', () => {
    test('应清理事件完成的子智能体', async () => {
      const handle = manager.spawn({ name: '测试', prompt: 'Hello', maxSteps: 1 });
      await manager.waitFor(handle.id, 1000);
      
      const cleaned = manager.cleanup();
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('全局单例', () => {
    test('getSubagentManager 应返回同一实例', () => {
      const instance1 = getSubagentManager();
      const instance2 = getSubagentManager();
      expect(instance1).toBe(instance2);
    });
  });
});