# AI 对话模块 Phase 1: 架构重构与债务清理 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 ChatTab 从 1109 行解构至 ≤300 行，清理废弃文件，建立工程化工具链

**Architecture:** 提取 ChatTab 中的业务逻辑到专用 Hooks/模块 (useChatTabOrchestrator, useChatSendMessage, useChatCallbacks)，使 ChatTab 回归纯布局容器职责

**Tech Stack:** React 19, TypeScript 5.7, Zustand, TanStack Query, Tailwind 4

---

### Task 1: 提取 useChatTabOrchestrator — 引擎管理 Hook

**Files:**
- Create: `frontend/src/components/ai/features/hooks/useChatTabOrchestrator.ts`
- Test: `frontend/src/components/ai/features/hooks/__tests__/useChatTabOrchestrator.test.ts`

**Responsibility:** 管理 ChatTab 中所有 AI 引擎的创建和生命周期 (hybridNLPEngineV2, useWorkingMemory, useMultiTurnDialogue, useShortTermMemory, useThinkingProcessV3, PromptEngineeringFramework)

- [ ] **Step 1: Create `useChatTabOrchestrator.ts`**

```typescript
/**
 * useChatTabOrchestrator - ChatTab 引擎编排 Hook (v1.0)
 *
 * 集中管理 ChatTab 所需的所有 AI 引擎：
 * - PromptEngineeringFramework V2.0 提示词引擎
 * - HybridNLPEngineV2 混合 NLP 引擎
 * - 三级记忆系统（工作记忆/多轮对话/短期记忆）
 * - 思考过程可视化 V3
 *
 * @version 1.0.0
 * @lastUpdated 2026-06-07
 */

import { useMemo } from 'react'
import { PromptEngineeringFramework } from '../services/promptEngineeringFramework'
import { hybridNLPEngineV2 } from '../services/hybridNLPEngineV2'
import { useWorkingMemory } from './useWorkingMemory'
import { useMultiTurnDialogue } from './useMultiTurnDialogue'
import { useShortTermMemory } from './useShortTermMemory'
import { useThinkingProcessV3 } from './useThinkingProcessV3'

export interface ChatTabOrchestratorReturn {
  // 提示词引擎
  promptFramework: PromptEngineeringFramework
  nlpEngine: typeof hybridNLPEngineV2

  // 工作记忆
  workingMemory: ReturnType<typeof useWorkingMemory>

  // 多轮对话
  multiTurnDialogue: ReturnType<typeof useMultiTurnDialogue>

  // 短期记忆
  shortTermMemory: ReturnType<typeof useShortTermMemory>

  // 思考过程
  thinkingProcessV3: ReturnType<typeof useThinkingProcessV3>
}

export function useChatTabOrchestrator(): ChatTabOrchestratorReturn {
  const promptFramework = useMemo(() => new PromptEngineeringFramework({
    maxLength: 8000,
    defaultTier: 'standard',
    enableAutoScenarioDetection: true,
    enableKnowledgeInjection: true,
    enableFewShotLearning: false,
    enableEffectTracking: true,
    enableQualityEvaluation: true,
    preferredLanguage: 'zh-CN',
  }), [])

  const workingMemory = useWorkingMemory()
  const multiTurnDialogue = useMultiTurnDialogue()
  const shortTermMemory = useShortTermMemory()
  const thinkingProcessV3 = useThinkingProcessV3()

  return {
    promptFramework,
    nlpEngine: hybridNLPEngineV2,
    workingMemory,
    multiTurnDialogue,
    shortTermMemory,
    thinkingProcessV3,
  }
}
```

- [ ] **Step 2: Write test for useChatTabOrchestrator**

