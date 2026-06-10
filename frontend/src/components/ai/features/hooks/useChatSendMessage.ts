/**
 * useChatSendMessage - 消息发送处理 Hook (v1.0)
 *
 * 职责：集中处理消息发送的完整流水线
 * 1. 输入验证与去重
 * 2. NLP 意图识别
 * 3. 记忆系统更新（工作记忆/多轮对话/短期记忆）
 * 4. 增强 Prompt 构建（注入场景/意图/记忆上下文）
 * 5. 配方意图检测 → 结构化输出注入
 * 6. 调用 API 发送
 * 7. 响应后处理（记忆归档/FAQ缓存）
 *
 * @version 1.0.0
 * @lastUpdated 2026-06-07
 */

import { useCallback, useRef } from 'react'
import { useChatMessages } from './useChatMessages'
import type { ChatTabOrchestratorReturn } from './useChatTabOrchestrator'
import { formulaIntelligenceService } from '../services/formulaIntelligenceService'
import { logger } from '@/utils/safeLogger'
import type { IntentDetectionResult } from '../services/hybridNLPEngineV2'

/** 多轮对话处理结果（来自 useMultiTurnDialogue 内部 ProcessResult 的公开子集） */
export interface MultiTurnProcessResult {
  resolvedInput: string
  topicUpdate?: {
    type: 'switch' | 'return' | 'continue'
    topic?: { id: string; title: string }
  }
}

export interface UseChatSendMessageOptions {
  orchestrator: ChatTabOrchestratorReturn
  /** 可选的 RAG 增强函数：对用户问题进行知识库检索，返回增强后的 Prompt */
  ragAugment?: (question: string) => Promise<string>
}

export interface UseChatSendMessageReturn {
  handleSendMessage: (content: string) => Promise<void>
  buildEnhancedPrompt: (
    originalContent: string,
    intentResult: IntentDetectionResult | null,
    multiTurnResult: MultiTurnProcessResult | null,
  ) => string
  isSending: boolean
}

