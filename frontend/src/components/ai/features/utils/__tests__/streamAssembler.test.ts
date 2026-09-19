/**
 * Stream Assembler 单元测试
 */
import { StreamAssembler, processStream, collectStreamText, createAssembler } from '../streamAssembler';
import type { StreamChunk } from '@/components/ai/shared/types';

describe('StreamAssembler', () => {
  let assembler: StreamAssembler;

  beforeEach(() => {
    assembler = createAssembler();
  });

  describe('processChunk', () => {
    test('应累积文本增量', () => {
      assembler.processChunk({ type: 'text-delta', index: 0, text: 'Hello' } as StreamChunk);
      assembler.processChunk({ type: 'text-delta', index: 0, text: ' World' } as StreamChunk);
      
      const result = assembler.getResult();
      expect(result.blocks[0].content).toBe('Hello World');
    });

    test('应累积工具调用参数', () => {
      assembler.processChunk({
        type: 'tool-call-delta',
        index: 0,
        id: 'call-1',
        argumentsDelta: '{"name":',
      } as StreamChunk);
      assembler.processChunk({
        type: 'tool-call-delta',
        index: 0,
        id: 'call-1',
        argumentsDelta: ' "test"}',
      } as StreamChunk);
      
      const result = assembler.getResult();
      expect(result.toolCalls[0].arguments).toBe('{"name": "test"}');
    });

    test('应处理块结束', () => {
      assembler.processChunk({ type: 'block-start', index: 0, blockType: 'text' } as StreamChunk);
      assembler.processChunk({ type: 'text-delta', index: 0, text: 'Content' } as StreamChunk);
      assembler.processChunk({ type: 'block-end', index: 0 } as StreamChunk);
      
      const result = assembler.getResult();
      expect(result.blocks[0].completed).toBe(true);
    });

    test('应处理使用情况', () => {
      assembler.processChunk({
        type: 'usage',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      } as StreamChunk);
      
      const result = assembler.getResult();
      expect(result.totalTokens).toBe(30);
    });

    test('应处理完成事件', () => {
      assembler.processChunk({ type: 'text-delta', index: 0, text: 'Hello' } as StreamChunk);
      assembler.processChunk({ type: 'finish', reason: 'stop' } as StreamChunk);
      
      expect(assembler.isCompleted()).toBe(true);
    });

    test('应处理错误事件', () => {
      assembler.processChunk({
        type: 'error',
        failure: { message: 'Test error', code: 'TEST_ERROR', retryable: false },
      } as StreamChunk);
      
      expect(assembler.isCompleted()).toBe(true);
    });
  });

  describe('getResult', () => {
    test('应返回组装结果', () => {
      assembler.processChunk({ type: 'text-delta', index: 0, text: 'Test' } as StreamChunk);
      assembler.processChunk({ type: 'finish', reason: 'stop' } as StreamChunk);
      
      const result = assembler.getResult();
      expect(result.blocks).toHaveLength(1);
      expect(result.blocks[0].content).toBe('Test');
    });
  });

  describe('getText', () => {
    test('应返回所有文本块', () => {
      assembler.processChunk({ type: 'text-delta', index: 0, text: 'Hello' } as StreamChunk);
      assembler.processChunk({ type: 'text-delta', index: 1, text: 'World' } as StreamChunk);
      
      expect(assembler.getText()).toBe('HelloWorld');
    });
  });

  describe('getToolCalls', () => {
    test('应返回工具调用', () => {
      assembler.processChunk({
        type: 'tool-call-delta',
        index: 0,
        id: 'call-1',
        argumentsDelta: '{"a":1}',
      } as StreamChunk);
      
      const calls = assembler.getToolCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].id).toBe('call-1');
    });
  });

  describe('reset', () => {
    test('应重置状态', () => {
      assembler.processChunk({ type: 'text-delta', index: 0, text: 'Test' } as StreamChunk);
      assembler.reset();
      
      expect(assembler.getText()).toBe('');
      expect(assembler.isCompleted()).toBe(false);
    });
  });

  describe('processChunk after completion', () => {
    test('应忽略完成后的 chunk', () => {
      assembler.processChunk({ type: 'finish', reason: 'stop' } as StreamChunk);
      assembler.processChunk({ type: 'text-delta', index: 0, text: 'After' } as StreamChunk);
      
      expect(assembler.getText()).toBe('');
    });
  });
});

describe('processStream', () => {
  test('应处理异步流', async () => {
    async function* generateChunks() {
      yield { type: 'text-delta', index: 0, text: 'Hello' } as StreamChunk;
      yield { type: 'text-delta', index: 0, text: ' World' } as StreamChunk;
      yield { type: 'finish', reason: 'stop' } as StreamChunk;
    }
    
    const assembler = createAssembler();
    const result = await processStream(generateChunks(), assembler);
    expect(result.blocks[0].content).toBe('Hello World');
  });
});

describe('collectStreamText', () => {
  test('应累积流中文本', async () => {
    async function* generateChunks() {
      yield { type: 'text-delta', index: 0, text: 'Test' } as StreamChunk;
      yield { type: 'finish', reason: 'stop' } as StreamChunk;
    }
    
    const text = await collectStreamText(generateChunks());
    expect(text).toBe('Test');
  });
});