import React, { memo, useState, useCallback, useMemo } from 'react'

import { logger } from '@/utils/safeLogger';
import {
  Brain,
  X,
  Loader2,
  Zap,
  Copy,
  Download,
  History,
  Check,
  AlertCircle,
} from 'lucide-react'
import type {
  DeepThinkingPanelProps,
  DeepThinkingAnalysis,
  AnalysisHistoryItem,
} from './DeepThinkingPanel.types'
import {
  INTENT_LABELS,
  SENTIMENT_LABELS,
  INTENT_COLORS,
} from './DeepThinkingPanel.types'

const MAX_HISTORY_ITEMS = 5

const KeywordTag: React.FC<{ keyword: string; index: number }> = memo(({ keyword, index }) => {
  const colors = [
    'bg-secondary-100 text-secondary-700 dark:bg-secondary-900/30 dark:text-secondary-300',
    'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
    'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-300',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  ]

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all hover:scale-105 ${colors[index % colors.length]}`}
    >
      {keyword}
    </span>
  )
})

KeywordTag.displayName = 'KeywordTag'

const IntentBadge: React.FC<{ intent: string }> = memo(({ intent }) => {
  const intentType = intent as keyof typeof INTENT_LABELS
  const label = INTENT_LABELS[intentType] || '未知'
  const colorConfig = INTENT_COLORS[intentType] || INTENT_COLORS.general

  return (
    <div className={`text-center p-2.5 ${colorConfig.bgColor} rounded-lg`}>
      <div className={`text-xs ${colorConfig.color} mb-1 font-medium`}>意图</div>
      <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{label}</div>
    </div>
  )
})

IntentBadge.displayName = 'IntentBadge'

const SentimentIndicator: React.FC<{ sentiment: 'positive' | 'negative' | 'neutral' }> = memo(({ sentiment }) => {
  const config = SENTIMENT_LABELS[sentiment]

  const getProgressWidth = () => {
    switch (sentiment) {
      case 'positive': return '85%'
      case 'negative': return '75%'
      case 'neutral': return '50%'
      default: return '50%'
    }
  }

  return (
    <div className={`${config.bgColor} rounded-lg p-2.5`}>
      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5 font-medium">情感</div>
      <div className={`text-sm font-semibold mb-2 ${config.color}`}>{config.label}</div>
      <div className="w-full bg-neutral-200 dark:bg-neutral-600 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${
            sentiment === 'positive' ? 'bg-success-500' :
            sentiment === 'negative' ? 'bg-error-500' : 'bg-neutral-400'
          }`}
          style={{ width: getProgressWidth() }}
        />
      </div>
    </div>
  )
})

SentimentIndicator.displayName = 'SentimentIndicator'

