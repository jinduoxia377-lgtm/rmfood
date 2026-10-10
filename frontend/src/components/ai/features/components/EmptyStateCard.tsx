/**
 * EmptyStateCard - 空状态欢迎引导卡片 (v2.0)
 *
 * 职责：
 * - 展示欢迎标题和副标题
 * - 展示 3 个热门快捷问题
 * - 点击快捷问题直接发送
 *
 * @version 2.0.0
 * @author RMFOOD Team
 */

import React from 'react'
import { Brain, Sparkles, MessageSquare, FlaskConical } from 'lucide-react'

interface QuickQuestion {
  id: string
  question: string
  category: string
  popular: boolean
}

interface EmptyStateCardProps {
  welcomeTitle: string
  welcomeSubtitle: string
  questions: QuickQuestion[]
  onAsk: (question: string) => void
  llmAvailable?: boolean
}

const featureIcons = [Sparkles, MessageSquare, FlaskConical]

export function EmptyStateCard({
  welcomeTitle,
  welcomeSubtitle,
  questions,
  onAsk,
  llmAvailable = true,
}: EmptyStateCardProps) {
  const popularQuestions = questions.filter((q) => q.popular).slice(0, 3)

  return (
    <div className="flex flex-col items-center justify-center min-h-[45vh] max-w-3xl mx-auto w-full animate-[fadeInUp_0.4s_ease-out_both]">
      {/* 欢迎区域 */}
      <div className="text-center mb-8">
        {/* AI 头像 */}
        <div className="relative inline-block mb-5">
          <div className="w-12 h-12 rounded-lg bg-primary-600 flex items-center justify-center shadow-sm">
            <Brain className="w-6 h-6 text-white" />
          </div>
          {llmAvailable !== false && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success-500 rounded-full border-2 border-white dark:border-neutral-900" />
          )}
        </div>

        {/* 欢迎标题 */}
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-1.5 tracking-tight">
          {welcomeTitle}
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-300 max-w-md mx-auto leading-relaxed">
          {welcomeSubtitle}
        </p>
      </div>

      {/* 快捷问题卡片 */}
      <div className="w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {popularQuestions.map((q, index) => {
            const FeatureIcon = featureIcons[index % featureIcons.length]
            return (
              <button
                key={q.id}
                onClick={() => onAsk(q.question)}
                className="flex flex-col items-start p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors duration-150 text-left"
              >
                {/* 图标 */}
                <div className="w-8 h-8 rounded-md bg-primary-50 dark:bg-primary-300/20 flex items-center justify-center mb-2.5">
                  <FeatureIcon className="w-4 h-4 text-primary-700 dark:text-primary-700" />
                </div>

                {/* 分类标签 */}
                <span className="text-xs font-semibold text-primary-700 dark:text-primary-700 mb-1.5 uppercase tracking-wider">
                  {q.category}
                </span>

                {/* 问题文本 */}
                <span className="text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed">
                  {q.question}
                </span>
              </button>
            )
          })}
        </div>

        {/* 提示文字 */}
        <div className="mt-5 text-center">
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
            您也可以直接输入需求，AI 将为您智能生成配方方案
          </p>
        </div>
      </div>
    </div>
  )
}