```typescript
import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useChatTabOrchestrator } from '../useChatTabOrchestrator'

describe('useChatTabOrchestrator', () => {
  it('should return all engine instances', () => {
    const { result } = renderHook(() => useChatTabOrchestrator())

    expect(result.current.promptFramework).toBeDefined()
    expect(result.current.nlpEngine).toBeDefined()
    expect(result.current.workingMemory).toBeDefined()
    expect(result.current.multiTurnDialogue).toBeDefined()
    expect(result.current.shortTermMemory).toBeDefined()
    expect(result.current.thinkingProcessV3).toBeDefined()
  })

  it('should create PromptEngineeringFramework with correct config', () => {
    const { result } = renderHook(() => useChatTabOrchestrator())
    // Check it's a PromptEngineeringFramework instance by verifying key methods exist
    expect(typeof result.current.promptFramework.detectScenario).toBe('function')
    expect(typeof result.current.promptFramework.generatePrompt).toBe('function')
  })
})
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd /d/RMFOOD配方平台/frontend && npx vitest run src/components/ai/features/hooks/__tests__/useChatTabOrchestrator.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ai/features/hooks/useChatTabOrchestrator.ts frontend/src/components/ai/features/hooks/__tests__/useChatTabOrchestrator.test.ts
git commit -m "refactor(ai): extract useChatTabOrchestrator engine management hook"
```

---

### Task 2: 提取 useChatSendMessage — 消息发送处理 Hook

**Files:**
- Create: `frontend/src/components/ai/features/hooks/useChatSendMessage.ts`
- Test: `frontend/src/components/ai/features/hooks/__tests__/useChatSendMessage.test.ts`

**Responsibility:** 提取 ChatTab 中 `handleSendMessage` 和 `buildEnhancedPrompt` 逻辑为独立 Hook

- [ ] **Step 1: Create `useChatSendMessage.ts`**