const ComplexityGauge: React.FC<{ complexity: number }> = memo(({ complexity }) => {
  const percentage = Math.round(complexity * 100)
  const radius = 24
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (complexity * circumference)

  const getColor = () => {
    if (percentage <= 33) return { stroke: 'var(--color-primary-400)', text: 'text-success-500', bg: 'bg-success-50 dark:bg-success-900/20' }
    if (percentage <= 66) return { stroke: '#D97706', text: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' }
    return { stroke: '#FF3B30', text: 'text-error-500', bg: 'bg-error-50 dark:bg-error-900/20' }
  }

  const colors = getColor()

  return (
    <div className={`${colors.bg} rounded-lg p-2.5`}>
      <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-1.5 font-medium">复杂度</div>
      <div className="flex items-center justify-center">
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 56 56">
            <circle
              cx="28"
              cy="28"
              r={radius}
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              className="text-neutral-200 dark:text-neutral-600"
            />
            <circle
              cx="28"
              cy="28"
              r={radius}
              stroke={colors.stroke}
              strokeWidth="4"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <div className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${colors.text}`}>
            {percentage}%
          </div>
        </div>
      </div>
    </div>
  )
})

ComplexityGauge.displayName = 'ComplexityGauge'

const SuggestedQuestionCard: React.FC<{
  question: string
  onApply: (question: string) => void
  index: number
}> = memo(({ question, onApply, index }) => (
  <button
    onClick={() => onApply(question)}
    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 rounded-lg transition-all duration-200 group border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
  >
    <Zap className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 group-hover:scale-110 transition-transform" />
    <span className="flex-1 text-left truncate group-hover:text-secondary-600 dark:group-hover:text-secondary-400 transition-colors">
      {question}
    </span>
    <span className="text-[10px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity">
      点击应用
    </span>
  </button>
))

SuggestedQuestionCard.displayName = 'SuggestedQuestionCard'

const ShimmerSkeleton: React.FC = memo(() => (
  <div className="space-y-4 animate-pulse">
    <div>
      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-16 mb-2"></div>
      <div className="flex gap-1.5">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-7 w-16 bg-neutral-200 dark:bg-neutral-700 rounded-full"></div>
        ))}
      </div>
    </div>
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-20 bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
      ))}
    </div>
    <div>
      <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-20 mb-2"></div>
      <div className="space-y-1.5">
        {[1, 2].map(i => (
          <div key={i} className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded-lg"></div>
        ))}
      </div>
    </div>
  </div>
))

ShimmerSkeleton.displayName = 'ShimmerSkeleton'

const DeepThinkingPanel: React.FC<DeepThinkingPanelProps> = ({
  analysis,
  isVisible,
  isAnalyzing,
  onApplyQuestion,
  onClose,
}) => {
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [copied, setCopied] = useState(false)

  const addToHistory = useCallback((analysisData: DeepThinkingAnalysis) => {
    const newItem: AnalysisHistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      analysis: analysisData,
    }

    setHistory(prev => [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS))
  }, [])

  React.useEffect(() => {
    if (analysis && !isAnalyzing) {
      addToHistory(analysis)
    }
  }, [analysis, isAnalyzing, addToHistory])

  const handleCopyToClipboard = useCallback(async () => {
    if (!analysis) return

    try {
      const text = `深度分析结果\n${'='.repeat(40)}\n\n关键词: ${analysis.keywords.join(', ')}\n意图: ${INTENT_LABELS[analysis.intent as keyof typeof INTENT_LABELS] || analysis.intent}\n情感: ${SENTIMENT_LABELS[analysis.sentiment].label}\n复杂度: ${Math.round(analysis.complexity * 100)}%\n\n推荐问题:\n${analysis.suggestedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`

      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      logger.error('复制失败:', err)
    }
  }, [analysis])

  const handleExportJSON = useCallback(() => {
    if (!analysis) return

    const exportData = {
      exportedAt: new Date().toISOString(),
      analysis,
      metadata: {
        version: '1.0.0',
        generator: 'DeepThinkingPanel',
      },
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `deep-thinking-analysis-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [analysis])

  const formatTimestamp = useCallback((timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`
    return date.toLocaleDateString('zh-CN')
  }, [])

  if (!isVisible) return null

  return (
    <div
      id="deep-thinking-panel"
      className="absolute bottom-full left-4 right-4 sm:left-6 sm:right-6 lg:left-8 lg:right-8 mb-2 bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-200/80 dark:border-neutral-700/80 overflow-hidden z-50 animate-in slide-in-from-bottom-2 fade-in duration-200 max-h-96"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-700 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">深度分析</span>
          {isAnalyzing && (
            <div className="flex items-center gap-1.5 text-xs text-secondary-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>正在分析...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {analysis && !isAnalyzing && (
            <>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-all hover:scale-110"
                title="分析历史"
                aria-label="查看分析历史"
              >
                <History className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-secondary-500" />
              </button>
              <button
                onClick={handleCopyToClipboard}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-all hover:scale-110"
                title="复制分析结果"
                aria-label="复制到剪贴板"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-success-500" />
                ) : (
                  <Copy className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-secondary-500" />
                )}
              </button>
              <button
                onClick={handleExportJSON}
                className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-all hover:scale-110"
                title="导出JSON报告"
                aria-label="导出分析报告"
              >
                <Download className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-secondary-500" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-error-50 dark:hover:bg-error-900/20 rounded-lg transition-all hover:scale-110 ml-1"
            aria-label="关闭深度分析"
          >
            <X className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-error-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
        {isAnalyzing || !analysis ? (
          <ShimmerSkeleton />
        ) : showHistory && history.length > 0 ? (
          /* History View */
          <div className="space-y-2">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              分析历史（最近{MAX_HISTORY_ITEMS}次）
            </div>
            {history.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 dark:bg-neutral-700/30 rounded-lg border border-neutral-200 dark:border-neutral-600 hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer"
                 role="button" tabIndex={0} onClick={() => onApplyQuestion(item.analysis.suggestedQuestions[0] || '')}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{formatTimestamp(item.timestamp)}</span>
                  <span className={`text-xs font-medium ${
                    SENTIMENT_LABELS[item.analysis.sentiment].color
                  }`}>
                    {SENTIMENT_LABELS[item.analysis.sentiment].label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.analysis.keywords.slice(0, 3).map((kw, i) => (
                    <span key={i} className="text-[11px] bg-white dark:bg-neutral-600 px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-300">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Main Analysis View */
          <>
            {/* Keywords Section */}
            <div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2.5 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                提取关键词
              </div>
              <div className="flex flex-wrap gap-1.5">
                {analysis.keywords.map((keyword, i) => (
                  <KeywordTag key={i} keyword={keyword} index={i} />
                ))}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3">
              <IntentBadge intent={analysis.intent} />
              <SentimentIndicator sentiment={analysis.sentiment} />
              <ComplexityGauge complexity={analysis.complexity} />
            </div>

            {/* Suggested Questions */}
            {analysis.suggestedQuestions.length > 0 && (
              <div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-2.5 font-medium flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-yellow-500" />
                  推荐问题
                  <span className="ml-auto text-[10px] bg-secondary-100 text-secondary-600 dark:bg-secondary-900/30 dark:text-secondary-400 px-1.5 py-0.5 rounded-full">
                    {analysis.suggestedQuestions.length}个
                  </span>
                </div>
                <div className="space-y-1.5">
                  {analysis.suggestedQuestions.map((question, i) => (
                    <SuggestedQuestionCard
                      key={i}
                      question={question}
                      onApply={onApplyQuestion}
                      index={i}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Footer Hint */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-700 text-[10px] text-neutral-400 text-center flex items-center justify-center gap-3">
              <span>点击问题自动填充</span>
              <span>·</span>
              <span>按 ESC 关闭</span>
              <span>·</span>
              <span>支持快捷操作</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default memo(DeepThinkingPanel)
