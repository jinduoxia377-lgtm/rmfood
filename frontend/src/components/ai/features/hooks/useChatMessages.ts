import { useState, useCallback, useRef, useEffect } from 'react'
import { chatService } from '../services/chatService'
import { storageService } from '../services/storageService'
import { eventBus } from '../services/eventBus'
import { logger } from '@/utils/safeLogger'
import { empathyEngine } from '../services/empathyEngine'
import { sentimentEngine } from '../services/sentimentEngine'
import { userProfileManager } from '../services/userProfileService'
import type { ChatMessage } from '../types'
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
  clearMessages: () => void
  /** 替换所有消息（用于会话切换恢复） */
  replaceMessages: (messages: ChatMessage[]) => void
  sendMessage: (content: string, displayContent?: string) => Promise<void>
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
}

const STORAGE_KEY = 'chat_messages'
const MAX_MESSAGES = 100
const MAX_RETRY = 3 // 最大重试次数

export function useChatMessages(): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = storageService.get<ChatMessage[]>(STORAGE_KEY)
      return stored || []
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

  const saveToStorage = useCallback((newMessages: ChatMessage[]) => {
    try {
      if (newMessages.length > MAX_MESSAGES) {
        newMessages = newMessages.slice(-MAX_MESSAGES)
      }
      storageService.set(STORAGE_KEY, newMessages)
    } catch (storageError) {
      logger.warn('[useChatMessages] Failed to save messages to storage:', storageError)
    }
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

  const clearMessages = useCallback(() => {
    setMessages([])
    messagesRef.current = []
    storageService.remove(STORAGE_KEY)
    logger.info('[useChatMessages] Messages cleared')
  }, [])

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

  const sendMessage = useCallback(async (content: string, displayContent?: string) => {
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
      const history = messagesRef.current
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .filter(m => !m.error && m.content)
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content.slice(0, 1000) }))

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

      // ── 移除指定消息的辅助函数 ──
      const removeMessage = useCallback((id: string) => {
        updateMessages(prev => prev.filter(m => m.id !== id))
      }, [updateMessages])

      // ── 尝试 1: 流式 SSE ──
      try {
        for await (const chunk of chatService.sendMessageStream(content.trim(), history)) {
          if (chunk.done) break
          fullContent += chunk.content

          // 累积配方数据（后端通过 type=formula 事件发送）
          if (chunk.formula) {
            accumulatedFormulas.push(chunk.formula)
          }

          // 转发思考步骤到 ChatSidebar（通过 eventBus）
          if (chunk.step) {
            eventBus.emit('thinking:step', chunk.step)
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
        logger.warn('[useChatMessages] Stream failed, falling back to non-streaming:', streamErrMsg)
        try {
          const response = await chatService.sendMessage(content.trim(), history)
          fullContent = response.content
          updateMessage(assistantMessageId, {
            content: response.content,
            formulas: response.formulas,
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
        // Phase 4 Step 3: 共情引擎后处理 — 在用户画像启用时对 AI 回复包裹情感适配层
        let finalContent = fullContent
        try {
          const domainPrefs = userProfileManager.getDomain()
          if (domainPrefs.empathyEnabled && fullContent.length > 20) {
            const sentimentResult = sentimentEngine.analyze(userMessage.content)
            const empathyConfig = empathyEngine.generateResponse(sentimentResult, {
              turnCount: messagesRef.current.filter(m => m.role === 'user').length,
              hasErrorOccurred: false,
            })
            if (empathyConfig.strategy !== 'none' && empathyConfig.strategy !== 'neutral') {
              finalContent = empathyEngine.applyEmpathy(fullContent, empathyConfig)
              logger.info('[useChatMessages] 🎭 Empathy applied:', {
                strategy: empathyConfig.strategy,
                emotion: sentimentResult.primary,
                intensity: sentimentResult.intensity,
                originalLength: fullContent.length,
                wrappedLength: finalContent.length,
              })
            }
          }
        } catch (empathyError) {
          // 共情处理失败不阻断主流程，静默降级为原始内容
          logger.warn('[useChatMessages] Empathy processing failed, using original content:', empathyError)
        }

        updateMessage(assistantMessageId, {
          content: finalContent,
          isLoading: false,
          formulas: accumulatedFormulas.length > 0 ? accumulatedFormulas : undefined,
        })
        updateMessage(userMessage.id, { sendStatus: 'sent' })
      } else {
        // 双重失败：清理占位消息，标记用户消息为失败状态
        updateMessage(userMessage.id, { sendStatus: 'failed' })
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          error: errorMessage,
        }
        addMessage(errorMsg)
        setChatError(new Error(errorMessage))
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

      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        error: error.message,
      }

      addMessage(errorMessage)
      setChatError(error)
      logger.error('[useChatMessages] 💥 Error state updated, UI should show error message')
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
  }
}

export type { UseChatMessagesReturn }
