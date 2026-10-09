/**
 * 个性化推荐组件
 * 基于用户历史行为展示推荐配方
 */
import { useMemo } from 'react'
import { Card } from '@/components/ui'
import { Brain, ThumbsUp, ThumbsDown, Sparkles, Clock, Star } from 'lucide-react'
import { useUserPreferenceStore } from '@/stores/userPreferenceStore'
import type { GenerationHistory } from '@/stores/userPreferenceStore'

interface PersonalizedRecommendationsProps {
  onSelectRecommendation?: (history: GenerationHistory) => void
  maxDisplay?: number
}

export function PersonalizedRecommendations({
  onSelectRecommendation,
  maxDisplay = 3,
}: PersonalizedRecommendationsProps) {
  const { getPersonalizedRecommendations, toggleHistoryLike, addRecommendationFeedback, preferences } =
    useUserPreferenceStore()

  const recommendations = useMemo(() => {
    return getPersonalizedRecommendations()
  }, [getPersonalizedRecommendations])

  const frequentEffects = preferences.frequentEffects.slice(0, 3)

  if (recommendations.length === 0) {
    return (
      <Card className="p-4 bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 border-primary-200 dark:border-primary-800/40">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-primary-700 dark:text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-primary-700 dark:text-primary-600 mb-1">
              个性化推荐
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
              系统将学习您的偏好，为您推荐更符合需求的配方
            </p>
            {frequentEffects.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">常用功效：</span>
                {frequentEffects.map((effect) => (
                  <span
                    key={effect}
                    className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-600 rounded-full"
                  >
                    {effect}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-4 bg-gradient-to-r from-accent-50 to-primary-50 dark:from-accent-900/20 dark:to-primary-900/20 border-accent-200 dark:border-accent-800/40">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-accent-100 dark:bg-accent-900/40 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-accent-600 dark:text-accent-600" />
        </div>
        <div>
          <h3 className="font-semibold text-accent-700 dark:text-accent-600">
            为您推荐
          </h3>
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">基于您的历史偏好</p>
        </div>
      </div>

      <div className="space-y-2">
        {recommendations.slice(0, maxDisplay).map((rec, index) => (
          <div
            key={rec.id}
            className="group p-3 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-100 dark:border-neutral-700 hover:border-accent-300 dark:hover:border-accent-600 transition-colors cursor-pointer"
             role="button" tabIndex={0} onClick={() => onSelectRecommendation?.(rec)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-accent-600 dark:text-accent-600">
                    #{index + 1}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                    <Clock className="w-3 h-3" />
                    {new Date(rec.createdAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-2">
                  {rec.effects.map((effect) => (
                    <span
                      key={effect}
                      className="text-xs px-1.5 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-600 rounded"
                    >
                      {effect}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-warning-500" />
                    <span>{rec.scores.overall.toFixed(2)}</span>
                  </div>
                  <span>{rec.ingredients.length}种原料</span>
                  <span className="capitalize">{rec.generator}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    addRecommendationFeedback({
                      recommendationId: rec.id,
                      liked: true,
                      timestamp: Date.now(),
                    })
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${
                    rec.liked
                      ? 'bg-accent-100 text-accent-600 dark:bg-accent-900/40'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400'
                  }`}
                  title="喜欢"
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    addRecommendationFeedback({
                      recommendationId: rec.id,
                      liked: false,
                      timestamp: Date.now(),
                    })
                  }}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 transition-colors"
                  title="不喜欢"
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {recommendations.length > maxDisplay && (
        <button className="w-full mt-3 text-xs text-accent-600 dark:text-accent-600 hover:text-accent-700 dark:hover:text-accent-300 transition-colors">
          查看更多推荐 ({recommendations.length - maxDisplay})
        </button>
      )}
    </Card>
  )
}