```typescript
/**
 * useChatSendMessage - 消息发送处理 Hook (v1.0)
 *
 * 职责：集中处理消息发送的完整流水线
 * 1. 输入验证
 * 2. NLP 意图识别
 * 3. 记忆系统更新（工作记忆/多轮对话/短期记忆）
 * 4. 增强 Prompt 构建
 * 5. 调用 API 发送
 * 6. 响应后处理
 *
 * @version 1.0.0
 * @lastUpdated 2026-06-07
 */

import { useCallback, useRef } from 'react'
import { useChatMessages, type ChatMessage } from './useChatMessages'
import { useFormulaManager } from './useFormulaManager'
import { useReportGenerator } from './useReportGenerator'
import { type ChatTabOrchestratorReturn } from './useChatTabOrchestrator'
import { formulaIntelligenceService } from '../services/formulaIntelligenceService'
import { logger } from '@/utils/safeLogger'

export interface UseChatSendMessageOptions {
  chatMessages: ReturnType<typeof useChatMessages>
  formulaManager: ReturnType<typeof useFormulaManager>
  reportGenerator: ReturnType<typeof useReportGenerator>
  orchestrator: ChatTabOrchestratorReturn
}

export interface UseChatSendMessageReturn {
  handleSendMessage: (content: string) => Promise<void>
  buildEnhancedPrompt: (
    originalContent: string,
    intentResult: any,
    multiTurnResult: any,
  ) => string
  isSending: boolean
}

export function useChatSendMessage(options: UseChatSendMessageOptions): UseChatSendMessageReturn {
  const { chatMessages, orchestrator } = options
  const { messages, sendMessage: chatServiceSendMessage, setInput } = chatMessages
  const {
    promptFramework,
    nlpEngine,
    workingMemory,
    multiTurnDialogue,
    shortTermMemory,
    thinkingProcessV3,
  } = orchestrator

  const isSendingRef = useRef(false)

  const buildEnhancedPrompt = useCallback((
    originalContent: string,
    intentResult: any,
    multiTurnResult: any,
  ): string => {
    const contextParts: string[] = []

    // Step 1: 场景检测
    let scenarioDetection = { primary: 'general_inquiry' as any, confidence: 0 }
    try {
      const detectResult = promptFramework.detectScenario(originalContent)
      if (detectResult && detectResult.primary) {
        scenarioDetection = detectResult
        contextParts.push(`[场景识别] ${detectResult.primary} (置信度: ${Math.round(detectResult.confidence * 100)}%)`)
      }
    } catch (e) {
      logger.warn('[ChatTab] Scenario detection failed:', e)
    }

    // Step 2: 工作记忆上下文
    const memorySummary = workingMemory.getContextSummary()
    if (memorySummary) {
      contextParts.push('[记忆摘要] ' + memorySummary)
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

    // Step 6: 用户偏好
    const prefs = workingMemory.getContextSummary()?.userPreferences || {}
    const prefParts: string[] = []
    if (prefs.responseStyle === 'concise') prefParts.push('简洁回答')
    else if (prefs.responseStyle === 'academic') prefParts.push('学术风格')
    if (prefs.technicalDepth === 'basic') prefParts.push('通俗易懂')
    else if (prefs.technicalDepth === 'advanced') prefParts.push('专业深度')
    if (prefParts.length > 0) {
      contextParts.push('[用户偏好] ' + prefParts.join(', '))
    }

    const systemContext = contextParts.join('\n\n')
    return systemContext + '\n\n[用户输入]\n' + (multiTurnResult?.resolvedInput || originalContent)
  }, [promptFramework, workingMemory, shortTermMemory])

  const handleSendMessage = useCallback(async (contentToSend: string) => {
    if (!contentToSend.trim() || isSendingRef.current) return
    isSendingRef.current = true

    const { startThinking: startThinkingV3, stopThinking: stopThinkingV3 } = thinkingProcessV3

    startThinkingV3(contentToSend)

    try {
      // Step 1: NLP 意图识别
      let intentResult: any = null
      try {
        const intentStartTime = performance.now()
        intentResult = await nlpEngine.detectIntent(contentToSend, {
          context: messages.slice(-5).map(m => m.content),
          history: messages.slice(-10).map(m => `${m.role}: ${m.content.substring(0, 50)}`),
        })
        logger.info('[useChatSendMessage] Intent detected:', {
          intent: intentResult.primaryIntent,
          confidence: intentResult.confidence,
          processingTime: `${(performance.now() - intentStartTime).toFixed(1)}ms`,
        })
      } catch (e) {
        logger.warn('[useChatSendMessage] Intent detection failed:', e)
      }

      // Step 2: 记录到工作记忆
      try {
        workingMemory.addMessage({
          id: `wm-user-${Date.now()}`,
          role: 'user',
          content: contentToSend,
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
        logger.warn('[useChatSendMessage] Working memory update failed:', e)
      }

      // Step 3: 多轮对话处理
      let multiTurnResult: any = null
      try {
        multiTurnResult = await multiTurnDialogue.processUserInput(
          contentToSend,
          messages as any[],
          async (text: string) => {
            const result = await nlpEngine.detectIntent(text)
            return { intent: result.primaryIntent, confidence: result.confidence }
          },
        )
      } catch (e) {
        logger.warn('[useChatSendMessage] Multi-turn processing failed:', e)
      }

      // Step 4: 更新短期记忆
      try {
        if (intentResult?.primaryIntent) {
          shortTermMemory.updateInterest(intentResult.primaryIntent, contentToSend.substring(0, 50))
        }
      } catch (e) {
        logger.warn('[useChatSendMessage] Short-term memory update failed:', e)
      }

      // Step 5: 构建增强 Prompt
      const enhancedContent = buildEnhancedPrompt(contentToSend, intentResult, multiTurnResult)

      // Step 6: 配方意图检测 → 注入结构化输出指令
      const formulaIntent = formulaIntelligenceService.detectIntent(contentToSend)
      let finalContent = enhancedContent
      if (formulaIntent !== 'general_chat') {
        finalContent = enhancedContent + `

