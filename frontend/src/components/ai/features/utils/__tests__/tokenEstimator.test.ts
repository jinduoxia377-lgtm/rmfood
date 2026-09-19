/**
 * Token Estimator 单元测试
 */
import { PreciseTokenEstimator, estimateTokens } from '../tokenEstimator';
import type { AgentMessage } from '@/components/ai/shared/types';

describe('Token Estimator', () => {
  const estimator = new PreciseTokenEstimator();

  describe('estimate', () => {
    test('应正确估算空消息', () => {
      const messages: AgentMessage[] = [];
      const tokens = estimator.estimate(messages);
      expect(tokens).toBe(0);
    });

    test('应正确估算英文消息', () => {
      const messages: AgentMessage[] = [
        { id: '1', role: 'user', content: 'Hello world', timestamp: new Date() }
      ];
      const tokens = estimator.estimate(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    test('应正确估算中文消息', () => {
      const messages: AgentMessage[] = [
        { id: '1', role: 'user', content: '你好世界', timestamp: new Date() }
      ];
      const tokens = estimator.estimate(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    test('应正确估算混合消息', () => {
      const messages: AgentMessage[] = [
        { id: '1', role: 'user', content: 'Hello 你好世界', timestamp: new Date() }
      ];
      const tokens = estimator.estimate(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    test('多条消息应累加 token 数', () => {
      const messages: AgentMessage[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: new Date() },
        { id: '2', role: 'assistant', content: 'World', timestamp: new Date() },
      ];
      const tokens = estimator.estimate(messages);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('estimateSingle', () => {
    test('应包含固定开销', () => {
      const message: AgentMessage = {
        id: '1',
        role: 'user',
        content: '',
        timestamp: new Date(),
      };
      const tokens = estimator.estimateSingle(message);
      expect(tokens).toBe(4); // FIXED_OVERHEAD
    });

    test('长文本应产生更多 tokens', () => {
      const shortMsg: AgentMessage = {
        id: '1', role: 'user', content: 'Hi', timestamp: new Date(),
      };
      const longMsg: AgentMessage = {
        id: '2', role: 'user', content: 'A'.repeat(100), timestamp: new Date(),
      };
      
      expect(estimator.estimateSingle(longMsg)).toBeGreaterThan(
        estimator.estimateSingle(shortMsg)
      );
    });
  });

  describe('estimateTokens 函数', () => {
    test('应正确估算纯英文', () => {
      const tokens = estimateTokens('Hello world');
      expect(tokens).toBeGreaterThan(0);
    });

    test('应正确估算纯中文', () => {
      const tokens = estimateTokens('你好世界');
      expect(tokens).toBeGreaterThan(0);
    });

    test('空字符串应返回 0', () => {
      const tokens = estimateTokens('');
      expect(tokens).toBe(0);
    });
  });
});