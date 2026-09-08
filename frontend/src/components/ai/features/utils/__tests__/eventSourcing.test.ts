/**
 * EventSourcedSession 单元测试
 */
import { EventSourcedSession, tokenEstimator, checkCompactionTrigger } from '../eventSourcing';
import type { AgentMessage } from '@/components/ai/shared/types';

// Mock IndexedDB
const mockDB = {
  objectStoreNames: new Set(['events', 'metadata']),
  transaction: jest.fn(),
  close: jest.fn(),
};

jest.mock('indexedDB', () => ({
  open: jest.fn(() => ({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: mockDB,
  })),
}));

describe('EventSourcedSession', () => {
  let session: EventSourcedSession;

  beforeEach(() => {
    session = new EventSourcedSession('test-session');
  });

  afterEach(async () => {
    await session.close();
  });

  describe('tokenEstimator', () => {
    test('应正确估算 ASCII 文本的 token', () => {
      const messages: AgentMessage[] = [
        { id: '1', role: 'user', content: 'Hello world', timestamp: new Date() },
      ];
      const tokens = tokenEstimator.estimate(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    test('应正确估算中文文本的 token', () => {
      const messages: AgentMessage[] = [
        { id: '1', role: 'user', content: '你好世界', timestamp: new Date() },
      ];
      const tokens = tokenEstimator.estimate(messages);
      expect(tokens).toBeGreaterThan(0);
    });

    test('中文 token 估算应高于 ASCII (按字符比例)', () => {
      const asciiMsg: AgentMessage = { id: '1', role: 'user', content: 'Hello world', timestamp: new Date() };
      const cnMsg: AgentMessage = { id: '2', role: 'user', content: '你好世界', timestamp: new Date() };

      const asciiTokens = tokenEstimator.estimateSingle(asciiMsg);
      const cnTokens = tokenEstimator.estimateSingle(cnMsg);

      // 4个中文字符 ≈ 2-3 tokens，5个ASCII字符 ≈ 1-2 tokens
      expect(cnTokens).toBeGreaterThanOrEqual(asciiTokens);
    });
  });

  describe('checkCompactionTrigger', () => {
    test('低 token 使用量不应触发压缩', () => {
      const decision = checkCompactionTrigger(session, 128000);
      expect(decision.trigger).toBeNull();
    });

    test('高 token 使用量应触发压缩', () => {
      // 模拟大量消息
      const largeMessages: AgentMessage[] = Array.from({ length: 200 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user',
        content: '这是一个很长的测试消息，用于模拟上下文膨胀的情况。'.repeat(10),
        timestamp: new Date(),
      }));

      // 手动设置 session 的消息来测试
      jest.spyOn(session, 'estimateTokenCount').mockReturnValue(130000);
      jest.spyOn(session, 'deriveMessages').mockReturnValue(largeMessages);

      const decision = checkCompactionTrigger(session, 128000);
      expect(decision.trigger).toBe('context-overflow');
    });
  });
});