【输出格式要求】
你必须以JSON格式输出配方方案。将JSON放在\`\`\`json代码块中。格式如下:
{
  "blocks": [
    {"type":"header","data":{"title":"配方名称","description":"描述","level":1}},
    {"type":"metrics","data":{"title":"多维评分","items":[{"label":"功效","value":85,"unit":"分"}]}},
    {"type":"data-table","data":{"title":"配方组成","columns":[{"key":"name","label":"成分"},{"key":"dosage","label":"用量(g)"}],"rows":[{"name":"成分A","dosage":10}]}},
    {"type":"list","data":{"title":"配伍分析","variant":"analysis","items":[{"label":"分析项","status":"positive"}]}},
    {"type":"callout","data":{"variant":"summary","title":"总结","content":"说明文字"}}
  ]
}
支持的block类型: header, metrics, data-table, chart, list, callout, divider.
生成5-8个blocks，数据专业准确。`
      }

      // Step 7: 发送消息
      await chatServiceSendMessage(finalContent, contentToSend)
      setInput('')

      // Step 8: 异步后处理
      setTimeout(async () => {
        try {
          const latestMsgs = messages.filter(m => m.role === 'assistant')
          if (latestMsgs.length > 0) {
            const last = latestMsgs[latestMsgs.length - 1]
            multiTurnDialogue.addConversationTurn(
              { id: `mt-${Date.now()}`, role: 'user', content: contentToSend, timestamp: Date.now() },
              { id: `mt-ai-${Date.now()}`, role: 'assistant', content: last.content, timestamp: Date.now() },
            )
          }
          if (intentResult?.confidence >= 0.8) {
            const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant')
            if (lastAssistantMsg) {
              shortTermMemory.cacheFAQ(contentToSend, lastAssistantMsg.content.substring(0, 200))
            }
          }
        } catch (e) {
          logger.warn('[useChatSendMessage] Post-processing failed:', e)
        }
      }, 0)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('[useChatSendMessage] Send failed:', { error: errorMessage })
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
    buildEnhancedPrompt,
  ])

  return {
    handleSendMessage,
    buildEnhancedPrompt,
    isSending: isSendingRef.current,
  }
}
```

- [ ] **Step 2: Write test**

```typescript
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useChatSendMessage } from '../useChatSendMessage'

// Mock dependencies
vi.mock('../services/promptEngineeringFramework', () => ({
  PromptEngineeringFramework: vi.fn().mockImplementation(() => ({
    detectScenario: vi.fn().mockReturnValue({ primary: 'general_inquiry', confidence: 0.95 }),
    generatePrompt: vi.fn(),
  })),
}))

vi.mock('../services/hybridNLPEngineV2', () => ({
  hybridNLPEngineV2: {
    detectIntent: vi.fn().mockResolvedValue({
      primaryIntent: 'general_inquiry',
      confidence: 0.9,
      entities: [],
    }),
  },
}))

describe('useChatSendMessage', () => {
  const mockChatMessages = {
    messages: [],
    sendMessage: vi.fn().mockResolvedValue(undefined),
    setInput: vi.fn(),
    isStreaming: false,
    setIsStreaming: vi.fn(),
    chatError: null,
    setChatError: vi.fn(),
    addMessage: vi.fn(),
    updateMessage: vi.fn(),
    clearMessages: vi.fn(),
    retryLastMessage: vi.fn(),
    retryMessage: vi.fn(),
    clearError: vi.fn(),
    input: '',
    setInput: vi.fn(),
  }

  const mockFormulaManager = {} as any
  const mockReportGenerator = {} as any
  const mockOrchestrator = {
    promptFramework: { detectScenario: vi.fn(), generatePrompt: vi.fn() },
    nlpEngine: { detectIntent: vi.fn() },
    workingMemory: {
      addMessage: vi.fn(),
      addIntent: vi.fn(),
      getContextSummary: vi.fn().mockReturnValue(''),
      updateUserPreferences: vi.fn(),
    },
    multiTurnDialogue: {
      processUserInput: vi.fn().mockResolvedValue({}),
      addConversationTurn: vi.fn(),
    },
    shortTermMemory: {
      updateInterest: vi.fn(),
      cacheFAQ: vi.fn(),
      getRecentContext: vi.fn().mockReturnValue(''),
    },
    thinkingProcessV3: {
      startThinking: vi.fn(),
      stopThinking: vi.fn(),
    },
  } as any

  it('should return send function and prompt builder', () => {
    const { result } = renderHook(() => useChatSendMessage({
      chatMessages: mockChatMessages as any,
      formulaManager: mockFormulaManager,
      reportGenerator: mockReportGenerator,
      orchestrator: mockOrchestrator,
    }))

    expect(typeof result.current.handleSendMessage).toBe('function')
    expect(typeof result.current.buildEnhancedPrompt).toBe('function')
  })

  it('should build enhanced prompt with context', () => {
    const { result } = renderHook(() => useChatSendMessage({
      chatMessages: mockChatMessages as any,
      formulaManager: mockFormulaManager,
      reportGenerator: mockReportGenerator,
      orchestrator: mockOrchestrator,
    }))

    const prompt = result.current.buildEnhancedPrompt('测试问题', null, null)
    expect(prompt).toContain('测试问题')
    expect(prompt).toContain('[用户输入]')
  })
})
```

- [ ] **Step 3: Create `useChatCallbacks.ts`** — 提取 ChatTab 中的回调函数

```typescript
/**
 * useChatCallbacks - ChatTab 回调管理 Hook (v1.0)
 *
 * 集中管理 ChatTab 所需的 UI 回调函数。
 *
 * @version 1.0.0
 * @lastUpdated 2026-06-07
 */

