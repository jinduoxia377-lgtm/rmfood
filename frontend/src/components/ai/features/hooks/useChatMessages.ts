import { useState, useCallback, useRef, useEffect } from 'react'
import { chatService } from '../services/chatService'
import { storageService } from '../services/storageService'
import { eventBus } from '../services/eventBus'
import { logger } from '@/utils/safeLogger'
import { sanitizeChatMessages } from '../utils/sanitizeChatMessages'
import { toFriendlyErrorMessage } from '../utils/friendlyError'
import type { ChatMessage } from '../types'
import { tokenBudgetManager } from '../capabilities/streaming/TokenBudgetManager'
import { contextCompactionEngine } from '../capabilities/streaming/ContextCompaction'
import { ChatState } from '../utils/chatStateMachine'
import { chatEventLog } from '../capabilities/storage/ChatEventLog'
import { chatStorageService } from '../capabilities/storage/ChatStorageService'
import { offlineManager } from '../utils/offlineManager'
import { userPreferencesService } from '../services/userPreferencesService'
import { MAX_MESSAGES } from '@/config/ai/constants'
import { detectStructuredContent } from '../components/structured/utils'
import { extractFormulaFromContent } from '../services/formulaExtractorService'
export type { ChatMessage } from '../types'

interface UseChatMessagesReturn {
  messages: ChatMessage[]
  input: string
  setInput: (value: string) => void
  isStreaming: boolean
  setIsStreaming: (streaming: boolean) => void
  chatError: Error | null
  setChatError: (error: Error | null) => void
  addMessage: (message: ChatMessage) => void
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void
  removeMessage: (id: string) => void
  clearMessages: () => void
  /** 替换所有消息（用于会话切换恢复） */
  replaceMessages: (messages: ChatMessage[]) => void
  sendMessage: (content: string, displayContent?: string, scenarioMode?: string, ragContext?: string[], model?: string) => Promise<void>
  retryLastMessage: () => Promise<void>
  /** 对指定失败消息重新发送（最大重试3次） */
  retryMessage: (messageId: string) => Promise<void>
  clearError: () => void
  /** 暂停流式输出 */
  isPaused: boolean
  pauseStreaming: () => void
  editMessage: (id: string, newContent: string) => void
  retractMessage: (id: string) => void
  /** 设置当前会话 ID（用于持久化到 IndexedDB） */
  setActiveSessionId: (id: string | null) => void
  /** 检查并执行上下文压缩（当 token 超限时自动触发） */
  checkCompaction: () => Promise<void>
  /** 实时进度：0-100（-1 表示 indeterminate） */
  streamProgress: number
  /** 实时进度阶段 i18n key（如 ai.chat.progress.generatingAnswer） */
  streamStageKey: string
  /** 已生成字符数 */
  streamChars: number
  /** 进度状态 */
  streamStatus: 'idle' | 'active' | 'indeterminate' | 'done' | 'error'
  /** 步骤指示器状态（检索/辨证/生成/校验） */
  streamSteps: Array<{ key: string; status: 'done' | 'active' | 'pending' }>
  /** 设置实时进度（本地阶段驱动，供发送链路调用） */
  setStreamProgress: (p: number, stageKey?: string, chars?: number) => void
}

const STORAGE_KEY = 'chat_messages'
const MAX_RETRY = 3 // 最大重试次数

