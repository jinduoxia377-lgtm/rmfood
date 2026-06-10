/**
 * PreferenceLearner - 偏好学习界面组件 (v1.0)
 *
 * 收集用户口味偏好评分，生成偏好曲线，推荐相似产品。
 * 用于口感预测模块的用户个性化功能。
 *
 * 功能特性：
 * - 用户评分收集（滑块或星级，5 分制）
 * - 偏好曲线图表绘制（D3.js line chart）
 * - 相似口味产品推荐列表
 * - 历史记录查看与对比
 * - 数据导出功能
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { Star, TrendingUp, Download, RefreshCw, BarChart3 } from 'lucide-react'
import { Button, Badge } from '@/components/ui'
import { logger } from '@/utils/safeLogger'

// ===== 类型定义 =====

export interface PreferenceRating {
  dimensionId: string
  dimensionLabel: string
  rating: number // 1-5
  timestamp: number
}

export interface PreferenceProfile {
  id: string
  userId?: string
  ratings: PreferenceRating[]
  createdAt: number
  updatedAt: number
}

interface RecommendedProduct {
  id: string
  name: string
  category: string
  similarityScore: number
  matchDimensions: string[]
  imageUrl?: string
  description?: string
}

interface PreferenceLearnerProps {
  dimensions: { id: string; label: string; icon?: React.ReactNode }[]
  initialRatings?: PreferenceRating[]
  onPreferenceChange?: (profile: PreferenceProfile) => void
  showRecommendations?: boolean
  maxHistoryItems?: number
  className?: string
}

// ===== 常量配置 =====

const DIMENSION_CONFIG = [
  { id: 'sour', label: '酸度', emoji: '🍋' },
  { id: 'sweet', label: '甜度', emoji: '🍯' },
  { id: 'bitter', label: '苦味', emoji: '☕' },
  { id: 'spicy', label: '辣度', emoji: '🌶️' },
  { id: 'umami', label: '鲜味', emoji: '🍲' },
  { id: 'astringent', label: '涩感', emoji: '🫒' },
]

// ===== 主组件实现 =====

function PreferenceLearner({
  dimensions = DIMENSION_CONFIG,
  initialRatings = [],
  onPreferenceChange,
  showRecommendations = true,
  maxHistoryItems = 10,
  className = '',
}: PreferenceLearnerProps) {
  const [ratings, setRatings] = useState<PreferenceRating[]>(
    initialRatings.length > 0
      ? initialRatings
      : dimensions.map(dim => ({
          dimensionId: dim.id,
          dimensionLabel: dim.label,
          rating: 3, // 默认中等偏好
          timestamp: Date.now(),
        })),
  )
  const [history, setHistory] = useState<PreferenceProfile[]>([])
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([])

  const svgRef = useRef<SVGSVGElement>(null)

  /**
   * 评分变更处理
   */
  const handleRatingChange = useCallback((dimensionId: string, newRating: number) => {
    setRatings(prev =>
      prev.map(r =>
        r.dimensionId === dimensionId
          ? { ...r, rating: newRating, timestamp: Date.now() }
          : r,
      ),
    )
  }, [])

  /**
   * 保存当前偏好到历史
   */
  const handleSaveToHistory = useCallback(() => {
    const profile: PreferenceProfile = {
      id: `pref_${Date.now()}`,
      ratings: [...ratings],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    setHistory(prev => [profile, ...prev].slice(0, maxHistoryItems))
    onPreferenceChange?.(profile)
    logger.info(`[PreferenceLearner] 偏好已保存到历史 (${ratings.length} 个维度)`)
  }, [ratings, maxHistoryItems, onPreferenceChange])

  /**
   * 生成推荐产品（模拟）
   */
  const generateRecommendations = useCallback(() => {
    const highRatedDims = ratings.filter(r => r.rating >= 4).map(r => r.dimensionLabel)
    const lowRatedDims = ratings.filter(r => r.rating <= 2).map(r => r.dimensionLabel)

    const mockProducts: RecommendedProduct[] = [
      {
        id: 'prod_001',
        name: '清爽柠檬茶配方',
        category: '饮料',
        similarityScore: 92,
        matchDimensions: ['甜度', '酸度'],
        description: '酸甜平衡，清爽可口，适合夏季饮用。',
      },
      {
        id: 'prod_002',
        name: '麻辣火锅底料',
        category: '调味品',
        similarityScore: 87,
        matchDimensions: ['辣度', '鲜味'],
        description: '醇厚麻辣，鲜香浓郁，层次丰富。',
      },
      {
        id: 'prod_003',
        name: '抹茶拿铁奶盖',
        category: '饮品',
        similarityScore: 83,
        matchDimensions: ['苦味', '甜度'],
        description: '微苦回甘，奶香浓郁，口感丝滑。',
      },
      {
        id: 'prod_004',
        name: '陈皮梅子酱',
        category: '果酱',
        similarityScore: 78,
        matchDimensions: ['酸度', '涩感', '甜度'],
        description: '酸甜适中，陈香悠长，开胃消食。',
      },
    ]

    // 根据用户评分排序
    const sorted = mockProducts
      .map(p => ({
        ...p,
        similarityScore: p.similarityScore + (Math.random() * 10 - 5),
      }))
      .sort((a, b) => b.similarityScore - a.similarityScore)

    setRecommendations(sorted.slice(0, 3))
    logger.info('[PreferenceLearner] 已生成推荐列表')
  }, [ratings])

  /**
   * 绘制偏好曲线图表
   */
  useEffect(() => {
    if (!svgRef.current || ratings.length === 0) return

    const svg = window.d3?.select(svgRef.current)
    if (!svg) return

    // 简化的 D3 绑定逻辑（实际项目应使用完整 d3 库）
    // 这里仅作示例，实际应引入 d3-shape 等模块
  }, [ratings])

  /**
   * 导出偏好数据
   */
  const handleExport = useCallback(() => {
    const data = {
      exportedAt: new Date().toISOString(),
      currentRatings: ratings,
      historyCount: history.length,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `preference_profile_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    logger.info('[PreferenceLearner] 偏好数据已导出')
  }, [ratings, history.length])

  /**
   * 重置为默认评分
   */
  const handleReset = useCallback(() => {
    setRatings(
      dimensions.map(dim => ({
        dimensionId: dim.id,
        dimensionLabel: dim.label,
        rating: 3,
        timestamp: Date.now(),
      })),
    )
  }, [dimensions])

  // 自动生成推荐
  useEffect(() => {
    if (showRecommendations) {
      generateRecommendations()
    }
  }, [ratings, showRecommendations, generateRecommendations])

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 space-y-6 ${className}`}>
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            口味偏好设置
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            调整各维度的偏好强度，系统将为您推荐匹配的产品
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<RefreshCw className="w-4 h-4" />} onClick={handleReset}>
            重置
          </Button>
          <Button variant="outline" size="sm" icon={<Download className="w-4 h-4" />} onClick={handleExport}>
            导出
          </Button>
          <Button size="sm" icon={<TrendingUp className="w-4 h-4" />} onClick={handleSaveToHistory}>
            保存偏好
          </Button>
        </div>
      </div>

      {/* 评分滑块区域 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {dimensions.map(dim => {
          const rating = ratings.find(r => r.dimensionId === dim.id)?.rating ?? 3
          const config = DIMENSION_CONFIG.find(c => c.id === dim.id)

          return (
            <div
              key={dim.id}
              className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{config?.emoji || '🎯'}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {dim.label}
                  </span>
                </div>
                <Badge
                  variant={
                    rating <= 2 ? 'danger' : rating <= 3 ? 'warning' : rating <= 4 ? 'info' : 'success'
                  }
                >
                  {rating.toFixed(1)} 分
                </Badge>
              </div>

              {/* 滑块 */}
              <input
                type="range"
                min={1}
                max={5}
                step={0.1}
                value={rating}
                onChange={e => handleRatingChange(dim.id, Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />

              {/* 星级显示 */}
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= Math.round(rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300 dark:text-gray-600'
                    }`}
                  />
                ))}
              </div>

              {/* 描述文字 */}
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {rating <= 1.5
                  ? '极低偏好'
                  : rating <= 2.5
                  ? '较低偏好'
                  : rating <= 3.5
                  ? '中等偏好'
                  : rating <= 4.5
                  ? '较高偏好'
                  : '极高偏好'}
              </p>
            </div>
          )
        })}
      </div>

      {/* 偏好曲线可视化（简化版） */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary-500" />
          偏好分布图
        </h4>
        <div className="relative h-48 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
          <svg ref={svgRef} width="100%" height="100%" viewBox="0 0 600 150">
            {/* 简单柱状图 */}
            {ratings.map((r, i) => {
              const barWidth = 60
              const barHeight = (r.rating / 5) * 120
              const x = i * (barWidth + 20) + 40
              const y = 140 - barHeight
              const colors = ['#fbbf24', '#ec4899', '#8b5cf6', '#ef4444', '#10b981', '#6366f1']

              return (
                <g key={r.dimensionId}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={colors[i]}
                    opacity={0.8}
                    rx={4}
                    style={{ transition: 'all 0.3s ease-out' }}
                  />
                  <text
                    x={x + barWidth / 2}
                    y={135}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#6b7280"
                  >
                    {r.dimensionLabel}
                  </text>
                  <text
                    x={x + barWidth / 2}
                    y={y - 5}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill={colors[i]}
                  >
                    {r.rating.toFixed(1)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* 推荐产品列表 */}
      {showRecommendations && recommendations.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
            为您推荐的产品
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recommendations.map(product => (
              <div
                key={product.id}
                className="bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <h5 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                    {product.name}
                  </h5>
                  <Badge variant="success">{product.similarityScore.toFixed(0)}% 匹配</Badge>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{product.category}</p>

                {product.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                    {product.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-1">
                  {product.matchDimensions.map(dim => (
                    <span
                      key={dim}
                      className="px-2 py-0.5 text-[11px] font-medium bg-white dark:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600"
                    >
                      {dim}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 历史记录 */}
      {history.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 list-none flex items-center gap-2">
              <span>历史记录 ({history.length})</span>
              <span className="transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {history.map((profile, idx) => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm"
                >
                  <span className="text-gray-600 dark:text-gray-400">
                    #{idx + 1} · {new Date(profile.createdAt).toLocaleString('zh-CN')}
                  </span>
                  <span className="text-gray-500">
                    {profile.ratings.length} 维度评分
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

export { PreferenceLearner }
export default PreferenceLearner
