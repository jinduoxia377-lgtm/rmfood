/**
 * LLM 摘要压缩服务
 *
 * 基于 DeepSeek Harness 的 Compaction 算法改进：
 * - 使用 LLM 生成高质量摘要
 * - 替代简单的截断式压缩
 * - 保留关键上下文信息
 */

import { logger } from '@/utils/safeLogger';
import { tokenEstimator } from './eventSourcing';
import type { AgentMessage } from '@/components/ai/shared/types';

export interface LLMCompactionResult {
  /** 压缩生成的摘要 */
  summary: string;
  /** 被压缩的消息数量 */
  compressedCount: number;
  /** 保留的消息 */
  remainingMessages: AgentMessage[];
  /** 节省的 token 数 */
  tokensSaved: number;
}

export interface CompactionConfig {
  /** 保留最近消息数量 */
  keepRecentCount: number;
  /** 最大摘要长度 (字符) */
  maxSummaryLength: number;
  /** LLM 模型 (用于摘要生成) */
  model?: string;
}

const DEFAULT_CONFIG: CompactionConfig = {
  keepRecentCount: 20,
  maxSummaryLength: 2000,
  model: 'deepseek-chat',
};

/**
 * 使用 LLM 生成上下文摘要
 */
export async function generateContextSummary(
  messages: AgentMessage[],
  config: CompactionConfig = DEFAULT_CONFIG,
): Promise<LLMCompactionResult> {
  const { keepRecentCount, maxSummaryLength } = { ...DEFAULT_CONFIG, ...config };

  // 分离要压缩和保留的消息
  const toCompress = messages.slice(0, -keepRecentCount);
  const remaining = messages.slice(-keepRecentCount);

  if (toCompress.length === 0) {
    return {
      summary: '',
      compressedCount: 0,
      remainingMessages: remaining,
      tokensSaved: 0,
    };
  }

  const beforeTokens = tokenEstimator.estimate(messages);

  // 构建压缩提示词
  const compressionPrompt = buildCompressionPrompt(toCompress, maxSummaryLength);

  try {
    // 调用 LLM 生成摘要
    const summary = await callLLMForSummary(compressionPrompt, config.model);

    // 创建摘要消息
    const summaryMessage: AgentMessage = {
      id: `msg-compact-${Date.now()}`,
      role: 'assistant',
      content: summary,
      timestamp: new Date(),
      metadata: {
        _compaction: true,
        compressedFrom: toCompress.length,
        originalTokens: beforeTokens,
      },
    };

    const afterTokens = tokenEstimator.estimate([summaryMessage, ...remaining]);

    return {
      summary: summaryMessage.content,
      compressedCount: toCompress.length,
      remainingMessages: [summaryMessage, ...remaining],
      tokensSaved: beforeTokens - afterTokens,
    };
  } catch (err) {
    logger.error('[LLMCompaction] Failed to generate summary, falling back to truncation:', err);
    // 降级到简单截断
    return fallbackTruncateCompaction(messages, config);
  }
}

/**
 * 构建压缩提示词
 */
function buildCompressionPrompt(messages: AgentMessage[], maxSummaryLength: number): string {
  const conversation = messages
    .map((m) => `${m.role === 'user' ? '用户' : '助手'}: ${m.content.slice(0, 500)}`)
    .join('\n\n');

  return `请对以下对话进行摘要，提取关键信息和决策点。摘要应简洁但保留所有重要细节。

对话内容:
${conversation}

要求:
1. 摘要长度控制在 ${maxSummaryLength} 字以内
2. 保留关键决策、结论和数据
3. 使用中文回复
4. 按时间顺序组织摘要`;
}

/**
 * 调用 LLM 生成摘要
 */
async function callLLMForSummary(prompt: string, model?: string): Promise<string> {
  const response = await fetch('/api/v1/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个专业的文本摘要专家。' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API failed: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

/**
 * 降级方案：简单截断压缩
 */
function fallbackTruncateCompaction(
  messages: AgentMessage[],
  config: CompactionConfig,
): LLMCompactionResult {
  const { keepRecentCount } = { ...DEFAULT_CONFIG, ...config };
  const toCompress = messages.slice(0, -keepRecentCount);
  const remaining = messages.slice(-keepRecentCount);

  const beforeTokens = tokenEstimator.estimate(messages);
  const afterTokens = tokenEstimator.estimate(remaining);

  return {
    summary: `[上下文已压缩] 保留最近 ${remaining.length} 条消息，压缩了 ${toCompress.length} 条历史消息 (节省约 ${beforeTokens - afterTokens} tokens)。`,
    compressedCount: toCompress.length,
    remainingMessages: remaining,
    tokensSaved: beforeTokens - afterTokens,
  };
}

/**
 * 批量压缩多条消息历史
 */
export async function batchCompact(
  messages: AgentMessage[],
  config?: CompactionConfig,
): Promise<LLMCompactionResult[]> {
  const results: LLMCompactionResult[] = [];
  let currentMessages = [...messages];

  // 分批处理，每批压缩 50%
  while (currentMessages.length > 20) {
    const result = await generateContextSummary(currentMessages, config);
    results.push(result);
    currentMessages = result.remainingMessages;

    if (result.compressedCount === 0) break;
  }

  return results;
}
