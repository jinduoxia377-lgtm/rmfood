/**
 * AIRecommendationSidebar - 上下文感知推荐侧边栏
 *
 * 基于用户行为和上下文的智能推荐：
 * - 协同过滤推荐
 * - 内容相似度匹配
 * - 实时刷新
 * - 推荐理由展示
 *
 * @version 2.0.0
 * @lastUpdated 2026-05-20
 */

import React, { useState, useCallback, useEffect } from 'react'
import {
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Eye,
  RefreshCw,
  Star,
  TrendingUp,
  Clock,
  ChevronRight,
  Loader2,
  Zap,
} from 'lucide-react'
import { Button, Badge, Card, Tooltip } from '@/components/ui'
import { logger } from '@/utils/safeLogger'
import { fetchWithCsrf } from '@/utils/csrf'

// ===== 类型定义 =====

interface RecommendationItem {
  id: number
  type: 'template' | 'formula' | 'tip' | 'article'
  title: string
  description: string
  confidence_score: number
  metadata: Record<string, unknown>
}

interface RecommendationResponse {
  recommendations: RecommendationItem[]
  context_signals: Record<string, unknown>
  generated_at: string
}

// ===== 配置常量 =====

const TYPE_ICONS = {
  template: <Star size={14} className="text-accent-600" />,
  formula: <Zap size={14} className="text-secondary-600" />,
  tip: <TrendingUp size={14} className="text-success-600" />,
  article: <Eye size={14} className="text-warning-600" />,
}

const TYPE_LABELS = {
  template: '模板',
  formula: '配方',
  tip: '技巧',
  article: '文章',
}

// ===== 主组件 =====

interface AIRecommendationSidebarProps {
  userId?: string | number
  maxItems?: number
  showTypeFilter?: boolean
  onRecommendationClick?: (item: RecommendationItem) => void
  onFeedbackSubmit?: (itemId: string | number, feedback: 'like' | 'dislike' | 'viewed') => void
  className?: string
}

