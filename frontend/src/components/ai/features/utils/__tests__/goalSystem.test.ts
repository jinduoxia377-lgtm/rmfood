/**
 * Goal System 单元测试
 */
import { GoalManager, getGoalManager } from '../goalSystem';

describe('GoalManager', () => {
  let manager: GoalManager;

  beforeEach(() => {
    manager = new GoalManager();
  });

  describe('create', () => {
    test('应创建新目标', () => {
      const goal = manager.create({
        sessionId: 'session-1' as any,
        objective: 'Implement feature X',
      });
      expect(goal.id).toBeDefined();
      expect(goal.phase).toBe('active');
      expect(goal.objective).toBe('Implement feature X');
    });

    test('应支持设置最大轮次', () => {
      const goal = manager.create({
        sessionId: 'session-1' as any,
        objective: 'Test',
        maxGoalRounds: 5,
      });
      expect(goal.maxGoalRounds).toBe(5);
    });
  });

  describe('pause/resume', () => {
    test('应暂停目标', () => {
      const goal = manager.create({ sessionId: 's1' as any, objective: 'Test' });
      expect(manager.pause(goal.id)).toBe(true);
      expect(goal.phase).toBe('paused');
    });

    test('应恢复目标', () => {
      const goal = manager.create({ sessionId: 's1' as any, objective: 'Test' });
      manager.pause(goal.id);
      expect(manager.resume(goal.id)).toBe(true);
      expect(goal.phase).toBe('active');
    });

    test('暂停已完成目标应返回 false', () => {
      const goal = manager.create({ sessionId: 's1' as any, objective: 'Test' });
      manager.complete(goal.id);
      expect(manager.pause(goal.id)).toBe(false);
    });
  });

  describe('block/complete', () => {
    test('应标记目标为阻塞', () => {
      const goal = manager.create({ sessionId: 's1' as any, objective: 'Test' });
      expect(manager.block(goal.id, 'Reason')).toBe(true);
      expect(goal.phase).toBe('blocked');
      expect(goal.blockedReason).toBe('Reason');
    });

    test('应完成目标', () => {
      const goal = manager.create({ sessionId: 's1' as any, objective: 'Test' });
      expect(manager.complete(goal.id)).toBe(true);
      expect(goal.phase).toBe('complete');
    });
  });

  describe('updateDescription', () => {
    test('应更新描述', () => {
      const goal = manager.create({ sessionId: 's1' as any, objective: 'Old' });
      expect(manager.updateDescription(goal.id, 'New description')).toBe(true);
      expect(goal.description).toBe('New description');
    });
  });

  describe('incrementContinuation', () => {
    test('应增加续期轮次', () => {
      const goal = manager.create({ sessionId: 's1' as any, objective: 'Test', maxGoalRounds: 5 });
      manager.incrementContinuation(goal.id);
      expect(goal.continuationRounds).toBe(1);
    });

    test('应检测预算是否超限', () => {
      const goal = manager.create({ sessionId: 's1' as any, objective: 'Test', maxGoalRounds: 3 });
      manager.incrementContinuation(goal.id);
      manager.incrementContinuation(goal.id);
      manager.incrementContinuation(goal.id);
      expect(manager.isBudgetExceeded(goal)).toBe(true);
    });
  });

  describe('delete', () => {
    test('应删除目标', () => {
      const goal = manager.create({ sessionId: 's1' as any, objective: 'Test' });
      expect(manager.delete(goal.id)).toBe(true);
      expect(manager.get(goal.id)).toBeUndefined();
    });
  });

  describe('getStats', () => {
    test('应返回正确统计', () => {
      manager.create({ sessionId: 's1' as any, objective: 'A' });
      manager.create({ sessionId: 's2' as any, objective: 'B' });
      const goal = manager.create({ sessionId: 's3' as any, objective: 'C' });
      manager.complete(goal.id);

      const stats = manager.getStats();
      expect(stats.totalGoals).toBe(3);
      expect(stats.activeGoals).toBe(2);
      expect(stats.completedGoals).toBe(1);
    });
  });

  describe('getBySession', () => {
    test('应按会话过滤', () => {
      manager.create({ sessionId: 's1' as any, objective: 'A' });
      manager.create({ sessionId: 's1' as any, objective: 'B' });
      manager.create({ sessionId: 's2' as any, objective: 'C' });

      const goals = manager.getBySession('s1' as any);
      expect(goals).toHaveLength(2);
    });
  });

  describe('全局单例', () => {
    test('getGoalManager 应返回同一实例', () => {
      const instance1 = getGoalManager();
      const instance2 = getGoalManager();
      expect(instance1).toBe(instance2);
    });
  });
});