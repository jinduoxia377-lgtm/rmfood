/**
 * LLM Adapter - 统一 LLM 接口实现
 *
 * 基于 DeepSeek Harness 的 LLM Adapter 模式：
 * - 统一接口定义
 * - 多模型支持
 * - 流式响应处理
 */

import type {
  LlmAdapter,
  LlmFailure,
  StreamChunk,
  ModelRequest,
} from '@/components/ai/shared/types';
import { logger } from '@/utils/safeLogger';

// ── 适配器注册表 ────────────────────────────────────────────

const adapters = new Map<string, LlmAdapter>();

/**
 * 注册适配器
 */
export function registerAdapter(name: string, adapter: LlmAdapter): void {
  adapters.set(name, adapter);
  logger.info(`[LLMAdapter] Registered adapter: ${name}`);
}

/**
 * 获取适配器
 */
export function getAdapter(name: string): LlmAdapter {
  const adapter = adapters.get(name);
  if (!adapter) {
    throw new Error(`Adapter not found: ${name}`);
  }
  return adapter;
}

/**
 * 列出所有适配器
 */
export function listAdapters(): string[] {
  return Array.from(adapters.keys());
}

// ── DeepSeek Adapter ────────────────────────────────────────

export class DeepSeekAdapter implements LlmAdapter {
  readonly provider = 'deepseek';
  model: string;

  constructor(model: string = 'deepseek-chat') {
    this.model = model;
  }

  async *stream(request: ModelRequest, signal: AbortSignal): AsyncIterable<StreamChunk> {
    void request;
    void signal;
    // 模拟流式响应（实际实现需要调用真实 API）
    yield { type: 'text-delta', index: 0, text: 'Hello' };
    yield { type: 'finish', reason: 'stop' };
  }

  async complete(request: ModelRequest): Promise<string> {
    void request;
    // 模拟完整响应
    return 'Hello World';
  }

  estimateTokens(messages: Array<{ role: string; content: string }>): number {
    let count = 0;
    for (const msg of messages) {
      count += this.estimateSingle(msg.content);
    }
    return count;
  }

  private estimateSingle(text: string): number {
    let chineseCount = 0;
    let asciiCount = 0;

    for (const char of text) {
      if (/[\u4e00-\u9fa5]/.test(char)) {
        chineseCount++;
      } else {
        asciiCount++;
      }
    }

    return Math.ceil(chineseCount / 1.5 + asciiCount / 4);
  }

  classifyError(error: Error): LlmFailure {
    const message = error.message.toLowerCase();

    if (message.includes('empty response') || message.includes('no content')) {
      return { message: error.message, code: 'EMPTY_RESPONSE', retryable: true };
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return { message: error.message, code: 'TIMEOUT', retryable: true };
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return { message: error.message, code: 'RATE_LIMITED', retryable: true };
    }
    if (message.includes('context length') || message.includes('too long')) {
      return { message: error.message, code: 'CONTEXT_WINDOW_EXCEEDED', retryable: false };
    }
    if (message.includes('unauthorized') || message.includes('401') || message.includes('forbidden') || message.includes('403')) {
      return { message: error.message, code: 'INVALID_AUTH', retryable: false };
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('failed')) {
      return { message: error.message, code: 'NETWORK_ERROR', retryable: true };
    }

    return { message: error.message, code: 'UNKNOWN', retryable: true };
  }
}

// ── OpenAI Adapter ──────────────────────────────────────────

export class OpenAIAdapter implements LlmAdapter {
  readonly provider = 'openai';
  model: string;

  constructor(model: string = 'gpt-4o') {
    this.model = model;
  }

  async *stream(request: ModelRequest, signal: AbortSignal): AsyncIterable<StreamChunk> {
    void request;
    void signal;
    yield { type: 'text-delta', index: 0, text: 'Hello' };
    yield { type: 'finish', reason: 'stop' };
  }

  async complete(request: ModelRequest): Promise<string> {
    void request;
    return 'Hello World';
  }

  estimateTokens(messages: Array<{ role: string; content: string }>): number {
    let count = 0;
    for (const msg of messages) {
      count += this.estimateSingle(msg.content);
    }
    return count;
  }

  private estimateSingle(text: string): number {
    let chineseCount = 0;
    let asciiCount = 0;

    for (const char of text) {
      if (/[\u4e00-\u9fa5]/.test(char)) {
        chineseCount++;
      } else {
        asciiCount++;
      }
    }

    return Math.ceil(chineseCount / 1.5 + asciiCount / 4);
  }

  classifyError(error: Error): LlmFailure {
    const message = error.message.toLowerCase();

    if (message.includes('empty response') || message.includes('no content')) {
      return { message: error.message, code: 'EMPTY_RESPONSE', retryable: true };
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return { message: error.message, code: 'TIMEOUT', retryable: true };
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return { message: error.message, code: 'RATE_LIMITED', retryable: true };
    }
    if (message.includes('context length') || message.includes('too long')) {
      return { message: error.message, code: 'CONTEXT_WINDOW_EXCEEDED', retryable: false };
    }
    if (message.includes('unauthorized') || message.includes('401') || message.includes('forbidden') || message.includes('403')) {
      return { message: error.message, code: 'INVALID_AUTH', retryable: false };
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('failed')) {
      return { message: error.message, code: 'NETWORK_ERROR', retryable: true };
    }

    return { message: error.message, code: 'UNKNOWN', retryable: true };
  }
}

// ── 工具函数 ────────────────────────────────────────────────

/**
 * 流式响应处理
 */
export async function streamResponse(
  adapterName: string,
  request: ModelRequest
): Promise<string> {
  const adapter = getAdapter(adapterName);
  let content = '';

  for await (const chunk of adapter.stream(request, new AbortController().signal)) {
    if (chunk.type === 'text-delta') {
      content += chunk.text;
    } else if (chunk.type === 'error') {
      throw new Error(chunk.failure.message);
    }
  }

  return content;
}

/**
 * 完整响应处理
 */
export async function completeResponse(
  adapterName: string,
  request: ModelRequest
): Promise<string> {
  const adapter = getAdapter(adapterName);
  return adapter.complete(request);
}

// ── 初始化默认适配器 ────────────────────────────────────────

// 注册默认适配器
registerAdapter('deepseek', new DeepSeekAdapter());
registerAdapter('openai', new OpenAIAdapter());


