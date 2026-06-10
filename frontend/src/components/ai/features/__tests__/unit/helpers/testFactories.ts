// @ts-nocheck
// 测试辅助工厂函数

export const TEST_CONSTANTS = {
  DEFAULT_SESSION_ID: 'test-session-1',
  DEFAULT_USER_ID: 'user-123',
  DEFAULT_MESSAGE_ID: 'msg-001',
  MAX_MESSAGES: 100,
  STORAGE_KEY: 'test-chat-storage',
  SESSION_KEY: 'test-session-storage',
  MOCK_DELAY: 100,
  ERROR_MESSAGE: '测试错误消息',
};

export interface MockMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  formulaIds?: string[];
  metadata?: Record<string, any>;
}

export interface MockAIResponse {
  id: string;
  content: string;
  reasoning?: string;
  formulaIds?: string[];
  metadata?: Record<string, any>;
}

export function createMockMessage(overrides?: Partial<MockMessage>): MockMessage {
  return {
    id: overrides?.id || `${TEST_CONSTANTS.DEFAULT_MESSAGE_ID}-${Date.now()}`,
    role: overrides?.role || 'user',
    content: overrides?.content || '测试消息内容',
    timestamp: overrides?.timestamp || Date.now(),
    formulaIds: overrides?.formulaIds,
    metadata: overrides?.metadata,
  };
}

export function createMockAIResponse(overrides?: Partial<MockAIResponse>): MockAIResponse {
  return {
    id: `resp-${Date.now()}`,
    content: overrides?.content || 'AI 响应内容',
    reasoning: overrides?.reasoning,
    formulaIds: overrides?.formulaIds,
    metadata: overrides?.metadata,
  };
}

export function createMockMessagesArray(count: number, role: 'user' | 'assistant' = 'user'): MockMessage[] {
  return Array.from({ length: count }, (_, i) =>
    createMockMessage({
      id: `msg-${i + 1}`,
      role,
      content: `测试消息 ${i + 1}`,
      timestamp: Date.now() - (count - i) * 1000,
    })
  );
}

export function createMockError(message: string = TEST_CONSTANTS.ERROR_MESSAGE): Error {
  return new Error(message);
}

export function createMockSession(
  id: string = TEST_CONSTANTS.DEFAULT_SESSION_ID,
  messageCount: number = 5
) {
  return {
    id,
    title: `测试会话 ${id}`,
    messages: createMockMessagesArray(messageCount),
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
    metadata: {},
  };
}

export function createMockFormula(id: string = 'formula-1') {
  return {
    id,
    name: `测试配方 ${id}`,
    ingredients: [
      { name: '人参', dosage: '10g', role: '君药' },
      { name: '黄芪', dosage: '15g', role: '臣药' },
    ],
    effects: ['补气', '增强免疫力'],
    safetyLevel: 'low',
    scores: {
      synergy: 0.85,
      taste: 0.72,
      stability: 0.90,
      overall: 0.82,
    },
  };
}

export function createMockStorageData<T>(data: T, expiresInMs?: number) {
  return {
    data,
    version: 8,
    timestamp: Date.now(),
    expiresAt: expiresInMs ? Date.now() + expiresInMs : undefined,
  };
}

export function wait(ms: number = TEST_CONSTANTS.MOCK_DELAY): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function mockConsoleLog() {
  return jest.spyOn(console, 'log').mockImplementation(() => {});
}

export function mockConsoleError() {
  return jest.spyOn(console, 'error').mockImplementation(() => {});
}

export function cleanupMocks(...mocks: jest.SpyInstance[]) {
  mocks.forEach(mock => mock.mockRestore());
}
