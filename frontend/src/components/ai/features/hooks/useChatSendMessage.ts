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
import { useModelStore } from '@/stores/modelStore';

/**
 * RAG 增强专属超时（毫秒）—— 比通用 PREPROCESS_TIMEOUT 更激进。
 *
 * RAG 是「可选增强」，后端偶发慢查询时不该让用户干等 15s：
 * 8s 内失败即降级为原始问题，对话照常继续，仅在助手回复上显示
 * 微妙的「RAG 增强不可用」提示（见 MessageBubble / metadata.ragDegraded）。
 */
const RAG_TIMEOUT = 8_000;

export interface MultiTurnProcessResult {
  resolvedInput: string;
  topicUpdate?: {
    type: 'switch' | 'return' | 'continue';
    topic?: { id: string; title: string };
  };
}

export interface UseChatSendMessageOptions {
  orchestrator: ChatTabOrchestratorReturn;
  ragAugment?: (question: string) => Promise<{ question: string; rag_context: string[] | null }>;
  /** LLM 是否可用（用于降级路径优化：不可用时跳过无效预处理） */
  llmAvailable?: boolean;
  /** 当前场景模式，用于后端注入对应 system prompt */
  scenarioMode?: string;
}

export interface UseChatSendMessageReturn {
  handleSendMessage: (content: string) => Promise<void>;
  isSending: boolean;
}