import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { HistorySession } from '../components/pro'
import { saveSessions } from '../components/pro'

export interface UseChatCallbacksOptions {
  // Session state
  historySessions: HistorySession[]
  setHistorySessions: Dispatch<SetStateAction<HistorySession[]>>
  setActiveSessionId: Dispatch<SetStateAction<string | null>>
  historyVisible: boolean
  setHistoryVisible: Dispatch<SetStateAction<boolean>>

  // Chat state
  clearMessages: () => void

  // Formula state
  clearAllFormulas: () => void

  // AI memory
  clearWorkingMemory: () => void
  clearMultiTurnDialogue: () => void
  clearShortTermMemory: () => void
}

export interface UseChatCallbacksReturn {
  handleClearChat: () => void
  handleNewSession: () => void
  handleSelectSession: (id: string) => void
  handleDeleteSession: (id: string) => void
  handleRenameSession: (id: string, title: string) => void
  toggleHistory: () => void
}

export function useChatCallbacks(options: UseChatCallbacksOptions): UseChatCallbacksReturn {
  const {
    historySessions, setHistorySessions, setActiveSessionId,
    historyVisible, setHistoryVisible,
    clearMessages, clearAllFormulas,
    clearWorkingMemory, clearMultiTurnDialogue, clearShortTermMemory,
  } = options

  const handleClearChat = useCallback(() => {
    clearMessages()
    clearAllFormulas()
    clearWorkingMemory()
    clearMultiTurnDialogue()
    clearShortTermMemory()
  }, [clearMessages, clearAllFormulas, clearWorkingMemory, clearMultiTurnDialogue, clearShortTermMemory])

  const handleNewSession = useCallback(() => {
    const newSession: HistorySession = {
      id: `session-${Date.now()}`,
      title: '新对话',
      messageCount: 0,
      lastMessage: '',
      timestamp: Date.now(),
    }
    const updated = [newSession, ...historySessions]
    setHistorySessions(updated)
    setActiveSessionId(newSession.id)
    saveSessions(updated)
    handleClearChat()
  }, [historySessions, setHistorySessions, setActiveSessionId, handleClearChat])

  const handleSelectSession = useCallback((id: string) => {
    setActiveSessionId(id)
    handleClearChat()
  }, [setActiveSessionId, handleClearChat])

  const handleDeleteSession = useCallback((id: string) => {
    const updated = historySessions.filter(s => s.id !== id)
    setHistorySessions(updated)
    saveSessions(updated)
  }, [historySessions, setHistorySessions])

  const handleRenameSession = useCallback((id: string, title: string) => {
    const updated = historySessions.map(s => s.id === id ? { ...s, title } : s)
    setHistorySessions(updated)
    saveSessions(updated)
  }, [historySessions, setHistorySessions])

  const toggleHistory = useCallback(() => {
    setHistoryVisible(v => !v)
  }, [setHistoryVisible])

  return {
    handleClearChat,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession,
    toggleHistory,
  }
}
```

- [ ] **Step 4: Refactor ChatTab.tsx to use the new hooks**

Core change: ChatTab.tsx now imports `useChatTabOrchestrator`, `useChatSendMessage`, `useChatCallbacks` instead of individual engine hooks. It becomes a thin layout container (target ≤300 lines).

- [ ] **Step 5: Run tests**

Run: `cd /d/RMFOOD配方平台/frontend && npx vitest run src/components/ai/features/hooks/__tests__/useChatTabOrchestrator.test.ts src/components/ai/features/hooks/__tests__/useChatSendMessage.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ai/features/hooks/useChatSendMessage.ts frontend/src/components/ai/features/hooks/useChatCallbacks.ts frontend/src/components/ai/features/ChatTab.tsx
git commit -m "refactor(ai): extract useChatSendMessage and useChatCallbacks from ChatTab"
```

---

### Task 3: 清理废弃文件和架构文档

**Files:**
- Delete: `frontend/src/components/ai/features/ChatTab.v4.tsx`
- Delete: `frontend/src/components/ai/features/ARCHITECTURE.md`
- Delete: `frontend/src/components/ai/features/ARCHITECTURE_v8.md`
- Keep + consolidate: `frontend/src/components/ai/features/ARCHITECTURE_v9.md` → rename to `ARCHITECTURE.md`
- Test: Verify build passes after deletion

- [ ] **Step 1: Delete deprecated files**

```bash
rm -f /d/RMFOOD配方平台/frontend/src/components/ai/features/ChatTab.v4.tsx
rm -f /d/RMFOOD配方平台/frontend/src/components/ai/features/ARCHITECTURE.md
rm -f /d/RMFOOD配方平台/frontend/src/components/ai/features/ARCHITECTURE_v8.md
```

- [ ] **Step 2: Rename ARCHITECTURE_v9.md to ARCHITECTURE.md**

```bash
mv /d/RMFOOD配方平台/frontend/src/components/ai/features/ARCHITECTURE_v9.md /d/RMFOOD配方平台/frontend/src/components/ai/features/ARCHITECTURE.md
```

- [ ] **Step 3: Verify build**

Run: `cd /d/RMFOOD配方平台/frontend && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (or at least no errors related to deleted files)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(ai): remove deprecated ChatTab.v4.tsx and consolidate ARCHITECTURE docs"
```

---

### Task 4: 添加 Prettier + husky 工程化工具链

**Files:**
- Create: `frontend/.prettierrc`
- Create: `frontend/.prettierignore`
- Modify: `frontend/package.json` (add prettier scripts)

- [ ] **Step 1: Create `.prettierrc`**

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 120,
  "arrowParens": "always",
  "endOfLine": "lf",
  "jsxSingleQuote": false,
  "bracketSpacing": true
}
```

