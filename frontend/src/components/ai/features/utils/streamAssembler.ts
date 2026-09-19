/**
 * Stream Assembler - 流式响应组装器
 *
 * 基于 DeepSeek Harness 的 StreamAssembler：
 * - 累积 text-delta 块
 * - 处理 tool-call-delta 参数
 * - 管理 block-end 事件
 * - ReplayEnvelope 分离
 */

import type {
  StreamChunk,
  TextDeltaChunk,
  ToolCallDeltaChunk,
  BlockEndChunk,
  FinishChunk,
  ReplayEnvelope,
} from '@/components/ai/shared/types';
import { logger } from '@/utils/safeLogger';

// ── 类型定义 ────────────────────────────────────────────────

export interface AssembledBlock {
  index: number;
  type: string;
  content: string;
  completed: boolean;
}

export interface ToolCallAccumulator {
  index: number;
  id: string;
  name?: string;
  arguments: string;
  completed: boolean;
}

export interface StreamAssemblyResult {
  blocks: AssembledBlock[];
  toolCalls: ToolCallAccumulator[];
  replayEnvelope?: ReplayEnvelope;
  totalTokens?: number;
}

// ── StreamAssembler 类 ─────────────────────────────────────

export class StreamAssembler {
  private blocks: AssembledBlock[] = [];
  private toolCalls: ToolCallAccumulator[] = [];
  private replayEnvelope: ReplayEnvelope | undefined;
  private totalTokens = 0;
  private completed = false;

  /**
   * 处理单个 chunk
   */
  processChunk(chunk: StreamChunk): void {
    if (this.completed) {
      logger.warn('[StreamAssembler] Processing chunk after completion');
      return;
    }

    switch (chunk.type) {
      case 'text-delta':
        this.processTextDelta(chunk);
        break;
      case 'tool-call-delta':
        this.processToolCallDelta(chunk);
        break;
      case 'block-end':
        this.processBlockEnd(chunk);
        break;
      case 'usage':
        this.processUsage(chunk);
        break;
      case 'finish':
        this.processFinish(chunk);
        break;
      case 'error':
        this.processError(chunk);
        break;
      case 'block-start':
        this.processBlockStart(chunk);
        break;
    }
  }

  /**
   * 处理文本增量
   */
  private processTextDelta(chunk: TextDeltaChunk): void {
    let block = this.blocks[chunk.index];
    if (!block) {
      block = {
        index: chunk.index,
        type: 'text',
        content: '',
        completed: false,
      };
      this.blocks[chunk.index] = block;
    }
    block.content += chunk.text;
  }

  /**
   * 处理工具调用增量
   */
  private processToolCallDelta(chunk: ToolCallDeltaChunk): void {
    let call = this.toolCalls[chunk.index];
    if (!call) {
      call = {
        index: chunk.index,
        id: chunk.id,
        name: chunk.name,
        arguments: '',
        completed: false,
      };
      this.toolCalls[chunk.index] = call;
    }
    call.arguments += chunk.argumentsDelta;
    if (chunk.name) {
      call.name = chunk.name;
    }
  }

  /**
   * 处理块结束
   */
  private processBlockEnd(chunk: BlockEndChunk): void {
    const block = this.blocks[chunk.index];
    if (block) {
      block.completed = true;
    }
  }

  /**
   * 处理块开始
   */
  private processBlockStart(chunk: { type: 'block-start'; index: number; blockType: string }): void {
    this.blocks[chunk.index] = {
      index: chunk.index,
      type: chunk.blockType,
      content: '',
      completed: false,
    };
  }

  /**
   * 处理使用情况
   */
  private processUsage(chunk: { type: 'usage'; usage: { totalTokens: number } }): void {
    this.totalTokens = chunk.usage.totalTokens;
  }

  /**
   * 处理完成事件
   */
  private processFinish(chunk: FinishChunk): void {
    this.completed = true;
    if (chunk.replayState) {
      this.replayEnvelope = chunk.replayState;
    }
    // 标记所有未完成的块为已完成
    for (const block of this.blocks) {
      if (!block.completed) {
        block.completed = true;
      }
    }
    for (const call of this.toolCalls) {
      if (!call.completed) {
        call.completed = true;
      }
    }
  }

  /**
   * 处理错误
   */
  private processError(chunk: { type: 'error'; failure: { message: string } }): void {
    logger.error('[StreamAssembler] Error chunk:', chunk.failure.message);
    this.completed = true;
  }

  /**
   * 获取组装结果
   */
  getResult(): StreamAssemblyResult {
    return {
      blocks: [...this.blocks],
      toolCalls: [...this.toolCalls],
      replayEnvelope: this.replayEnvelope,
      totalTokens: this.totalTokens,
    };
  }

  /**
   * 重置组装器
   */
  reset(): void {
    this.blocks = [];
    this.toolCalls = [];
    this.replayEnvelope = undefined;
    this.totalTokens = 0;
    this.completed = false;
  }

  /**
   * 检查是否完成
   */
  isCompleted(): boolean {
    return this.completed;
  }

  /**
   * 获取文本内容
   */
  getText(): string {
    return this.blocks.filter(b => b.type === 'text').map(b => b.content).join('');
  }

  /**
   * 获取工具调用
   */
  getToolCalls(): Array<{ id: string; name?: string; arguments: string }> {
    return this.toolCalls.map(c => ({
      id: c.id,
      name: c.name,
      arguments: c.arguments,
    }));
  }
}

// ── 流处理辅助函数 ──────────────────────────────────────────

/**
 * 异步迭代处理流
 */
export async function processStream(
  stream: AsyncIterable<StreamChunk>,
  assembler: StreamAssembler,
): Promise<StreamAssemblyResult> {
  for await (const chunk of stream) {
    assembler.processChunk(chunk);
  }
  return assembler.getResult();
}

/**
 * 从流中累积文本
 */
export async function collectStreamText(stream: AsyncIterable<StreamChunk>): Promise<string> {
  const assembler = new StreamAssembler();
  await processStream(stream, assembler);
  return assembler.getText();
}

/**
 * 创建新组装器
 */
export function createAssembler(): StreamAssembler {
  return new StreamAssembler();
}