export function useChatSendMessage(
  chatMessages: ReturnType<typeof useChatMessages>,
  options: UseChatSendMessageOptions,
): UseChatSendMessageReturn {
  const { orchestrator, ragAugment, llmAvailable = true, scenarioMode } = options;
  const { messages, sendMessage: chatServiceSendMessage, setInput, updateMessage, setStreamProgress } = chatMessages;
  // 从 model store 获取当前选中的模型（非响应式，发送时读取最新值）
  const selectedModel = useModelStore.getState().selectedModel;
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

      // P0 修复：240s 兜底定时器 — 防止单次挂死锁死整个模块
      // 即使 finally 块永远执行不到，4 分钟后也会自动解锁
      const safetyTimerId = setTimeout(() => {
        if (isSendingRef.current) {
          logger.warn('[handleSendMessage] Safety timer: forced reset of isSendingRef after 240s');
          isSendingRef.current = false;
        }
      }, 240_000);

      const { startThinking: startThinkingV3, stopThinking: stopThinkingV3 } = thinkingProcessV3;
      startThinkingV3(trimmed);

      try {
        // ── P0 修复：乐观清空 — 在任何预处理之前立即清空，防止预处理挂起导致输入框保留 ──
        setInput('');
        // ── 实时进度：请求准备开始（前端本地驱动 0→5）──
        setStreamProgress(0, 'preparing');
        setStreamProgress(5, 'preparing');

        // ── 降级路径优化：LLM 不可用时跳过所有无效预处理──
        // 原因：thinking_engine 是规则匹配，NLP/RAG/配方意图检测的输出对它无用，
        // 反而会污染 prompt（如注入 JSON 格式指令会让 thinking_engine 困惑）
        let finalContent = trimmed;
        let ragContext: string[] | undefined = undefined;
        // RAG 降级标记：RAG 增强超时/失败时置 true，用于在助手回复上显示
        // 微妙的「RAG 增强不可用」提示（不阻断对话流程）。
        let ragDegraded = false;

        if (llmAvailable) {
          // LLM 可用：执行完整预处理管线
          // ── P0 修复：预处理步骤加超时保护，防止 NLP/multi-turn/RAG 挂起 ──
          const PREPROCESS_TIMEOUT = 15_000;

          const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
            Promise.race([
              promise,
              new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
              ),
            ]);

          // Step 1: NLP 意图识别（仅用于后续逻辑分支，不注入用户 Prompt）
          let intentResult: IntentDetectionResult | null = null;
          try {
            intentResult = await withTimeout(nlpEngine.detectIntent(trimmed, {
              context: messages.slice(-5).map((m) => m.content),
              history: messages.slice(-10).map((m) => `${m.role}: ${m.content.length > 200 ? m.content.slice(0, 200) + '…' : m.content}`),
            }), PREPROCESS_TIMEOUT, 'NLP');
          } catch (e) {
            logger.warn('[handleSendMessage] Intent detection failed:', e);
          }

          // Step 2: 多轮对话处理（指代消解 + 话题追踪）
          try {
            await withTimeout(multiTurnDialogue.processUserInput(
              trimmed,
              messages as Parameters<typeof multiTurnDialogue.processUserInput>[1],
              async (text: string) => {
                // 复用已计算的 intentResult，避免重复调用 NLP 引擎
                if (intentResult && text === trimmed) {
                  return { intent: intentResult.primaryIntent, confidence: intentResult.confidence };
                }
                const result = await nlpEngine.detectIntent(text);
                return { intent: result.primaryIntent, confidence: result.confidence };
              },
            ), PREPROCESS_TIMEOUT, 'multi-turn');
          } catch (e) {
            logger.warn('[handleSendMessage] Multi-turn processing failed:', e);
          }

          // Step 3: RAG 知识库增强（可选）
          // 使用专属 RAG_TIMEOUT（8s）而非通用 PREPROCESS_TIMEOUT（15s）：
          // RAG 是可选增强，失败必须更快（更快失败 = 更快降级），用户无需等待 15s。
          if (ragAugment) {
            // 实时进度：知识库检索中（前端本地驱动 10）
            setStreamProgress(10, 'rag_retrieving');
            try {
              const { question: ragQuestion, rag_context: rc } = await withTimeout(ragAugment(trimmed), RAG_TIMEOUT, 'RAG');
              if (rc && rc.length > 0) {
                // 使用原始问题（不含 augmented_prompt），rag_context 通过参数传递给后端
                finalContent = ragQuestion;
                ragContext = rc;
                logger.info('[handleSendMessage] RAG context will be injected as rag_context:', {
                  chunks: ragContext.length,
                });
              }
              // rc 为空（无相关知识）≠ 降级，不提示；仅超时/异常才视为不可用。
              ragDegraded = false;
            } catch (e) {
              ragDegraded = true;
              logger.warn('[handleSendMessage] RAG augmentation failed, degraded to plain question:', e);
            }
            // 实时进度：检索阶段结束（无论成败），进入辨证/生成阶段（后端事件会锚定更高值）
            setStreamProgress(15, 'dialectics');
          }

          // Step 4: 配方意图检测 → 注入结构化输出指令
          const formulaIntent = formulaIntelligenceService.detectIntent(trimmed);
          // 只对【配方设计/优化/分析】类请求注入「专业配方设计卡」结构化输出指令；
          // 成分查询（ingredient_query）与普通问答（general_chat）不注入——
          // 避免普通问题被强制按配方报告格式输出（答非所问）。
          const isFormulaCardIntent =
            formulaIntent === 'formula_design' ||
            formulaIntent === 'formula_optimize' ||
            formulaIntent === 'formula_analyze';
          if (isFormulaCardIntent) {
            // 修复：移除超长 JSON 示例模板（后端 system prompt 已含完整专业配方设计卡协议与字段规范），
            // 仅保留一句简短指令，避免 question 超过后端 2000 字符上限导致 422。
            finalContent =
              finalContent +
              `
 
【结构化输出要求】
请以「专业配方设计卡」格式输出配方方案，使用 JSON 代码块包裹。JSON 之后只允许 1-2 句简短说明，禁止长篇 Markdown 报告。`;
          }
        }
        // llmAvailable=false: finalContent = trimmed（原始输入，不做任何污染）

        // Step 5: 发送消息
        await chatServiceSendMessage(finalContent, trimmed, scenarioMode, ragContext, selectedModel || undefined);

        // Step 5.5: RAG 降级用户反馈 —— 在助手回复上标记 metadata.ragDegraded，
        // MessageBubble 据此显示微妙的「RAG 增强不可用」提示（不阻断对话流程）。
        if (ragDegraded) {
          try {
            const assistantMsgs = messagesRef.current.filter((m) => m.role === 'assistant');
            const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
            if (lastAssistant) {
              updateMessage(lastAssistant.id, {
                metadata: {
                  ...(lastAssistant.metadata ?? {}),
                  ragDegraded: true,
                },
              });
            }
          } catch (e) {
            logger.warn('[handleSendMessage] RAG degradation hint mark failed:', e);
          }
        }

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
        clearTimeout(safetyTimerId);
        stopThinkingV3();
        isSendingRef.current = false;
      }
    },
    [
      messages,
      chatServiceSendMessage,
      setInput,
      updateMessage,
      nlpEngine,
      multiTurnDialogue,
      thinkingProcessV3,
      ragAugment,
      llmAvailable,
      scenarioMode,
    ],
  );

  return {
    handleSendMessage,
    get isSending() {
      return isSendingRef.current;
    },
  };
}