- [ ] **Step 2: Create `.prettierignore`**

```
dist/
node_modules/
coverage/
*.png
*.jpg
*.pdf
.vite/
```

- [ ] **Step 3: Add prettier scripts to package.json**

Edit `frontend/package.json` — add to `"scripts"`:
```json
"format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
"format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\""
```

Also add to devDependencies:
```json
"prettier": "^3.5.0"
```

- [ ] **Step 4: Install prettier**

Run: `cd /d/RMFOOD配方平台/frontend && npm install --save-dev prettier`
Expected: Installed without errors

- [ ] **Step 5: Verify format check runs**

Run: `cd /d/RMFOOD配方平台/frontend && npx prettier --check src/components/ai/features/hooks/useChatTabOrchestrator.ts 2>&1 | head -5`
Expected: No errors (or formatting warnings)

- [ ] **Step 6: Commit**

```bash
git add frontend/.prettierrc frontend/.prettierignore frontend/package.json
git commit -m "chore: add prettier configuration"
```

---

### Task 5: Mock 数据分离 — backend ai.py

**Files:**
- Modify: `backend/app/api/ai.py` (extract mock data)
- Create: `backend/app/data/mock_ai_responses.py`

- [ ] **Step 1: Create mock responses module**

```python
"""
AI 模拟响应数据（离线/演示模式）

这些响应仅在 AI 服务不可用时使用。生产环境应设置 AI_MOCK_MODE=false。
"""

import os

MOCK_MODE_ENABLED = os.getenv("AI_MOCK_MODE", "true").lower() == "true"

MOCK_HERB = """枸杞子（Lycium barbarum）是药食同源食材，具有以下功效：

**1. 滋补肝肾**：用于肝肾阴虚所致的头晕目眩、视力减退
**2. 益精明目**：富含玉米黄素和叶黄素，保护视力
**3. 免疫调节**：枸杞多糖增强免疫细胞活性
**4. 抗氧化**：富含枸杞多糖和类胡萝卜素，清除自由基

**建议用量**：6-15g/天
**适宜人群**：用眼过度、免疫力低下、中老年人"""

MOCK_FORMULA = """配方设计需要明确目标功效和适用人群，建议从以下步骤开始：

1. **确定功效定位**：抗氧化/免疫增强/肠道健康等
2. **选择君药**：核心功效成分的选择
3. **配伍臣药**：增强君药效果或辅助其他功能
4. **佐使调和**：调节口感、改善吸收

请告诉我您的具体需求，我可以为您提供更详细的建议。"""

MOCK_PAIRS = """黄芪和党参是经典的补气药对：

**协同作用**：
- 黄芪（君）：补气升阳，固表止汗
- 党参（臣）：补中益气，健脾益肺

**现代研究**：
- 黄芪多糖+党参皂苷协同增强免疫功能
- 共同促进能量代谢，改善疲劳

**推荐配比**：黄芪:党参 = 3:2"""

MOCK_DEFAULT = """感谢您的提问。我是RMFOOD AI配方顾问，目前处于离线演示模式。

关于您的问题，建议查阅以下资源：
- **药食同源目录**：国家卫健委公布的110+种药食同源物质
- **TCMSP数据库**：中药材系统药理学数据库
- **DFBP数据库**：食源性生物活性肽数据库

如需获得更精准的AI回答，请在系统设置中配置有效的API Key（支持OpenAI/DeepSeek/智谱等）。"""


def get_mock_response(question: str) -> str:
    """根据问题关键词返回对应的模拟响应"""
    q = question.lower()
    if any(k in q for k in ["枸杞子", "枸杞"]):
        return MOCK_HERB
    if any(k in q for k in ["配方", "设计", "搭配"]):
        return MOCK_FORMULA
    if any(k in q for k in ["黄芪", "党参"]):
        return MOCK_PAIRS
    return MOCK_DEFAULT
```

