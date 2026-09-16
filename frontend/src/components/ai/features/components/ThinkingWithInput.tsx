/**
 * ThinkingWithInput - AI思考过程与输入复合组件
 *
 * 功能特性：
 * - 集成AI思考过程展示与文本输入
 * - 支持打字机效果展示思考内容
 * - 代码块语法高亮与复制功能
 * - 完整的输入验证与提交逻辑
 * - 响应式设计与深色/浅色模式
 * - 平滑的动画过渡效果
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-23
 * @author RMFOOD Team
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Copy, Check, Clock, Loader2, XCircle, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui'
import { ChatInputArea } from './ChatInputArea'
import { logger } from '@/utils/safeLogger'

// =============== 类型定义 ===============

export interface ThinkingStep {
  id: string
  title: string
  content: string
  timestamp: number
  confidence: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  code?: string
  language?: string
}

export interface ThinkingWithInputProps {
  // 思考过程相关
  thinkingSteps: ThinkingStep[]
  isThinking: boolean
  currentStepIndex: number
  isThinkingVisible: boolean
  onToggleThinking: () => void

  // 输入相关
  inputValue: string
  onInputChange: (value: string) => void
  onSend: () => void
  isStreaming: boolean
  disabled?: boolean
  placeholder?: string
  maxLength?: number

  // 可选配置
  showTypewriter?: boolean
  showTimestamps?: boolean
  deepThinking?: boolean
  smartSearch?: boolean
  onDeepThinkingChange?: (enabled: boolean) => void
  onSmartSearchChange?: (enabled: boolean) => void
  messageCount?: number

  // 错误与加载
  error?: string
  onClearError?: () => void
}

// =============== 辅助Hook：打字机效果 ===============

function useTypewriter(text: string, enabled = true, speed = 30): string {
  const [displayText, setDisplayText] = useState('')
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setDisplayText(text)
      return
    }

    if (index < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(text.substring(0, index + 1))
        setIndex(index + 1)
      }, speed + Math.random() * 20)
      return () => clearTimeout(timer)
    } else {
      setDisplayText(text)
    }
    return undefined
  }, [text, index, enabled, speed])

  useEffect(() => {
    setIndex(0)
    setDisplayText('')
  }, [text])

  return enabled ? displayText : text
}

// =============== 辅助Hook：复制到剪贴板 ===============

function useCopyToClipboard(): { copied: boolean; copy: (text: string) => Promise<void> } {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      logger.error('ThinkingWithInput: Failed to copy text', err)
    }
  }, [])

  return { copied, copy }
}

// =============== 子组件：思考步骤项 ===============

const ThinkingStepItem: React.FC<{
  step: ThinkingStep
  isActive: boolean
  typewriterEnabled: boolean
  showTimestamp: boolean
}> = ({ step, isActive, typewriterEnabled, showTimestamp }) => {
  const { copied, copy } = useCopyToClipboard()
  const displayContent = useTypewriter(step.content, typewriterEnabled && step.status === 'processing')

  const getStatusColor = (status: ThinkingStep['status']) => {
    switch (status) {
      case 'pending': return 'text-neutral-400 border-neutral-200 dark:text-neutral-500 dark:border-neutral-700'
      case 'processing': return 'text-secondary-500 border-blue-300 dark:text-secondary-400 dark:border-blue-600'
      case 'completed': return 'text-success-500 border-green-300 dark:text-success-400 dark:border-green-600'
      case 'error': return 'text-error-500 border-red-300 dark:text-error-400 dark:border-red-600'
      default: return 'text-neutral-500 border-neutral-300'
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className={`
      p-4 rounded-xl border transition-all duration-300
      ${isActive ? 'bg-secondary-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 shadow-sm scale-[1.01]' : 'bg-white dark:bg-neutral-900 border-neutral-100 dark:border-neutral-800'}
      ${step.status === 'error' ? 'bg-error-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : ''}
    `}>
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center border-2
            ${getStatusColor(step.status)}
            ${step.status === 'processing' ? 'animate-pulse' : ''}
          `}>
            {step.status === 'pending' && <div className="w-2 h-2 rounded-full bg-current" />}
            {step.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin" />}
            {step.status === 'completed' && <Check className="w-4 h-4" />}
            {step.status === 'error' && <XCircle className="w-4 h-4" />}
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900 dark:text-white">
              {step.title}
            </h4>
            <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
              {showTimestamp && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(step.timestamp)}
                </span>
              )}
              <span className="text-xs">
                置信度: {Math.round(step.confidence * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* 复制按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          onClick={() => copy(step.content)}
        >
          {copied ? <Check className="w-4 h-4 text-success-500" /> : <Copy className="w-4 h-4" />}
        </Button>
      </div>

      {/* 内容区域 */}
      <div className="ml-11">
        <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">
          {displayContent}
        </p>

        {/* 代码块（如果有） */}
        {step.code && (
          <div className="mt-3 relative">
            <div className="flex items-center justify-between bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 rounded-t-lg border border-b-0 border-neutral-200 dark:border-neutral-700">
              <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
                {step.language || 'code'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => copy(step.code!)}
              >
                {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                复制
              </Button>
            </div>
            <pre className="bg-neutral-900 text-neutral-100 p-4 rounded-b-lg text-sm font-mono overflow-x-auto border border-neutral-700">
              <code>{step.code}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

// =============== 主组件：ThinkingWithInput ===============

export const ThinkingWithInput: React.FC<ThinkingWithInputProps> = ({
  thinkingSteps,
  isThinking,
  currentStepIndex,
  isThinkingVisible,
  onToggleThinking,
  inputValue,
  onInputChange,
  onSend,
  isStreaming,
  disabled = false,
  placeholder = '请输入您的问题...',
  maxLength = 2000,
  showTypewriter = true,
  showTimestamps = true,
  deepThinking,
  smartSearch,
  onDeepThinkingChange,
  onSmartSearchChange,
  messageCount,
  error,
  onClearError,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  // 自动滚动到最新思考步骤
  useEffect(() => {
    if (scrollRef.current && thinkingSteps.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thinkingSteps.length, currentStepIndex])

  // 本地状态：字数统计
  const charCount = inputValue.length
  const isOverLimit = maxLength && charCount > maxLength

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      {/* ========== AI思考过程展示区 ========== */}
      {isThinkingVisible && (
        <div className="border-b border-neutral-200 dark:border-neutral-800 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
          {/* 标题栏 */}
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors"
             role="button" tabIndex={0} onClick={onToggleThinking}
          >
            <div className="flex items-center gap-2">
              <div className={`
                w-2 h-2 rounded-full
                ${isThinking ? 'bg-secondary-500 animate-pulse' : 'bg-neutral-400'}
              `} />
              <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">
                {isThinking ? 'AI正在思考...' : 'AI思考过程'}
              </h3>
              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                ({thinkingSteps.length} 个步骤)
              </span>
            </div>
          </div>

          {/* 可滚动内容区 */}
          <div
            ref={scrollRef}
            className="max-h-64 overflow-y-auto px-4 pb-4 space-y-3"
          >
            {thinkingSteps.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
                <p>发送消息后，AI的思考过程将在这里显示</p>
              </div>
            ) : (
              thinkingSteps.map((step, index) => (
                <ThinkingStepItem
                  key={step.id}
                  step={step}
                  isActive={index === currentStepIndex}
                  typewriterEnabled={showTypewriter}
                  showTimestamp={showTimestamps}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ========== 错误提示区 ========== */}
      {error && (
        <div className="px-4 py-3 bg-error-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-error-800 dark:text-error-200">{error}</p>
            </div>
            {onClearError && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-error-500 hover:bg-error-100 dark:hover:bg-error-900/50"
                onClick={onClearError}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ========== 输入区 ========== */}
      <div className="flex-1 flex flex-col">
        {/* 复用现有的ChatInputArea组件 */}
        <ChatInputArea
          value={inputValue}
          onChange={onInputChange}
          onSend={onSend}
          isStreaming={isStreaming}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          deepThinking={deepThinking}
          smartSearch={smartSearch}
          onDeepThinkingChange={onDeepThinkingChange}
          onSmartSearchChange={onSmartSearchChange}
          messageCount={messageCount}
        />
      </div>

      {/* ========== 底部状态条（可选，可增强版本） ========== */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-4">
            <span>字数: {charCount}/{maxLength}</span>
            {isOverLimit && (
              <span className="text-error-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                超出字数限制
              </span>
            )}
          </div>
          <div className="text-neutral-400">
            按 Enter 发送，Shift+Enter 换行
          </div>
        </div>
      </div>
    </div>
  )
}

// 默认导出
export default ThinkingWithInput