export function useChatMessages(): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = storageService.get<ChatMessage[]>(STORAGE_KEY)
      if (!stored) return []

      // 一次性清理 v12 精简前遗留的脚手架污染消息（系统提示词/意图分析/报错气泡等）
      const { messages: cleaned, removedCount } = sanitizeChatMessages(stored)
      if (removedCount > 0) {
        logger.info(`[useChatMessages] 已清理 ${removedCount} 条历史污染消息`)
        try {
          if (cleaned.length > 0) {
            storageService.set(STORAGE_KEY, cleaned)
          } else {
            storageService.remove(STORAGE_KEY)
          }
        } catch (writeError) {
          logger.warn('[useChatMessages] 清理后写回存储失败:', writeError)
        }
      }
      // Normalize content: detect and preserve structured JSON blocks
      const normalized = cleaned.map(msg => {
        if (msg.role === 'assistant' && msg.content) {
          const trimmed = msg.content.trim()
          if (trimmed.startsWith('{') && trimmed.includes('"blocks"') && !trimmed.includes('```json')) {
            return { ...msg, content: '```json\n' + trimmed + '\n```' }
          }
        }
        return msg
      })
      
      const hasChanges = normalized.some((m: any, i: number) => m.content !== cleaned[i].content)
      if (hasChanges) {
        try { storageService.set(STORAGE_KEY, normalized) } catch { /* 忽略写回失败 */ }
      }
      
      return normalized
    } catch (error) {
      logger.warn('[useChatMessages] Failed to load messages from storage:', error)
      return []
    }
  })

  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  // ── 实时进度条状态 ──
  const [streamProgress, setStreamProgressState] = useState<number>(0)
  // P0-6 修复：记录后端已上报的真实进度峰值。时间兜底定时器只能在真实进度以下做平滑填充，
  // 不得用 Math.max 把假进度顶到真进度之上（旧逻辑会让「后端 5%」被「时间 60%」压制，进度条造假）。
  const realProgressRef = useRef(0)
  const [streamStageKey, setStreamStageKey] = useState('')
  const [streamChars, setStreamChars] = useState(0)
  const [streamStatus, setStreamStatus] = useState<'idle' | 'active' | 'indeterminate' | 'done' | 'error'>('idle')
  const [streamSteps, setStreamSteps] = useState<Array<{ key: string; status: 'done' | 'active' | 'pending' }>>([
    { key: 'retrieval', status: 'pending' },
    { key: 'dialectics', status: 'pending' },
    { key: 'generating', status: 'pending' },
    { key: 'safety', status: 'pending' },
  ])
  const [chatError, setChatError] = useState<Error | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  // 用户是否【主动】暂停（区别于自然结束/错误）。主动暂停时 finally 不清除 isPaused。
  const userPausedRef = useRef(false)
  // P1 并发锁（交叉评审补）：同步标记「是否有发送/流式正在进行」。isStreaming 是 state、
  // 由状态机监听器异步驱动，同一 tick 内可能尚未翻转，无法防住「流式中再起一路」的竞态；
  // streamingRef 同步置位/复位，配合下方 sendMessage 入口守卫做第一道防线。
  const streamingRef = useRef(false)
  const messagesRef = useRef(messages)
  const lastQuestionRef = useRef<string>('')
  const activeSessionIdRef = useRef<string | null>(null)

  // ── 实时进度：stage 代码 → i18n key / 步骤指示器 key 映射 ──
  const PROGRESS_STAGE_KEY_MAP: Record<string, string> = {
    preparing: 'ai.chat.progress.preparing',
    rag_retrieving: 'ai.chat.progress.ragRetrieving',
    dialectics: 'ai.chat.progress.dialecticsThinking',
    llm_start: 'ai.chat.progress.llmStarting',
    generating: 'ai.chat.progress.generatingAnswer',
    safety_check: 'ai.chat.progress.safetyChecking',
    finalizing: 'ai.chat.progress.finalizing',
    done: 'ai.chat.progress.completing',
    failed: 'ai.chat.progress.failed',
  }
  const PROGRESS_STAGE_STEP_MAP: Record<string, string> = {
    rag_retrieving: 'retrieval',
    dialectics: 'dialectics',
    llm_start: 'generating',
    generating: 'generating',
    safety_check: 'safety',
    finalizing: 'safety',
  }
  const PROGRESS_STEP_ORDER = ['retrieval', 'dialectics', 'generating', 'safety']

  const applyProgress = useCallback((p: number, stage?: string, chars?: number) => {
    // 进度只进不退（max 合并）；同时记录真实进度峰值，供时间兜底定时器作为上限
    const clamped = Math.max(0, Math.min(100, p))
    realProgressRef.current = Math.max(realProgressRef.current, clamped)
    setStreamProgressState(prev => Math.max(prev, clamped))
    if (stage) {
      if (stage === 'done') {
        // done 阶段：所有步骤一次性置为完成，避免 safety 停留在 active（脉冲）永不收尾
        setStreamSteps(prev => prev.map(s => ({ ...s, status: 'done' })))
      } else {
        const i18nKey = PROGRESS_STAGE_KEY_MAP[stage]
        if (i18nKey) setStreamStageKey(i18nKey)
        const stepKey = PROGRESS_STAGE_STEP_MAP[stage]
        if (stepKey) {
          setStreamSteps(prev => {
            const idx = PROGRESS_STEP_ORDER.indexOf(stepKey)
            return prev.map((s, i) => ({
              ...s,
              status: i < idx ? 'done' : i === idx ? 'active' : 'pending',
            }))
          })
        }
      }
    }
    if (typeof chars === 'number' && chars >= 0) setStreamChars(chars)
  }, [])

  // ── 监听认证失效事件，清除过期 Token ──
  useEffect(() => {
    const unsub = eventBus.subscribe('auth:required', () => {
      logger.warn('[useChatMessages] 收到 auth:required 事件，清除过期 Token')
      storageService.remove('access_token')
      storageService.remove('refresh_token')
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      chatService.clearAuthToken()
    })
    return unsub
  }, [])

  // ── 组件 unmount 时清理所有 pending SSE 请求 ──
  useEffect(() => {
    return () => {
      logger.info('[useChatMessages] Unmount cleanup: aborting all pending SSE requests')
      chatService.closeAllPendingRequests()
    }
  }, [])

  // ── P0-3: 订阅 chatService 状态机，统一 isStreaming 来源，消除 UI 状态漂移 ──
  useEffect(() => {
    const machine = chatService.getStateMachine()
    const listener = (_from: ChatState, to: ChatState) => {
      setIsStreaming(to === ChatState.Streaming || to === ChatState.Paused)
    }
    const off = machine.addStateListener(listener)
    return off
  }, [])

  // ── 实时进度：本地兜底平滑推进（后端不发 progress 事件时，按时间目标爬升）──
  // P0-6 修复：时间兜底不得覆盖后端真进度。有真进度时以真进度为上限（只在其下平滑填充），
  // 完全无真进度时才允许时间爬升兜底（封顶 90）。旧逻辑 `Math.max(prev, target)` 会让假进度
  // 压制后端真进度（后端报 5% 却被时间 60% 顶掉），现以 realProgressRef 为硬上限消除压制。
  useEffect(() => {
    if (!isStreaming) return
    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000
      let target = 5
      if (elapsed >= 30) target = 90
      else if (elapsed >= 20) target = 85
      else if (elapsed >= 10) target = 60
      else if (elapsed >= 4) target = 45
      else if (elapsed >= 1.5) target = 15
      const real = realProgressRef.current
      // 有真进度：兜底上限 = 真进度（不覆盖）；无真进度：兜底上限 = 90（保留时间爬升）
      const cap = real > 0 ? real : 90
      const effective = Math.min(target, cap)
      setStreamProgressState(prev => Math.max(prev, effective))
    }, 800)
    return () => clearInterval(timer)
  }, [isStreaming])

  // ADR-029 P1-3: 统一存储策略 - IndexedDB 作为主存储，localStorage 仅作降级兜底
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 性能优化：内容未变时跳过重复保存。
  // LLM 长时间无输出时 messages 数组引用可能频繁变化（如状态机/心跳重渲染），
  // 每次引用变化都会触发 500ms 防抖保存 → IndexedDB 刷屏写入。内容签名不变则跳过。
  const lastSavedContentRef = useRef('')
  const saveToStorage = useCallback((newMessages: ChatMessage[]) => {
    try {
      if (newMessages.length > MAX_MESSAGES) {
        newMessages = newMessages.slice(-MAX_MESSAGES)
      }

      // 内容签名：id + 内容长度 + 末尾 40 字符。内容未变（仅引用抖动）时跳过保存。
      const contentSignature = newMessages
        .map(m => `${m.id}:${(m.content || '').length}:${(m.content || '').slice(-40)}`)
        .join('|')
      if (contentSignature === lastSavedContentRef.current) return
      lastSavedContentRef.current = contentSignature

      // 优先写入 IndexedDB（支持大容量会话），并防抖同步到服务器（云端备份）
      if (activeSessionIdRef.current && newMessages.length > 0) {
        const sid = activeSessionIdRef.current
        chatStorageService.saveMessages(sid, newMessages)
          .then(() => {
            // 治本：即使刷新/本地缓存失效，登录后也可从服务器恢复
            if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
            syncTimerRef.current = setTimeout(() => {
              chatStorageService.syncToServer(sid).catch(e =>
                logger.warn('[useChatMessages] 云端同步失败（本地已保存，不影响使用）:', e))
            }, 2000)
          })
          .catch(e => logger.warn('[useChatMessages] IndexedDB save failed:', e))
      }

      // localStorage 降级：仅当 IndexedDB 失败时使用
      // 注意：localStorage 有 ~5MB 限制，不适合大会话
      const isIndexedDBSupported = typeof indexedDB !== 'undefined'
      if (!isIndexedDBSupported) {
        storageService.set(STORAGE_KEY + '_fallback', newMessages)
        logger.warn('[useChatMessages] IndexedDB 不可用，降级到 localStorage')
      }
    } catch (storageError) {
      logger.warn('[useChatMessages] Failed to save messages to storage:', storageError)
    }
  }, [])

  // ── ChatEventLog 集成：所有消息变更写入事件日志 ──
  // P0 修复：添加防抖 — 原实现每次 EventLog 变更立即写入 IndexedDB，
  // SSE 流式更新期间每个 chunk 触发一次写入，导致 100ms 内 3-4 次重复保存。
  const eventLogSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 性能优化：EventLog 可能因非消息事件（状态机/心跳）频繁触发 onChange，
  // 但派生出的消息内容未变时无需重复写 IndexedDB。内容签名不变则跳过。
  const lastEventLogSyncSigRef = useRef('')
  useEffect(() => {
    return chatEventLog.onChange(() => {
      // EventLog 变更时防抖同步到 IndexedDB（300ms 合并窗口）
      if (eventLogSyncTimerRef.current) clearTimeout(eventLogSyncTimerRef.current)
      eventLogSyncTimerRef.current = setTimeout(() => {
        const currentMessages = chatEventLog.deriveMessages()
        if (currentMessages.length > 0 && activeSessionIdRef.current) {
          const sig = currentMessages
            .map(m => `${m.id}:${(m.content || '').length}:${(m.content || '').slice(-40)}`)
            .join('|')
          if (sig === lastEventLogSyncSigRef.current) return
          lastEventLogSyncSigRef.current = sig
          chatStorageService.saveMessages(activeSessionIdRef.current, currentMessages).catch(e =>
            logger.warn('[useChatMessages] EventLog sync failed:', e)
          )
        }
      }, 300)
    })
  }, [])

  // P0 修复（会话串写）：会话切换前冲刷挂起的防抖保存。清掉旧会话的防抖定时器，
  // 并把当前内存消息同步落库到指定会话 id，确保旧流尾部内容归属正确会话，
  // 且切换后不再有旧定时器以新会话 id 触发串写。由 setActiveSessionId 在切 ref 前调用。
  const flushPendingSavesForSession = useCallback((sid: string | null) => {
    if (syncTimerRef.current) { clearTimeout(syncTimerRef.current); syncTimerRef.current = null }
    if (eventLogSyncTimerRef.current) { clearTimeout(eventLogSyncTimerRef.current); eventLogSyncTimerRef.current = null }
    if (sid && messagesRef.current.length > 0) {
      chatStorageService.saveMessages(sid, messagesRef.current).catch(e =>
        logger.warn('[useChatMessages] 切换会话前冲刷保存失败:', e))
    }
  }, [])

  const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages(prev => {
      const newMessages = updater(prev)
      messagesRef.current = newMessages
      return newMessages
    })
  }, [])

  // P0 修复：防抖保存 — 避免每次 setMessages 都立即触发 IndexedDB 写入，
  // 防止 FollowUpSuggestionBar → setSuggestions → re-render → setMessages → save → 循环
  useEffect(() => {
    if (messages.length === 0) return
    const timer = setTimeout(() => saveToStorage(messages), 500)
    return () => clearTimeout(timer)
  }, [messages, saveToStorage])

  const addMessage = useCallback((message: ChatMessage) => {
    updateMessages(prev => [...prev, message])
  }, [updateMessages])

  const updateMessage = useCallback((id: string, updates: Partial<ChatMessage>) => {
    updateMessages(prev =>
      prev.map(msg => (msg.id === id ? { ...msg, ...updates } : msg)),
    )
  }, [updateMessages])

  const clearMessages = useCallback(async () => {
    setMessages([])
    messagesRef.current = []
    storageService.remove(STORAGE_KEY)
    // 同步清理 IndexedDB，防止切换回该会话时恢复已清除的消息
    if (activeSessionIdRef.current) {
      try { await chatStorageService.deleteMessages(activeSessionIdRef.current) }
      catch (e) { logger.warn('[useChatMessages] IndexedDB 清理失败:', e) }
    }
    logger.info('[useChatMessages] Messages cleared')
  }, [])

  const removeMessage = useCallback((id: string) => {
    updateMessages(prev => prev.filter(m => m.id !== id))
  }, [updateMessages])

  /** 替换所有消息（会话切换时从隔离存储恢复） */
  const replaceMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessages(newMessages)
    messagesRef.current = newMessages
    saveToStorage(newMessages)
    logger.info(`[useChatMessages] Messages replaced (${newMessages.length} items)`)
  }, [saveToStorage])

  const clearError = useCallback(() => {
    setChatError(null)
  }, [])

  const sendMessage = useCallback(async (content: string, displayContent?: string, scenarioMode?: string, ragContext?: string[], model?: string) => {
    if (!content?.trim()) {
      logger.warn('[useChatMessages] ⚠️ Empty message content, ignoring send request')
      return
    }

    // P1 并发锁（交叉评审补）：流式进行中拒绝再起一路，防止「重新生成/删除」等路径
    // 在流式中并发触发第二路流（双回复/状态竞态/摘掉正在写的占位）。
    if (streamingRef.current || isStreaming) {
      logger.warn('[useChatMessages] 🚫 已有发送/流式正在进行，忽略并发发送请求')
      return
    }

    if (isPaused) {
      // 用户主动发起新消息 = 取消暂停，继续对话（而不是拒绝发送导致卡死）
      logger.info('[useChatMessages] 用户发送新消息，取消暂停状态')
      userPausedRef.current = false
      setIsPaused(false)
    }

    lastQuestionRef.current = content.trim()
    const userDisplayContent = (displayContent || content).trim()

    logger.info('[useChatMessages] 🚀 Starting message send:', {
      contentLength: content.trim().length,
      contentPreview: content.trim().substring(0, 50) + (content.trim().length > 50 ? '...' : ''),
      timestamp: Date.now(),
    })

    setChatError(null)
    // ── 实时进度：新发送开始，重置进度条状态 ──
    setStreamProgressState(0)
    realProgressRef.current = 0 // P0-6：同步重置真实进度峰值，避免上一轮真进度成为本轮兜底上限
    setStreamChars(0)
    setStreamStageKey('ai.chat.progress.preparing')
    setStreamStatus('active')
    setStreamSteps([
      { key: 'retrieval', status: 'pending' },
      { key: 'dialectics', status: 'pending' },
      { key: 'generating', status: 'pending' },
      { key: 'safety', status: 'pending' },
    ])
    // P0-2 修复：移除直接 setIsStreaming(true)，由状态机监听器（line 128-135）统一驱动
    // chatService.sendMessageStream 内部会 transition(Streaming)，监听器自动设置 isStreaming=true

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      role: 'user',
      content: userDisplayContent,
      timestamp: Date.now(),
      sendStatus: 'sending', // 先标记为发送中
      retryCount: 0,
    }

    addMessage(userMessage)
    logger.info('[useChatMessages] ✅ User message added to UI (status=sending):', { messageId: userMessage.id })

    // ── P1 修复：sendStatus 超时兜底 — 4 分钟仍未完成则强制标记失败 ──
    // P2 修复（240s 超时与正常完成竞态）：sendSettled 在流正常结束（chunk.done）/
    // 非流式降级成功时同步置 true；超时回调先检查该标志，避免「已收到真实回复却仍追加超时错误」。
    let sendSettled = false
    const sendStatusTimerId = setTimeout(() => {
      logger.warn('[useChatMessages] ⏰ sendStatus timeout fallback triggered (240s)')
      // 流已正常结束（或降级成功）→ 不再注入超时错误，防止超时错误与真实回复并存
      if (sendSettled) return
      const currentMsg = messagesRef.current.find(m => m.id === userMessage.id)
      if (currentMsg && currentMsg.sendStatus === 'sending') {
        updateMessage(userMessage.id, { sendStatus: 'failed' })
        addMessage({
          id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          error: '消息发送超时，请重试',
        })
      }
    }, 240_000)

    // P1 并发锁：进入流式主体前置位，finally 复位（保证任何退出路径都释放）
    streamingRef.current = true

    try {
      logger.info('[useChatMessages] 📡 Calling chatService (streaming mode)...')
      // 使用 TokenBudgetManager 选择完整上下文，不再硬截断 1000 字
      const history = tokenBudgetManager.selectHistory(messagesRef.current)

      // 先创建空的 AI 消息占位（用于流式渐进更新）
      const assistantMessageId = `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isLoading: true,
      }
      addMessage(assistantMessage)

      // 使用流式 SSE API 获取响应（失败时自动降级为非流式）
      let fullContent = ''
      let streamModel = ''  // 回复来源（后端 meta 事件），用于展示来源徽标
      let streamDialectics: ChatMessage['dialectics'] = undefined
      let hasError = false
      let errorMessage = ''

      // ── 尝试 1: 流式 SSE ──
      try {
        for await (const chunk of chatService.sendMessageStream(content.trim(), history, true, {
          scenarioMode, ragContext, model,
          clientSessionId: activeSessionIdRef.current || undefined,
        })) {
          if (chunk.done) {
            // P2 修复：流正常结束即视为已落定，立刻清除超时兜底，避免结构化解析期间
            // 240s 定时器误触发，导致「超时错误气泡 + 真实回复」同时出现。
            sendSettled = true
            clearTimeout(sendStatusTimerId)
            applyProgress(100, 'done')
            setStreamStatus('done')
            break
          }
          // 思考步骤事件不追加到对话内容（仅转发到侧栏）
          if (!chunk.step) {
            fullContent += chunk.content
          }

          // ⚠️ accumulatedFormulas 已移除：后端从不发送 type=formula SSE 事件，
          // 配方数据统一通过 detectStructuredContent + extractFormulaFromContent 从最终内容解析。

          // 转发思考步骤到 ChatSidebar（通过 eventBus）
          if (chunk.step) {
            eventBus.emit('thinking:step', { step: chunk.step.step, content: chunk.step.content, status: chunk.step.status, timestamp: Date.now() })
          }

          // 回复来源标识（后端通过 type=meta 事件发送，通常为首个事件）
          if (chunk.model) {
            streamModel = chunk.model
          }

          // 辨证分析（后端通过 type=dialectics 事件发送）
          if (chunk.dialectics) {
            streamDialectics = chunk.dialectics
          }

          // 实时进度（后端通过 type=progress 事件发送）
          if (chunk.progress) {
            applyProgress(chunk.progress.percent, chunk.progress.stage, chunk.progress.chars)
          }

          updateMessage(assistantMessageId, {
            content: fullContent,
            model: streamModel || undefined,
            dialectics: streamDialectics || undefined,
          })
        }
      } catch (streamError) {
        const streamErrMsg = streamError instanceof Error ? streamError.message : String(streamError)

        // ── 如果是认证错误，跳过降级（非流式也会遇到同样的认证问题）──
        const isStreamAuthError = streamErrMsg.includes('401') || streamErrMsg.includes('认证') || streamErrMsg.includes('Token') || streamErrMsg.includes('未授权') || streamErrMsg.includes('未登录') || streamErrMsg.includes('请先登录')
        if (isStreamAuthError) {
          logger.warn('[useChatMessages] Stream failed with auth error, skipping fallback (would also fail)')
          clearTimeout(sendStatusTimerId)
          updateMessage(userMessage.id, { sendStatus: 'failed' })
          removeMessage(assistantMessageId)
          return // auth:required 事件已在 ChatService 中触发
        }

        // ── 尝试 2: 非流式降级（非认证类错误才降级）──
        // 保留流式已收到的内容，追加而非替换
        logger.warn('[useChatMessages] Stream failed, falling back to non-streaming:', streamErrMsg)
        // 实时进度：非流式降级 → 不确定进度（无真实百分比）
        setStreamStatus('indeterminate')
        try {
          const response = await chatService.sendMessage(content.trim(), history, {
            scenarioMode, ragContext, model,
            clientSessionId: activeSessionIdRef.current || undefined,
          })
          // 追加到已收到的流式内容后面
          fullContent = fullContent + (fullContent ? '\n\n' : '') + response.content
          updateMessage(assistantMessageId, {
            content: fullContent,
            formulas: response.formulas || undefined,
            isLoading: false,
            // 传递回复来源，供 MessageBubble 展示「大模型 / 规则引擎降级」徽标
            model: response.model,
          })
          // 实时进度：非流式响应返回，视为完成
          sendSettled = true
          clearTimeout(sendStatusTimerId)
          applyProgress(100, 'done')
          setStreamStatus('done')
        } catch (fallbackError) {
          // 流式和非流式均失败
          const errMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          logger.error('[useChatMessages] Both streaming and fallback failed:', errMsg)

          // 认证错误不显示气泡（auth:required 事件已在 ChatService 中触发重新登录）
          const isAuthError = errMsg.includes('401') || errMsg.includes('认证') || errMsg.includes('Token') || errMsg.includes('未授权') || errMsg.includes('未登录') || errMsg.includes('请先登录')
          if (!isAuthError) {
            hasError = true
            errorMessage = errMsg
          } else {
            // 认证失败：清理占位消息，标记用户消息为失败，但不设 chatError（避免显示多余错误提示）
            clearTimeout(sendStatusTimerId)
            updateMessage(userMessage.id, { sendStatus: 'failed' })
            removeMessage(assistantMessageId)
            return // 由 auth:required 事件处理重新登录
          }
        }
      }

      // 统一处理结果
      if (!hasError) {
        // 流式结束后用「完整结构化解析」生成最终配方，与 handleStructureSave 保存链路一致
        let finalFormulas: any[] = []
        try {
          const structured = detectStructuredContent(fullContent)
          if (structured) {
            const extracted = extractFormulaFromContent(structured)
            if (extracted) finalFormulas = [extracted]
          }
        } catch (parseError) {
          logger.warn('[useChatMessages] 流式配方完整解析失败:', parseError)
        }
        updateMessage(assistantMessageId, {
          isLoading: false,
          formulas: finalFormulas.length > 0 ? finalFormulas : undefined,
        })
        clearTimeout(sendStatusTimerId)
        updateMessage(userMessage.id, { sendStatus: 'sent' })

        // ── 写入 EventLog（append-only） ──
        chatEventLog.append('user/message', userMessage)
        chatEventLog.append('assistant/message', { ...assistantMessage, id: assistantMessageId, content: fullContent })

        // ── 自动提取对话偏好并更新用户画像 ──
        // P0 修复：使用用户输入（content）而非 AI 回复（fullContent）提取偏好，
        // 避免 AI 回复中的关键词（如"花生过敏"）被误当作用户偏好写入画像
        try {
          const extractionResult = userPreferencesService.extractAndSavePreferencesFromContent(content.trim())
          if (extractionResult) {
            // P1 修复：自动提取后通知用户
            eventBus.emit('profile:auto-extracted', extractionResult)
          }
        } catch (e) {
          logger.warn('[useChatMessages] 偏好提取失败:', e)
        }

        // ── 自动触发上下文压缩检查 ──
        if (messagesRef.current.length >= 20) {
          const tokens = tokenBudgetManager.estimateHistory(messagesRef.current)
          if (tokenBudgetManager.shouldCompact(messagesRef.current, tokens)) {
            logger.info('[useChatMessages] Auto-compaction triggered:', { tokens, msgCount: messagesRef.current.length })
            try {
              const result = await contextCompactionEngine.compact(messagesRef.current)
              if (result.compressedCount > 0) {
                setMessages(result.messages)
                logger.info(`[useChatMessages] Compaction done: ${result.compressedCount} msgs → ${result.messages.length}`)
              }
            } catch (e) {
              logger.warn('[useChatMessages] Compaction failed:', e)
            }
          }
        }
      } else {
        // 双重失败：清理占位消息，标记用户消息为失败状态
        // 实时进度：生成失败（进度条变红）
        setStreamStatus('error')
        setStreamStageKey('ai.chat.progress.failed')
        removeMessage(assistantMessageId)
        clearTimeout(sendStatusTimerId)
        updateMessage(userMessage.id, { sendStatus: 'failed' })
        const friendly = toFriendlyErrorMessage(errorMessage)
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          error: friendly,
        }
        addMessage(errorMsg)
        setChatError(new Error(friendly))
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error('[useChatMessages] ❌ Send message failed:', {
        errorMessage: error.message,
        errorName: error.name,
        errorStack: error.stack?.substring(0, 500),
      })

      // 用户消息发送失败，更新状态
      clearTimeout(sendStatusTimerId)
      updateMessage(userMessage.id, { sendStatus: 'failed' })
      logger.warn('[useChatMessages] ⚠️ User message status updated to failed:', { messageId: userMessage.id })

      const friendly = toFriendlyErrorMessage(error)
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        error: friendly,
      }

      addMessage(errorMessage)
      setChatError(new Error(friendly))
      logger.error('[useChatMessages] 💥 Error state updated, UI should show error message')

      // ── Task 5: 失败消息入离线队列（网络恢复后自动补发） ──
      try {
        const isOnline = typeof navigator !== 'undefined' && navigator.onLine
        if (!isOnline || chatError) {
          offlineManager.enqueue('message', {
            id: userMessage.id,
            payload: { content: userMessage.content, history: tokenBudgetManager.selectHistory(messagesRef.current) },
            timestamp: Date.now(),
            retryCount: (userMessage.retryCount ?? 0) + 1,
          })
          logger.info('[useChatMessages] 消息已加入离线队列')
        }
      } catch { /* 静默降级 */ }
    } finally {
      // P0-2 修复：移除直接 setIsStreaming(false)，由状态机监听器统一驱动
      // chatService 在成功/失败时已 transition(Success/Error)，监听器自动设置 isStreaming=false
      // P0-1 修复：用户【主动暂停】时保留 isPaused（等待 resume/新消息取消）；
      //           自然结束/失败时清除 isPaused，避免「暂停后无法再发送」的阻断。
      if (!userPausedRef.current) {
        setIsPaused(false)
      }
      logger.debug('[useChatMessages] Streaming state reset to false (via state machine)')
      // P1 并发锁：任何退出路径（成功/失败/认证提前返回）都释放并发标记
      streamingRef.current = false
    }
  }, [addMessage, isPaused])

  const pauseStreaming = useCallback(() => {
    // 真正中止 SSE 连接（不再只改标志位），停止消耗 LLM quota 与带宽
    chatService.abortCurrentStream()
    // P1-6 修复（暂停→恢复假续传）：暂停后**保留**半成品 assistant 消息，不再静默删除。
    // 真正续传不可行（LLM 无法从半截回复 resume），旧 resumeStreaming 实为「删除已生成部分 +
    // 整段重发」却对外呈现为「恢复」，属于假续传。故移除该路径：半成品留屏供阅读，
    // 用户可用消息上的「重新生成」按钮重新生成完整回复，或直接发送新消息（sendMessage 会自动取消暂停）。
    // P0-1 修复：通过状态机过渡到 Idle（Streaming→Idle 已加入合法迁移），由监听器统一设置 isStreaming=false
    const machine = chatService.getStateMachine()
    machine.transition(ChatState.Idle)
    userPausedRef.current = true
    setIsPaused(true)
    logger.info('[useChatMessages] Streaming paused (SSE aborted, state machine → Idle); partial reply kept, regenerate via message action')
  }, [])

  // P1-13 修复：移除死代码 resumeStreaming（原「恢复」实为整段重发，且无任何 UI 消费）。
  // 暂停后的重新生成改由 messageEditing.handleRegenerateMessage 承担（见 ChatTab onRegenerate）。

  const retryLastMessage = useCallback(async () => {
    const lastUserMessage = [...messagesRef.current].reverse().find(m => m.role === 'user')

    if (!lastUserMessage) {
      logger.warn('[useChatMessages] No user message to retry')
      return
    }

    await sendMessage(lastUserMessage.content)
  }, [sendMessage])

  /** 对指定失败消息重新发送（最大重试3次） */
  const retryMessage = useCallback(async (messageId: string) => {
    const targetMsg = messagesRef.current.find(m => m.id === messageId)

    if (!targetMsg) {
      logger.warn('[useChatMessages] retryMessage: 消息未找到:', { messageId })
      return
    }

    if (targetMsg.sendStatus !== 'failed') {
      logger.warn('[useChatMessages] retryMessage: 消息状态非 failed，跳过重试:', {
        messageId,
        sendStatus: targetMsg.sendStatus,
      })
      return
    }

    // 检查重试次数是否已达上限
    const currentRetryCount = targetMsg.retryCount ?? 0
    if (currentRetryCount >= MAX_RETRY) {
      logger.warn('[useChatMessages] retryMessage: 已达最大重试次数，不再重试:', {
        messageId,
        retryCount: currentRetryCount,
        maxRetry: MAX_RETRY,
      })
      return
    }

    logger.info('[useChatMessages] 🔄 开始重试消息:', {
      messageId,
      currentRetry: currentRetryCount + 1,
      maxRetry: MAX_RETRY,
    })

    // 更新消息状态为 sending，重试次数+1
    updateMessage(messageId, {
      sendStatus: 'sending',
      retryCount: currentRetryCount + 1,
    })

    try {
      const response = await chatService.sendMessage(targetMsg.content, undefined, {
        clientSessionId: activeSessionIdRef.current || undefined,
      })
      logger.info('[useChatMessages] ✅ 重试发送成功:', { messageId, retryCount: currentRetryCount + 1 })

      updateMessage(messageId, { sendStatus: 'sent' })

      // 重试成功后添加 AI 回复
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        role: 'assistant',
        content: response.content,
        timestamp: response.timestamp || Date.now(),
        formulas: response.formulas,
      }
      addMessage(assistantMessage)
      setChatError(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error('[useChatMessages] ❌ 重试发送失败:', {
        messageId,
        errorMessage: error.message,
        retryCount: currentRetryCount + 1,
      })

      updateMessage(messageId, { sendStatus: 'failed' })
      setChatError(error)
    }
  }, [updateMessage, addMessage])

  const editMessage = useCallback((id: string, newContent: string) => {
    updateMessages(prev =>
      prev.map(msg => {
        if (msg.id !== id) return msg
        return {
          ...msg,
          content: newContent,
          isEdited: true,
          originalContent: msg.originalContent ?? msg.content,
        }
      }),
    )
  }, [updateMessages])

  const retractMessage = useCallback((id: string) => {
    updateMessages(prev =>
      prev.map(msg => {
        if (msg.id !== id) return msg
        return {
          ...msg,
          content: '消息已撤回',
          isRetracted: true,
          retractedAt: Date.now(),
        }
      }),
    )
  }, [updateMessages])

  return {
    messages,
    input,
    setInput,
    isStreaming,
    setIsStreaming,
    chatError,
    setChatError,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages,
    replaceMessages,
    sendMessage,
    retryLastMessage,
    retryMessage,
    clearError,
    isPaused,
    pauseStreaming,
    editMessage,
    retractMessage,
    /** 实时进度条状态（由 ChatProgressBar 消费） */
    streamProgress,
    streamStageKey,
    streamChars,
    streamStatus,
    streamSteps,
    setStreamProgress: applyProgress,
    /** 设置当前会话 ID（用于持久化）— P0：切换是所有路径的底层收口，切 ref 前先 abort 旧流并冲刷保存 */
    setActiveSessionId: (id: string | null) => {
      const prevId = activeSessionIdRef.current
      if (prevId === id) { activeSessionIdRef.current = id; return }
      // P0 修复：流式进行中切换会话，先真正 abort 旧 SSE 流（否则旧流继续以旧 ref 产出 chunk），
      // 再把旧会话挂起的防抖保存冲刷到旧会话 id（尾部内容归属正确会话），最后才切 ref。
      // 顺序关键：冲刷必须在切 ref 之前，否则 flush 会把旧内容 save 进新会话。
      if (streamingRef.current) {
        chatService.abortCurrentStream()
      }
      flushPendingSavesForSession(prevId)
      activeSessionIdRef.current = id
    },
    /** 检查并执行上下文压缩 */
    checkCompaction: async () => {
      const tokens = tokenBudgetManager.estimateHistory(messagesRef.current)
      if (tokenBudgetManager.shouldCompact(messagesRef.current, tokens)) {
        logger.info('[useChatMessages] Compaction triggered:', { tokens, messageCount: messagesRef.current.length })
        const result = await contextCompactionEngine.compact(messagesRef.current, (step) => {
          logger.debug('[useChatMessages] Compaction step:', step)
        })
        if (result.compressedCount > 0 && activeSessionIdRef.current) {
          await chatStorageService.saveMessages(activeSessionIdRef.current, result.messages)
          setMessages(result.messages)
          logger.info(`[useChatMessages] Compaction complete: ${result.compressedCount} messages compressed`)
        }
      }
    },
  }
}

export type { UseChatMessagesReturn }