- [ ] **Step 2: Update ai.py to use the new mock module**

Replace the inline mock data at the top of `ai.py`:

```python
# 替换原本的 80 行内联 mock 数据：
# _MOCK_HERB, _MOCK_FORMULA, _MOCK_PAIRS, _MOCK_DEFAULT, _get_inline_mock()
# 
# 改为：
from app.data.mock_ai_responses import get_mock_response, MOCK_MODE_ENABLED
```

Also update the chat endpoint to use `get_mock_response` instead of `_get_inline_mock`.

- [ ] **Step 3: Verify import works**

Run: `cd /d/RMFOOD配方平台 && python -c "from app.data.mock_ai_responses import get_mock_response; print(get_mock_response('枸杞子功效'))"`
Expected: The mock herb response string

- [ ] **Step 4: Commit**

```bash
git add backend/app/data/mock_ai_responses.py backend/app/api/ai.py
git commit -m "refactor(backend): extract mock AI responses to separate module"
```

---

### Task 6: 添加核心 AI 服务测试

**Files:**
- Create: `backend/tests/unit/services/test_chat_service.py`
- Create: `frontend/src/components/ai/features/services/__tests__/chatService.test.ts`

- [ ] **Step 1: Create chatService unit test (frontend)**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatService } from '../chatService'

