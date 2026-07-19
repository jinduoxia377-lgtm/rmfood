/**
 * AIGenerator - AI智能提示词/配方生成器
 *
 * 提供基于自然语言描述的智能生成功能：
 * - 支持流式输出（打字机效果）
 * - 多参数控制（创造性、长度、语气）
 * - 实时预览和编辑
 * - 历史记录管理
 *
 * @version 2.0.0
 * @lastUpdated 2026-05-20
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Sparkles,
  Send,
  RotateCcw,
  Copy,
  Check,
  Loader2,
  History,
  Settings,
  ChevronDown,
  ChevronUp,
  Trash2,
  Download,
  RefreshCw,
} from 'lucide-react'
import { Button, Textarea, Badge, Card } from '@/components/ui'
import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

interface GenerationParams {
  creativity: number
  length: 'short' | 'medium' | 'detail'
  tone: 'professional' | 'friendly' | 'creative' | 'formal'
}

interface AIGenerateResult {
  task_id: string
  status: 'completed' | 'failed' | 'generating'
  result: string
  tokens_used: number
  estimated_time: number
  quality_score?: number
}

interface GenerationHistoryItem {
  id: string
  description: string
  result: string
  timestamp: number
  params: GenerationParams
}

// ===== 默认配置 =====

const DEFAULT_PARAMS: GenerationParams = {
  creativity: 0.7,
  length: 'medium',
  tone: 'professional',
}

const TONE_OPTIONS = [
  { value: 'professional', label: '专业严谨' },
  { value: 'friendly', label: '亲切友好' },
  { value: 'creative', label: '创意活泼' },
  { value: 'formal', label: '正式官方' },
] as const

const LENGTH_OPTIONS = [
  { value: 'short', label: '简洁 (≤200字)' },
  { value: 'medium', label: '适中 (200-800字)' },
  { value: 'detail', label: '详细 (≥800字)' },
] as const

// ===== 主组件 =====

interface AIGeneratorProps {
  onGenerateComplete?: (result: AIGenerateResult) => void
  onStreamChunk?: (chunk: string) => void
  className?: string
  placeholder?: string
  maxHistoryItems?: number
}

export function AIGenerator({
  onGenerateComplete,
  onStreamChunk,
  className = '',
  placeholder = '描述您需要的提示词或配方需求，例如："帮我写一个针对中老年人群的免疫增强配方的产品描述模板"',
  maxHistoryItems = 20,
}: AIGeneratorProps) {
  const [description, setDescription] = useState('')
  const [params, setParams] = useState<GenerationParams>(DEFAULT_PARAMS)
  const [result, setResult] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<GenerationHistoryItem[]>([])
  const [copied, setCopied] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('ai_generation_history')
    if (saved) {
      try {
        setHistory(JSON.parse(saved))
      } catch (e) {
        logger.error('Failed to parse generation history', e)
      }
    }
  }, [])

  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem(
        'ai_generation_history',
        JSON.stringify(history.slice(0, maxHistoryItems)),
      )
    }
  }, [history, maxHistoryItems])

  const handleGenerate = useCallback(async (useStream = true) => {
    if (!description.trim() || isGenerating) return

    setIsGenerating(true)
    setIsStreaming(useStream)
    setError('')
    setResult('')
    setCurrentTaskId('')

    if (useStream) {
      await handleStreamGenerate()
    } else {
      await handleNonStreamGenerate()
    }
  }, [description, params, isGenerating])

  const handleStreamGenerate = useCallback(async () => {
    try {
      abortControllerRef.current = new AbortController()

      const response = await fetch('/api/v1/ai/generate/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          parameters: {
            creativity: params.creativity,
            length: params.length,
            tone: params.tone,
          },
          context: {},
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6).trim()

          if (data === '[DONE]') {
            setIsGenerating(false)
            setIsStreaming(false)

            const historyItem: GenerationHistoryItem = {
              id: Date.now().toString(),
              description: description.trim(),
              result: fullContent,
              timestamp: Date.now(),
              params: { ...params },
            }
            setHistory(prev => [historyItem, ...prev].slice(0, maxHistoryItems))

            onGenerateComplete?.({
              task_id: currentTaskId || 'stream_' + Date.now(),
              status: 'completed',
              result: fullContent,
              tokens_used: Math.floor(fullContent.length / 4),
              estimated_time: 0,
            })
            return
          }

          try {
            const parsed = JSON.parse(data)

            if (parsed.type === 'start') {
              setCurrentTaskId(parsed.task_id)
            } else if (parsed.type === 'token') {
              fullContent += parsed.content
              setResult(fullContent)
              onStreamChunk?.(parsed.content)
            } else if (parsed.type === 'error') {
              throw new Error(parsed.content)
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              continue
            }
            throw e
          }
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (errorMessage !== 'The user aborted a request.') {
        setError(errorMessage)
        logger.error('Stream generation failed:', err)
      }
      setIsGenerating(false)
      setIsStreaming(false)
    }
  }, [description, params, currentTaskId, maxHistoryItems, onGenerateComplete, onStreamChunk])

  const handleNonStreamGenerate = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          parameters: {
            creativity: params.creativity,
            length: params.length,
            tone: params.tone,
          },
          context: {},
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data: AIGenerateResult = await response.json()

      setResult(data.result)
      setCurrentTaskId(data.task_id)

      const historyItem: GenerationHistoryItem = {
        id: data.task_id,
        description: description.trim(),
        result: data.result,
        timestamp: Date.now(),
        params: { ...params },
      }
      setHistory(prev => [historyItem, ...prev].slice(0, maxHistoryItems))

      onGenerateComplete?.(data)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      logger.error('Non-stream generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }, [description, params, maxHistoryItems, onGenerateComplete])

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsGenerating(false)
    setIsStreaming(false)
  }, [])

  const handleCopy = useCallback(async () => {
    if (!result) return

    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      logger.error('Copy failed:', err)
    }
  }, [result])

  const handleClear = useCallback(() => {
    setDescription('')
    setResult('')
    setError('')
  }, [])

  const handleLoadFromHistory = useCallback((item: GenerationHistoryItem) => {
    setDescription(item.description)
    setResult(item.result)
    setParams(item.params)
    setShowHistory(false)
  }, [])

  const handleDeleteHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id))
  }, [])

  const handleClearHistory = useCallback(() => {
    setHistory([])
    localStorage.removeItem('ai_generation_history')
  }, [])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 输入区域 */}
      <Card className="p-4">
        <div className="space-y-3">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="resize-none"
            disabled={isGenerating}
          />

          {/* 参数设置面板 */}
          <div className="border-t pt-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              <Settings size={16} />
              <span>生成参数</span>
              {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showSettings && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg">
                {/* 创造性滑块 */}
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    创造性系数: {params.creativity.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={params.creativity}
                    onChange={(e) =>
                      setParams((p) => ({ ...p, creativity: parseFloat(e.target.value) }))
                    }
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
                    <span>保守</span>
                    <span>创新</span>
                  </div>
                </div>

                {/* 长度选择 */}
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    输出长度
                  </label>
                  <select
                    value={params.length}
                    onChange={(e) =>
                      setParams((p) => ({
                        ...p,
                        length: e.target.value as GenerationParams['length'],
                      }))
                    }
                    className="w-full px-2 py-1.5 text-sm border rounded-md bg-white dark:bg-neutral-700 dark:border-neutral-600"
                  >
                    {LENGTH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 语气选择 */}
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    语气风格
                  </label>
                  <select
                    value={params.tone}
                    onChange={(e) =>
                      setParams((p) => ({
                        ...p,
                        tone: e.target.value as GenerationParams['tone'],
                      }))
                    }
                    className="w-full px-2 py-1.5 text-sm border rounded-md bg-white dark:bg-neutral-700 dark:border-neutral-600"
                  >
                    {TONE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => handleGenerate(true)}
                disabled={!description.trim() || isGenerating}
                variant="primary"
                size="sm"
              >
                {isStreaming ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    智能生成
                  </>
                )}
              </Button>

              {isGenerating && (
                <Button onClick={handleStop} variant="secondary" size="sm">
                  停止
                </Button>
              )}

              <Button
                onClick={() => handleGenerate(false)}
                disabled={!description.trim() || isGenerating}
                variant="outline"
                size="sm"
              >
                非流式模式
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-400"
              >
                <History size={14} />
                历史 ({history.length})
              </button>

              <Button onClick={handleClear} variant="ghost" size="sm">
                清空
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* 错误提示 */}
      {error && (
        <div className="p-3 bg-error-50 border border-red-200 rounded-lg text-error-700 text-sm">
          ⚠️ 生成失败: {error}
        </div>
      )}

      {/* 结果展示区域 */}
      {(result || isGenerating) && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <Sparkles size={16} className="text-secondary-600" />
              生成结果
              {currentTaskId && (
                <Badge variant="info" size="sm">
                  ID: {currentTaskId.slice(0, 8)}...
                </Badge>
              )}
            </h3>

            <div className="flex items-center gap-2">
              {result && (
                <>
                  <Button onClick={handleCopy} variant="ghost" size="sm">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? '已复制' : '复制'}
                  </Button>

                  <Button
                    onClick={() => {
                      const blob = new Blob([result], { type: 'text/plain' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `ai_generated_${Date.now()}.txt`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    variant="ghost"
                    size="sm"
                  >
                    <Download size={14} />
                    导出
                  </Button>
                </>
              )}
            </div>
          </div>

          <div
            ref={resultRef}
            className="min-h-[120px] max-h-[500px] overflow-y-auto p-3 bg-slate-50 dark:bg-neutral-900 rounded-lg text-sm leading-relaxed whitespace-pre-wrap font-mono"
          >
            {result || (isGenerating ? '正在生成...' : '')}
            {isStreaming && !result && (
              <span className="inline-block w-2 h-4 bg-secondary-600 animate-pulse ml-1" />
            )}
          </div>
        </Card>
      )}

      {/* 历史记录面板 */}
      {showHistory && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <History size={16} />
              生成历史
            </h3>

            {history.length > 0 && (
              <Button onClick={handleClearHistory} variant="danger" size="sm">
                <Trash2 size={14} />
                清空历史
              </Button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-8">暂无历史记录</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => handleLoadFromHistory(item)}
                      className="flex-1 text-left"
                    >
                      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 line-clamp-2">
                        {item.description.slice(0, 80)}...
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {new Date(item.timestamp).toLocaleString('zh-CN')} ·{' '}
                        {item.params.tone} · {item.params.length}
                      </p>
                    </button>

                    <button
                      onClick={() => handleDeleteHistory(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-error-600 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

export default AIGenerator
