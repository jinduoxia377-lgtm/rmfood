/**
 * 配方评分组件
 * 支持5星评分、评价内容和评分统计
 */
import { useState } from 'react'
import { Star, ThumbsUp, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button, Textarea, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'

interface RatingStats {
  average: number
  total: number
  distribution: {
    5: number
    4: number
    3: number
    2: number
    1: number
  }
}



interface FormulaRatingProps {
  formulaId: number
  formulaName: string
  onRatingChange?: (newRating: number) => void
}

const RATING_STORAGE_KEY = 'rmfood_formula_ratings'

function getStoredRatings(): Record<number, { rating: number; comment: string }> {
  try {
    const stored = localStorage.getItem(RATING_STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function storeRating(formulaId: number, rating: number, comment: string) {
  const ratings = getStoredRatings()
  ratings[formulaId] = { rating, comment }
  localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify(ratings))
}

export function FormulaRating({ formulaId, formulaName, onRatingChange }: FormulaRatingProps) {
  const { addToast } = useToast()

  // 获取初始评分数据
  const initialRatingData = (() => {
    const stored = getStoredRatings()
    return stored[formulaId] || { rating: 0, comment: '' }
  })()

  const [userRating, setUserRating] = useState(initialRatingData.rating)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState(initialRatingData.comment)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCommentForm, setShowCommentForm] = useState(false)

  // 模拟评分统计数据
  const [stats] = useState<RatingStats>({
    average: 4.6,
    total: 128,
    distribution: { 5: 89, 4: 26, 3: 8, 2: 3, 1: 2 },
  })

  const handleSubmitRating = async () => {
    if (userRating === 0) {
      addToast({ type: 'error', message: '请选择评分' })
      return
    }

    setIsSubmitting(true)

    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 800))

    storeRating(formulaId, userRating, comment)
    setIsSubmitting(false)
    setShowCommentForm(false)

    addToast({ type: 'success', message: '评分成功，感谢您的反馈！' })
    onRatingChange?.(userRating)
  }

  const displayRating = hoverRating || userRating

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3" className="text-base flex items-center gap-2">
          <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
          配方评分
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 评星选择 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => {
                  setUserRating(star)
                  setShowCommentForm(true)
                }}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  size={28}
                  className={cn(
                    'transition-colors',
                    star <= displayRating
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-slate-300 dark:text-slate-600',
                  )}
                />
              </button>
            ))}
          </div>

          {userRating > 0 && (
            <span className="text-lg font-semibold text-slate-900 dark:text-white">
              {userRating}.0
            </span>
          )}
        </div>

        {/* 评分统计 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div className="text-3xl font-bold text-amber-500">{stats.average}</div>
            <div className="flex items-center justify-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={12}
                  className={star <= Math.round(stats.average) ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}
                />
              ))}
            </div>
            <div className="text-xs text-slate-500 mt-1">{stats.total} 人评分</div>
          </div>

          <div className="space-y-1">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-slate-500">{star}</span>
                <Star size={10} className="text-amber-500 fill-amber-500" />
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${stats.total > 0 ? (stats.distribution[star as keyof typeof stats.distribution] / stats.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-6 text-slate-400 text-right">
                  {stats.distribution[star as keyof typeof stats.distribution]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 评价表单 */}
        {showCommentForm && userRating > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`分享您对「${formulaName}」的评价和使用体验...`}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {comment.length}/500
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCommentForm(false)}
                >
                  取消
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmitRating}
                  loading={isSubmitting}
                  icon={<ThumbsUp size={14} />}
                >
                  提交评分
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 评价提示 */}
        {!userRating && (
          <p className="text-sm text-slate-500 text-center">
            点击星星为配方评分，提交后将显示在评价中
          </p>
        )}

        {/* 用户已评分提示 */}
        {userRating > 0 && !showCommentForm && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">
              您已评 {userRating} 分
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCommentForm(true)}
              icon={<MessageSquare size={14} />}
            >
              {comment ? '修改评价' : '添加评价'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