describe('ChatService', () => {
  let service: ChatService

  beforeEach(() => {
    service = new ChatService({
      timeout: 5000,
      maxRetries: 1,
      debounceMs: 100,
    })
  })

  it('should create instance with default config', () => {
    const defaultService = new ChatService()
    expect(defaultService).toBeInstanceOf(ChatService)
    expect(defaultService.getStateMachine()).toBeDefined()
  })

  it('should handle rate limit status', () => {
    const status = service.getRateLimitStatus()
    expect(status).toHaveProperty('remaining')
    expect(status).toHaveProperty('resetAt')
    expect(status).toHaveProperty('limit')
  })

  it('should return null for last error when no error occurred', () => {
    expect(service.getLastError()).toBeNull()
    expect(service.getClassifiedError()).toBeNull()
  })

  it('should set and clear auth token', () => {
    service.setAuthToken('test-token-123')
    // Can't directly test private token, but verify no error
    service.clearAuthToken()
    expect(service.getLastError()).toBeNull()
  })
})
```

- [ ] **Step 2: Run frontend test**

Run: `cd /d/RMFOOD配方平台/frontend && npx vitest run src/components/ai/features/services/__tests__/chatService.test.ts`
Expected: PASS

- [ ] **Step 3: Create backend chat service test**

```python
"""Tests for AI chat service"""
import pytest
from unittest.mock import AsyncMock, patch
from app.services.ai.chat_service import AIChatService


@pytest.mark.asyncio
async def test_send_message_with_mock():
    """Test sending a message in mock mode"""
    service = AIChatService(mock_mode=True)
    response = await service.send_message("测试枸杞的功效")
    assert response is not None
    assert "枸杞" in response.content


@pytest.mark.asyncio
async def test_send_message_empty():
    """Test sending empty message raises error"""
    service = AIChatService(mock_mode=True)
    with pytest.raises(ValueError, match="empty"):
        await service.send_message("")


@pytest.mark.asyncio
async def test_service_health_check():
    """Test health check returns correct status"""
    service = AIChatService(mock_mode=True)
    health = await service.health_check()
    assert health["status"] == "healthy"
    assert "mock" in health["mode"]
```

- [ ] **Step 4: Run backend test**

Run: `cd /d/RMFOOD配方平台 && python -m pytest backend/tests/unit/services/test_chat_service.py -v 2>&1 | head -20`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ai/features/services/__tests__/chatService.test.ts backend/tests/unit/services/test_chat_service.py
git commit -m "test: add chat service unit tests (frontend + backend)"
```

---

### Task 7: 完成 ChatTab 重构 — 精简为纯布局容器

When Tasks 1-3 are complete, refactor ChatTab.tsx to use the new hooks.

**Files:**
- Modify: `frontend/src/components/ai/features/ChatTab.tsx` (target ≤300 lines)

**Core transformation:**

```typescript
// Before: 10 individual hook calls + 4 engine imports + 1109 lines
// After: 3 consolidated hook calls + 300 lines

export function ChatTab({}: ChatTabProps) {
  const { t } = useTranslation()
  
  // ===== 1. Engine orchestration =====
  const orchestrator = useChatTabOrchestrator()
  
  // ===== 2. Data hooks =====
  const chatMessages = useChatMessages()
  const formulaManager = useFormulaManager()
  const reportGenerator = useReportGenerator(formulaManager.formulaIndex)
  
  // ===== 3. Send message handler =====
  const { handleSendMessage } = useChatSendMessage({
    chatMessages,
    formulaManager,
    reportGenerator,
    orchestrator,
  })
  
  // ===== 4. Callbacks =====
  const callbacks = useChatCallbacks({...})
  
  // ===== 5. UI state =====
  const [deepThinking, setDeepThinking] = useState(false)
  const [smartSearch, setSmartSearch] = useState(false)
  
  // ===== 6. JSX layout =====
  return (...)
}
```

- [ ] **Step 1: Refactor ChatTab.tsx imports and hook calls**
- [ ] **Step 2: Remove inline buildEnhancedPrompt and handleSendMessage**
- [ ] **Step 3: Remove inline ThinkingProcess imports (v8.0 deprecated path)**
- [ ] **Step 4: Verify TypeScript compilation**
- [ ] **Step 5: Commit**

---

## 执行选择

**Recommended approach:** Subagent-Driven — dispatch one agent per task for parallel execution with review checkpoints.
