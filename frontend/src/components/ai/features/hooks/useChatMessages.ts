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
import { chatEventLog } from '../capabilities/storage/ChatEventLog'
import { chatStorageService } from '../capabilities/storage/ChatStorageService'
import { offlineManager } from '../utils/offlineManager'
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
  sendMessage: (content: string, displayContent?: string, scenarioMode?: string) => Promise<void>
  retryLastMessage: () => Promise<void>
  /** 对指定失败消息重新发送（最大重试3次） */
  retryMessage: (messageId: string) => Promise<void>
  clearError: () => void
  /** 暂停流式输出 */
  isPaused: boolean
  pauseStreaming: () => void
  resumeStreaming: () => void
  editMessage: (id: string, newContent: string) => void
  retractMessage: (id: string) => void
  /** 设置当前会话 ID（用于持久化到 IndexedDB） */
  setActiveSessionId: (id: string | null) => void
  /** 检查并执行上下文压缩（当 token 超限时自动触发） */
  checkCompaction: () => Promise<void>
}

const STORAGE_KEY = 'chat_messages'
const MAX_MESSAGES = 100
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
      return cleaned
    } catch (error) {
      logger.warn('[useChatMessages] Failed to load messages from storage:', error)
      return []
    }
  })

  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [chatError, setChatError] = useState<Error | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const messagesRef = useRef(messages)
  const lastQuestionRef = useRef<string>('')
  const activeSessionIdRef = useRef<string | null>(null)

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

  // ADR-029 P1-3: 统一存储策略 - IndexedDB 作为主存储，localStorage 仅作降级兜底
  const saveToStorage = useCallback((newMessages: ChatMessage[]) => {
    try {
      if (newMessages.length > MAX_MESSAGES) {
        newMessages = newMessages.slice(-MAX_MESSAGES)
      }

      // 优先写入 IndexedDB（支持大容量会话）
      if (activeSessionIdRef.current && newMessages.length > 0) {
        chatStorageService.saveMessages(activeSessionIdRef.current, newMessages)
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
  useEffect(() => {
    return chatEventLog.onChange(() => {
      // EventLog 变更时同步到 IndexedDB
      const currentMessages = chatEventLog.deriveMessages()
      if (currentMessages.length > 0 && activeSessionIdRef.current) {
        chatStorageService.saveMessages(activeSessionIdRef.current, currentMessages).catch(e =>
          logger.warn('[useChatMessages] EventLog sync failed:', e)
        )
      }
    })
  }, [])

  const updateMessages = useCallback((updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages(prev => {
      const newMessages = updater(prev)
      messagesRef.current = newMessages
      saveToStorage(newMessages)
      return newMessages
    })
  }, [saveToStorage])

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

  const sendMessage = useCallback(async (content: string, displayContent?: string, scenarioMode?: string) => {
    if (!content?.trim()) {
      logger.warn('[useChatMessages] ⚠️ Empty message content, ignoring send request')
      return
    }

    if (isPaused) {
      logger.warn('[useChatMessages] ⚠️ Streaming is paused, ignoring send request')
      return
    }

    lastQuestionRef.current = content.trim()
    const userDisplayContent = (displayContent || content).trim()

    logger.info('[useChatMessages] 🚀 Starting message send:', {
      contentLength: content.trim().length,
      contentPreview: content.trim().substring(0, 50) + (content.trim().length > 50 ? '...' : ''),
      timestamp: Date.now(),
    })

    setChatError(null)
    setIsStreaming(true)

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
      let accumulatedFormulas: any[] = []
      let hasError = false
      let errorMessage = ''

      // ── 尝试 1: 流式 SSE ──
      try {
        for await (const chunk of chatService.sendMessageStream(content.trim(), history, scenarioMode)) {
          if (chunk.done) break
          // 思考步骤事件不追加到对话内容（仅转发到侧栏）
          if (!chunk.step) {
            fullContent += chunk.content
          }

          // 累积配方数据（后端通过 type=formula 事件发送）
          if (chunk.formula) {
            accumulatedFormulas.push(chunk.formula)
          }

          // 转发思考步骤到 ChatSidebar（通过 eventBus）
          if (chunk.step) {
            eventBus.emit('thinking:step', { step: chunk.step.step, content: chunk.step.content, status: chunk.step.status, timestamp: Date.now() })
          }

          updateMessage(assistantMessageId, {
            content: fullContent,
            formulas: accumulatedFormulas.length > 0 ? [...accumulatedFormulas] : undefined,
          })
        }
      } catch (streamError) {
        const streamErrMsg = streamError instanceof Error ? streamError.message : String(streamError)

        // ── 如果是认证错误，跳过降级（非流式也会遇到同样的认证问题）──
        const isStreamAuthError = streamErrMsg.includes('401') || streamErrMsg.includes('认证') || streamErrMsg.includes('Token') || streamErrMsg.includes('未授权')
        if (isStreamAuthError) {
          logger.warn('[useChatMessages] Stream failed with auth error, skipping fallback (would also fail)')
          updateMessage(userMessage.id, { sendStatus: 'failed' })
          removeMessage(assistantMessageId)
          return // auth:required 事件已在 ChatService 中触发
        }

        // ── 尝试 2: 非流式降级（非认证类错误才降级）──
        // 保留流式已收到的内容，追加而非替换
        logger.warn('[useChatMessages] Stream failed, falling back to non-streaming:', streamErrMsg)
        try {
          const response = await chatService.sendMessage(content.trim(), history)
          // 追加到已收到的流式内容后面
          fullContent = fullContent + (fullContent ? '\n\n' : '') + response.content
          updateMessage(assistantMessageId, {
            content: fullContent,
            formulas: response.formulas || accumulatedFormulas.length > 0 ? [...accumulatedFormulas] : undefined,
            isLoading: false,
          })
        } catch (fallbackError) {
          // 流式和非流式均失败
          const errMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          logger.error('[useChatMessages] Both streaming and fallback failed:', errMsg)

          // 认证错误不显示气泡（auth:required 事件已在 ChatService 中触发重新登录）
          const isAuthError = errMsg.includes('401') || errMsg.includes('认证') || errMsg.includes('Token') || errMsg.includes('未授权')
          if (!isAuthError) {
            hasError = true
            errorMessage = errMsg
          } else {
            // 认证失败：清理占位消息，标记用户消息为失败，但不设 chatError（避免显示多余错误提示）
            updateMessage(userMessage.id, { sendStatus: 'failed' })
            removeMessage(assistantMessageId)
            return // 由 auth:required 事件处理重新登录
          }
        }
      }

      // 统一处理结果
      if (!hasError) {
        updateMessage(assistantMessageId, {
          isLoading: false,
          formulas: accumulatedFormulas.length > 0 ? accumulatedFormulas : undefined,
        })
        updateMessage(userMessage.id, { sendStatus: 'sent' })

        // ── 写入 EventLog（append-only） ──
        chatEventLog.append('user/message', userMessage)
        chatEventLog.append('assistant/message', { ...assistantMessage, id: assistantMessageId, content: fullContent, formulas: accumulatedFormulas.length > 0 ? accumulatedFormulas : undefined })

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
      setIsStreaming(false)
      logger.debug('[useChatMessages] 🔄 Streaming state reset to false')
    }
  }, [addMessage, isPaused])

  const pauseStreaming = useCallback(() => {
    setIsPaused(true)
    setIsStreaming(false)
    logger.info('[useChatMessages] ⏸️ Streaming paused')
  }, [])

  const resumeStreaming = useCallback(() => {
    if (!isPaused) return
    setIsPaused(false)
    const lastQuestion = lastQuestionRef.current
    if (lastQuestion) {
      logger.info('[useChatMessages] ▶️ Resuming streaming with last question:', { lastQuestionPreview: lastQuestion.substring(0, 50) })
      sendMessage(lastQuestion)
    } else {
      logger.warn('[useChatMessages] ⚠️ No last question to resume')
    }
  }, [isPaused, sendMessage])

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
      const response = await chatService.sendMessage(targetMsg.content)
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
    resumeStreaming,
    editMessage,
    retractMessage,
    /** 设置当前会话 ID（用于持久化） */
    setActiveSessionId: (id: string | null) => { activeSessionIdRef.current = id },
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