export function useChatSendMessage(
  chatMessages: ReturnType<typeof useChatMessages>,
  options: UseChatSendMessageOptions,
): UseChatSendMessageReturn {
  const { orchestrator, ragAugment } = options
  const { messages, sendMessage: chatServiceSendMessage, setInput } = chatMessages
  const {
    promptFramework,
    nlpEngine,
    workingMemory,
    multiTurnDialogue,
    shortTermMemory,
    thinkingProcessV3,
    scenarioSwitcher,
    userProfileManager,
  } = orchestrator

  const isSendingRef = useRef(false)
  // 持有最新的 messages 引用，供 setTimeout 后处理回调使用（避免闭包捕获过期值）
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const buildEnhancedPrompt = useCallback((
    originalContent: string,
    intentResult: IntentDetectionResult | null,
    multiTurnResult: MultiTurnProcessResult | null,
  ): string => {
    const contextParts: string[] = []

    // Step 1: 场景检测 + 注入场景化 System Prompt（Phase 4 接入 scenarioSwitcher）
    try {
      const detectResult = promptFramework.detectScenario(originalContent)
      if (detectResult?.primary) {
        contextParts.push(`[场景识别] ${detectResult.primary} (置信度: ${Math.round((detectResult.confidence || 0) * 100)}%)`)
      }

      // 注入场景切换器的完整 System Prompt（角色设定 + 格式约束）
      const scenarioPrompt = scenarioSwitcher.getFullSystemPrompt()
      if (scenarioPrompt) {
        contextParts.push(`[当前角色模式: ${scenarioSwitcher.getCurrentMode()}]\n${scenarioPrompt}`)
      }
    } catch (e) {
      logger.warn('[buildEnhancedPrompt] Scenario detection failed:', e)
    }

    // Step 2: 工作记忆上下文
    const memorySummary = workingMemory.getContextSummary()
    if (memorySummary) {
      contextParts.push('[记忆摘要] ' + (typeof memorySummary === 'string' ? memorySummary : JSON.stringify(memorySummary)))
    }

    // Step 3: 短期记忆
    const shortTermContext = shortTermMemory.getRecentContext()
    if (shortTermContext) {
      contextParts.push('[近期对话] ' + shortTermContext)
    }

    // Step 4: 多轮对话上下文
    if (multiTurnResult) {
      const dialogueContext: string[] = []
      if (multiTurnResult.topicUpdate?.topic) {
        dialogueContext.push('当前话题: ' + (multiTurnResult.topicUpdate.topic.title || multiTurnResult.topicUpdate.topic.id))
      }
      if (multiTurnResult.resolvedInput && multiTurnResult.resolvedInput !== originalContent) {
        dialogueContext.push('指代消解: "' + originalContent + '" → "' + multiTurnResult.resolvedInput + '"')
      }
      if (dialogueContext.length > 0) {
        contextParts.push('[多轮对话] ' + dialogueContext.join(' | '))
      }
    }

    // Step 5: 意图识别结果
    if (intentResult && intentResult.confidence >= 0.7) {
      const intentGuidance = [
        '检测意图: ' + intentResult.primaryIntent,
        '置信度: ' + Math.round((intentResult.confidence || 0) * 100) + '%',
      ]
      if (intentResult.entities?.length > 0) {
        const entities = intentResult.entities.map((e: any) => e.type + ':' + e.text).join(', ')
        intentGuidance.push('提取实体: ' + entities)
      }
      if (intentResult.sentiment?.sentiment) {
        const score = typeof intentResult.sentiment.score === 'number' && !isNaN(intentResult.sentiment.score)
          ? '(' + Math.round(intentResult.sentiment.score * 100) + '%)'
          : ''
        intentGuidance.push('情感倾向: ' + intentResult.sentiment.sentiment + score)
      }
      contextParts.push('[意图分析] ' + intentGuidance.join(' | '))
    }

    // Step 6: 用户偏好（从 userProfileManager 统一获取，避免重复调用 getContextSummary）
    const domainProfile = userProfileManager.getDomain()
    const prefParts: string[] = []
    if (domainProfile.responseStyle === 'concise') prefParts.push('简洁回答')
    else if (domainProfile.responseStyle === 'academic') prefParts.push('学术风格')
    if (domainProfile.technicalDepth === 'basic') prefParts.push('通俗易懂')
    else if (domainProfile.technicalDepth === 'advanced') prefParts.push('专业深度')
    if (!domainProfile.empathyEnabled) prefParts.push('禁用共情修饰')
    if (prefParts.length > 0) {
      contextParts.push('[用户偏好] ' + prefParts.join(', '))
    }

    const systemContext = contextParts.join('\n\n')
    return systemContext + '\n\n[用户输入]\n' + (multiTurnResult?.resolvedInput || originalContent)
  }, [promptFramework, workingMemory, shortTermMemory, userProfileManager])

  const handleSendMessage = useCallback(async (contentToSend: string) => {
    const trimmed = contentToSend.trim()
    if (!trimmed || isSendingRef.current) return
    isSendingRef.current = true

    const { startThinking: startThinkingV3, stopThinking: stopThinkingV3 } = thinkingProcessV3
    startThinkingV3(trimmed)

    try {
      // Step 1: NLP 意图识别
      let intentResult: IntentDetectionResult | null = null
      try {
        intentResult = await nlpEngine.detectIntent(trimmed, {
          context: messages.slice(-5).map(m => m.content),
          history: messages.slice(-10).map(m => `${m.role}: ${m.content.substring(0, 50)}`),
        })
      } catch (e) {
        logger.warn('[handleSendMessage] Intent detection failed:', e)
      }

      // Step 2: 记录到工作记忆
      try {
        workingMemory.addMessage({
          id: `wm-user-${Date.now()}`,
          role: 'user',
          content: trimmed,
          timestamp: Date.now(),
        })
        if (intentResult) {
          workingMemory.addIntent({
            intent: intentResult.primaryIntent,
            confidence: intentResult.confidence,
            timestamp: Date.now(),
            messageId: `wm-user-${Date.now()}`,
          })
        }
      } catch (e) {
        logger.warn('[handleSendMessage] Working memory update failed:', e)
      }

      // Step 3: 多轮对话处理
      let multiTurnResult: MultiTurnProcessResult | null = null
      try {
        multiTurnResult = await multiTurnDialogue.processUserInput(
          trimmed,
          messages as Parameters<typeof multiTurnDialogue.processUserInput>[1],
          async (text: string) => {
            const result = await nlpEngine.detectIntent(text)
            return { intent: result.primaryIntent, confidence: result.confidence }
          },
        )
      } catch (e) {
        logger.warn('[handleSendMessage] Multi-turn processing failed:', e)
      }

      // Step 4: 更新短期记忆兴趣画像
      try {
        if (intentResult?.primaryIntent) {
          shortTermMemory.updateInterest(intentResult.primaryIntent, trimmed.substring(0, 50))
        }
      } catch (e) {
        logger.warn('[handleSendMessage] Short-term memory update failed:', e)
      }

      // Step 5: 构建增强 Prompt
      const enhancedContent = buildEnhancedPrompt(trimmed, intentResult, multiTurnResult)

      // Step 5.5: RAG 知识库增强（可选）
      let ragContent = enhancedContent
      if (ragAugment) {
        try {
          const augmented = await ragAugment(trimmed)
          if (augmented !== trimmed) {
            ragContent = augmented + '\n\n---\n' + enhancedContent
            logger.info('[handleSendMessage] RAG context injected')
          }
        } catch (e) {
          logger.warn('[handleSendMessage] RAG augmentation failed:', e)
        }
      }

      // Step 6: 配方意图检测 → 注入结构化输出指令
      const formulaIntent = formulaIntelligenceService.detectIntent(trimmed)
      let finalContent = ragContent
      if (formulaIntent !== 'general_chat') {
        finalContent = enhancedContent + `

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
生成5-8个blocks，数据专业准确。`
      }

      // Step 7: 发送消息
      await chatServiceSendMessage(finalContent, trimmed)
      setInput('')

      // Step 8: 异步后处理（通过 ref 读取最新 messages，避免闭包捕获过期值）
      setTimeout(async () => {
        try {
          const currentMessages = messagesRef.current
          const latestMsgs = currentMessages.filter(m => m.role === 'assistant')
          if (latestMsgs.length > 0) {
            const last = latestMsgs[latestMsgs.length - 1]
            multiTurnDialogue.addConversationTurn(
              { id: `mt-${Date.now()}`, role: 'user', content: trimmed, timestamp: Date.now() },
              { id: `mt-ai-${Date.now()}`, role: 'assistant', content: last.content, timestamp: Date.now() },
            )
          }
          if (intentResult?.confidence >= 0.8) {
            const lastAssistantMsg = [...currentMessages].reverse().find(m => m.role === 'assistant')
            if (lastAssistantMsg) {
              shortTermMemory.cacheFAQ(trimmed, lastAssistantMsg.content.substring(0, 200))
            }
          }
        } catch (e) {
          logger.warn('[handleSendMessage] Post-processing failed:', e)
        }
      }, 0)

    } catch (error) {
      logger.error('[handleSendMessage] Send failed:', error)
      throw error
    } finally {
      stopThinkingV3()
      isSendingRef.current = false
    }
  }, [
    messages,
    chatServiceSendMessage,
    setInput,
    nlpEngine,
    workingMemory,
    multiTurnDialogue,
    shortTermMemory,
    thinkingProcessV3,
    scenarioSwitcher,
    userProfileManager,
    buildEnhancedPrompt,
  ])

  return {
    handleSendMessage,
    buildEnhancedPrompt,
    get isSending() { return isSendingRef.current },
  }
}
