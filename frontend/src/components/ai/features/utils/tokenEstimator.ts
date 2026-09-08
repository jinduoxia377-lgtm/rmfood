/**
 * Token Estimator - 精确 Token 计数
 *
 * 基于字符类别估算（简单版）
 * 后续可接入 tiktoken 实现精确计数
 */

import type { AgentMessage } from '@/components/ai/shared/types';

export class PreciseTokenEstimator {
  private readonly CJK_RATIO = 1.5;
  private readonly ASCII_RATIO = 4;
  private readonly FIXED_OVERHEAD = 4; // 每条消息固定开销

  estimate(messages: AgentMessage[]): number {
    return messages.reduce((sum, msg) => sum + this.estimateSingle(msg), 0);
  }

  estimateSingle(message: AgentMessage): number {
    const text = message.content;
    let chineseCount = 0;
    let asciiCount = 0;
    let otherCount = 0;

    for (const char of text) {
      const code = char.charCodeAt(0);
      if (code >= 0x4E00 && code <= 0x9FFF) {
        chineseCount++;
      } else if (code < 128) {
        asciiCount++;
      } else {
        otherCount++;
      }
    }

    // 固定开销 + 各类字符估算
    return Math.ceil(
      this.FIXED_OVERHEAD +
      chineseCount / this.CJK_RATIO +
      asciiCount / this.ASCII_RATIO +
      otherCount / 2
    );
  }
}

export const tokenEstimator = new PreciseTokenEstimator();

export function estimateTokens(text: string): number {
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