export function AIRecommendationSidebar({
  maxItems = 8,
  showTypeFilter = true,
  onRecommendationClick,
  onFeedbackSubmit,
  className = '',
}: AIRecommendationSidebarProps) {
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const [feedbackState, setFeedbackState] = useState<Record<string, 'like' | 'dislike'>>({})

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchRecommendations()
  }, [])

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const fetchRecommendations = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      // 2026-10-12 修复：后端 /recommendations 是 POST，此前用 GET 导致 405。
      const response = await fetchWithCsrf<RecommendationResponse>('/api/v1/ai/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          limit: maxItems,
          ...(typeFilter !== 'all' && { type_filter: typeFilter }),
        }),
      })

      setRecommendations(response.recommendations || [])
      setLastRefreshTime(new Date())

      logger.info('Recommendations fetched', {
        count: response.recommendations?.length || 0,
        signals: response.context_signals,
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
      logger.error('Failed to fetch recommendations:', err)

      setRecommendations([])
    } finally {
      setIsLoading(false)
    }
  }, [maxItems, typeFilter])

  const handleFeedback = useCallback(
    async (item: RecommendationItem, feedback: 'like' | 'dislike') => {
      setFeedbackState((prev) => ({ ...prev, [String(item.id)]: feedback }))

      try {
        await fetch('/api/v1/ai/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suggestion_id: item.id,
            feedback_type: feedback === 'like' ? 'like' : 'dislike',
            is_helpful: feedback === 'like',
          }),
        })

        onFeedbackSubmit?.(item.id, feedback)
      } catch (err) {
        logger.error('Feedback submission failed:', err)
      }
    },
    [onFeedbackSubmit],
  )

  const handleClick = useCallback(
    (item: RecommendationItem) => {
      onRecommendationClick?.(item)

      setFeedbackState((prev) => ({ ...prev, [String(item.id)]: 'like' as const }))
      handleFeedback(item, 'viewed' as unknown as 'like')
    },
    [onRecommendationClick],
  )

  const getConfidenceColor = (score: number) => {
    if (score >= 0.85) return 'text-success-600 bg-success-50'
    if (score >= 0.7) return 'text-secondary-600 bg-secondary-50'
    if (score >= 0.5) return 'text-warning-600 bg-warning-50'
    return 'text-neutral-600 bg-neutral-50 dark:bg-neutral-800'
  }

  const filteredRecommendations =
    typeFilter === 'all'
      ? recommendations
      : recommendations.filter((r) => r.type === typeFilter)

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <Sparkles size={16} className="text-accent-600" />
          为您推荐
          {!isLoading && recommendations.length > 0 && (
            <Badge variant="info" size="sm">
              {recommendations.length}
            </Badge>
          )}
        </h3>

        <div className="flex items-center gap-1">
          <Tooltip content="刷新推荐">
            <button
              onClick={fetchRecommendations}
              disabled={isLoading}
              className="p-1.5 hover:bg-neutral-100 dark:bg-neutral-800 rounded-md transition-colors"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 类型筛选 */}
      {showTypeFilter && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              typeFilter === 'all'
                ? 'bg-accent-100 text-accent-700 border border-accent-300'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            全部
          </button>
          {(Object.keys(TYPE_LABELS) as (keyof typeof TYPE_LABELS)[]).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap flex items-center gap-1 transition-colors ${
                typeFilter === type
                  ? 'bg-accent-100 text-accent-700 border border-accent-300'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {TYPE_ICONS[type]}
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      )}

      {/* 加载状态 */}
      {isLoading && (
        <div className="py-12 text-center">
          <Loader2 size={32} className="mx-auto animate-spin text-accent-600 mb-3" />
          <p className="text-sm text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">正在生成个性化推荐...</p>
        </div>
      )}

      {/* 错误状态 */}
      {error && !isLoading && (
        <Card className="p-4 text-center">
          <p className="text-sm text-error-600 mb-2">加载失败</p>
          <Button onClick={fetchRecommendations} variant="outline" size="sm">
            重试
          </Button>
        </Card>
      )}

      {/* 空状态 */}
      {!isLoading && !error && filteredRecommendations.length === 0 && (
        <div className="py-8 text-center text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
          <Sparkles size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">暂无推荐内容</p>
          <p className="text-xs mt-1">继续使用平台后将获得更多个性化推荐</p>
        </div>
      )}

      {/* 推荐列表 */}
      {!isLoading &&
        filteredRecommendations.map((item, index) => (
          <Card key={`${item.id}-${index}`} className="p-3 hover:shadow-md transition-shadow group">
            <div className="flex items-start gap-3">
              {/* 序号 */}
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-[var(--color-accent-surface)] to-[var(--color-danger-surface-deep)] text-white text-xs flex items-center justify-center font-semibold">
                {index + 1}
              </span>

              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => handleClick(item)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {TYPE_ICONS[item.type] || TYPE_ICONS.template}
                    <h4 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 line-clamp-1 group-hover:text-accent-600 transition-colors">
                      {item.title}
                    </h4>
                  </div>

                  <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] line-clamp-2 mb-2">{item.description}</p>

                  {/* 推荐理由标签 */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Array.isArray(item.metadata.confidence_reasons) &&
                      item.metadata.confidence_reasons.slice(0, 2).map((reason: unknown, i: number) => (
                        <Badge key={i} variant="info" size="sm">
                          {String(reason)}
                        </Badge>
                      ))}
                  </div>

                  {/* 底部元信息 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="neutral"
                        size="sm"
                        className={`text-xs ${getConfidenceColor(item.confidence_score)}`}
                      >
                        匹配度 {(item.confidence_score * 100).toFixed(0)}%
                      </Badge>

                      <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] flex items-center gap-1">
                        <Clock size={10} />
                        {TYPE_LABELS[item.type]}
                      </span>
                    </div>

                    <ChevronRight
                      size={14}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]"
                    />
                  </div>
                </button>

                {/* 反馈按钮 */}
                <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                  <Tooltip content="有用">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleFeedback(item, 'like')
                      }}
                      className={`p-1 rounded hover:bg-success-50 transition-colors ${
                        feedbackState[String(item.id)] === 'like'
                          ? 'text-success-600 bg-success-50'
                          : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'
                      }`}
                    >
                      <ThumbsUp size={14} />
                    </button>
                  </Tooltip>

                  <Tooltip content="不感兴趣">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleFeedback(item, 'dislike')
                      }}
                      className={`p-1 rounded hover:bg-error-50 transition-colors ${
                        feedbackState[String(item.id)] === 'dislike'
                          ? 'text-error-600 bg-error-50'
                          : 'text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]'
                      }`}
                    >
                      <ThumbsDown size={14} />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </Card>
        ))}

      {/* 最后更新时间 */}
      {lastRefreshTime && !isLoading && (
        <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-center pt-2">
          上次更新: {lastRefreshTime.toLocaleTimeString('zh-CN')}
        </p>
      )}
    </div>
  )
}

export default AIRecommendationSidebar
