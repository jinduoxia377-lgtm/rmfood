/**
 * useChatSendMessage - 消息发送处理 Hook (v12.0 精简版)
 *
 * 精简说明 (2026-06-26):
 * - 移除工作记忆写入（纯内存操作，无持久化）
 * - 移除短期记忆兴趣画像更新（纯副作用，无反馈闭环）
 * - 移除 buildEnhancedPrompt 中的系统元数据注入（[记忆摘要]、[意图分析] 等）
 *   → 这些是系统层面关注点，不应作为用户输入发送给 LLM
 * - 保留：多轮对话指代消解、RAG 增强、配方意图检测
 * - 场景 System Prompt 改由后端注入（role="system"），不再前端拼接
 *
 * @version 12.0.0
 * @lastUpdated 2026-06-26
 */

import { useCallback, useRef } from 'react';
import { useChatMessages } from './useChatMessages';
import type { ChatTabOrchestratorReturn } from './useChatTabOrchestrator';
import { formulaIntelligenceService } from '../services/formulaIntelligenceService';
import { logger } from '@/utils/safeLogger';
import type { IntentDetectionResult } from '../services/hybridNLPEngineV2';

export interface MultiTurnProcessResult {
  resolvedInput: string;
  topicUpdate?: {
    type: 'switch' | 'return' | 'continue';
    topic?: { id: string; title: string };
  };
}

export interface UseChatSendMessageOptions {
  orchestrator: ChatTabOrchestratorReturn;
  ragAugment?: (question: string) => Promise<string>;
  /** LLM 是否可用（用于降级路径优化：不可用时跳过无效预处理） */
  llmAvailable?: boolean;
}

export interface UseChatSendMessageReturn {
  handleSendMessage: (content: string) => Promise<void>;
  isSending: boolean;
}

export function useChatSendMessage(
  chatMessages: ReturnType<typeof useChatMessages>,
  options: UseChatSendMessageOptions,
): UseChatSendMessageReturn {
  const { orchestrator, ragAugment, llmAvailable = true } = options;
  const { messages, sendMessage: chatServiceSendMessage, setInput } = chatMessages;
  const {
    nlpEngine,
    multiTurnDialogue,
    thinkingProcessV3,
  } = orchestrator;

  const isSendingRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const handleSendMessage = useCallback(
    async (contentToSend: string) => {
      const trimmed = contentToSend.trim();
      if (!trimmed || isSendingRef.current) return;
      isSendingRef.current = true;

      const { startThinking: startThinkingV3, stopThinking: stopThinkingV3 } = thinkingProcessV3;
      startThinkingV3(trimmed);

      try {
        // ── 降级路径优化：LLM 不可用时跳过所有无效预处理──
        // 原因：thinking_engine 是规则匹配，NLP/RAG/配方意图检测的输出对它无用，
        // 反而会污染 prompt（如注入 JSON 格式指令会让 thinking_engine 困惑）
        let finalContent = trimmed;

        if (llmAvailable) {
          // LLM 可用：执行完整预处理管线

          // Step 1: NLP 意图识别（仅用于后续逻辑分支，不注入用户 Prompt）
          let intentResult: IntentDetectionResult | null = null;
          try {
            intentResult = await nlpEngine.detectIntent(trimmed, {
              context: messages.slice(-5).map((m) => m.content),
              history: messages.slice(-10).map((m) => `${m.role}: ${m.content.substring(0, 50)}`),
            });
          } catch (e) {
            logger.warn('[handleSendMessage] Intent detection failed:', e);
          }

          // Step 2: 多轮对话处理（指代消解 + 话题追踪）
          let multiTurnResult: MultiTurnProcessResult | null = null;
          try {
            multiTurnResult = await multiTurnDialogue.processUserInput(
              trimmed,
              messages as Parameters<typeof multiTurnDialogue.processUserInput>[1],
              async (text: string) => {
                const result = await nlpEngine.detectIntent(text);
                return { intent: result.primaryIntent, confidence: result.confidence };
              },
            );
          } catch (e) {
            logger.warn('[handleSendMessage] Multi-turn processing failed:', e);
          }

          // Step 3: RAG 知识库增强（可选）
          if (ragAugment) {
            try {
              const augmented = await ragAugment(trimmed);
              if (augmented !== trimmed) {
                finalContent = augmented + '\n\n---\n' + trimmed;
                logger.info('[handleSendMessage] RAG context injected');
              }
            } catch (e) {
              logger.warn('[handleSendMessage] RAG augmentation failed:', e);
            }
          }

          // Step 4: 配方意图检测 → 注入结构化输出指令
          const formulaIntent = formulaIntelligenceService.detectIntent(trimmed);
          if (formulaIntent !== 'general_chat') {
            finalContent =
              finalContent +
              `

【输出格式要求】
你必须以JSON格式输出配方方案。将JSON放在\`\`\`json代码块中。格式如下:
{
  "blocks": [
    {"type":"header","data":{"title":"配方名称","description":"描述","level":1}},
    {"type":"metrics","data":{"title":"多维评分","items":[{"label":"功效","value":85,"unit":"分"}]}},
    {"type":"data-table","data":{"title":"配方组成","columns":[{"key":"name","label":"成分"},{"key":"dosage","label":"用量(g)"}],"rows":[{"name":"成分A","dosage":10}]}}
  ]
}
支持的block类型: header, metrics, data-table, chart, list, callout, divider.
生成5-8个blocks，数据专业准确。`;
          }
        }
        // llmAvailable=false: finalContent = trimmed（原始输入，不做任何污染）

        // Step 5: 发送消息
        await chatServiceSendMessage(finalContent, trimmed);
        setInput('');

        // Step 6: 同步更新多轮对话（不再用 setTimeout）
        try {
          const currentMessages = messagesRef.current;
          const latestMsgs = currentMessages.filter((m) => m.role === 'assistant');
          if (latestMsgs.length > 0) {
            const last = latestMsgs[latestMsgs.length - 1];
            multiTurnDialogue.addConversationTurn(
              { id: `mt-${Date.now()}`, role: 'user', content: trimmed, timestamp: Date.now() },
              { id: `mt-ai-${Date.now()}`, role: 'assistant', content: last.content, timestamp: Date.now() },
            );
          }
        } catch (e) {
          logger.warn('[handleSendMessage] Post-processing failed:', e);
        }
      } catch (error) {
        logger.error('[handleSendMessage] Send failed:', error);
        throw error;
      } finally {
        stopThinkingV3();
        isSendingRef.current = false;
      }
    },
    [
      messages,
      chatServiceSendMessage,
      setInput,
      nlpEngine,
      multiTurnDialogue,
      thinkingProcessV3,
      ragAugment,
      llmAvailable,
    ],
  );

  return {
    handleSendMessage,
    get isSending() {
      return isSendingRef.current;
    },
  };
}
