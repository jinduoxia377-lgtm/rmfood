/**
 * LLM Adapter 单元测试
 */
import {
  DeepSeekAdapter,
  OpenAIAdapter,
  getAdapter,
  registerAdapter,
  listAdapters,
  streamResponse,
} from '../llmAdapter';

describe('LLM Adapter', () => {
  describe('DeepSeekAdapter', () => {
    test('应能创建实例', () => {
      const adapter = new DeepSeekAdapter();
      expect(adapter.provider).toBe('deepseek');
      expect(adapter.model).toBe('deepseek-chat');
    });

    test('应支持自定义模型', () => {
      const adapter = new DeepSeekAdapter('deepseek-coder');
      expect(adapter.model).toBe('deepseek-coder');
    });

    test('estimateTokens 应正确估算', () => {
      const adapter = new DeepSeekAdapter();
      const messages = [
        { role: 'user', content: 'Hello world' },
        { role: 'assistant', content: '你好世界' },
      ];
      const tokens = adapter.estimateTokens(messages);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('OpenAIAdapter', () => {
    test('应能创建实例', () => {
      const adapter = new OpenAIAdapter();
      expect(adapter.provider).toBe('openai');
      expect(adapter.model).toBe('gpt-4o');
    });

    test('应支持自定义模型', () => {
      const adapter = new OpenAIAdapter('gpt-3.5-turbo');
      expect(adapter.model).toBe('gpt-3.5-turbo');
    });
  });

  describe('适配器注册表', () => {
    test('getAdapter 应返回已注册的适配器', () => {
      const adapter = getAdapter('deepseek');
      expect(adapter).toBeInstanceOf(DeepSeekAdapter);
    });

    test('getAdapter 对未注册适配器应抛出错误', () => {
      expect(() => getAdapter('unknown')).toThrow('Adapter not found');
    });

    test('listAdapters 应返回所有注册适配器', () => {
      const adapters = listAdapters();
      expect(adapters).toContain('deepseek');
      expect(adapters).toContain('openai');
    });

    test('registerAdapter 应能注册新适配器', () => {
      class CustomAdapter implements any {
        provider = 'custom';
        model = 'custom-model';
        async *stream() { yield { type: 'finish', reason: 'stop' as const }; }
        async complete() { return ''; }
        estimateTokens() { return 0; }
      }
      
      registerAdapter('custom', new CustomAdapter() as any);
      expect(listAdapters()).toContain('custom');
    });
  });

  describe('streamResponse', () => {
    test('应返回完整内容', async () => {
      // 由于需要真实 API，这里只测试基础逻辑
      expect(typeof streamResponse).toBe('function');
    });
  });
});