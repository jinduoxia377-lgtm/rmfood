/**
 * EmptyStateCard - 空状态欢迎引导卡片 (v1.0)
 *
 * 职责：
 * - 展示欢迎标题和副标题
 * - 展示 3 个热门快捷问题
 * - 点击快捷问题直接发送
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import React from 'react'
import { Brain } from 'lucide-react'

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
}

export function EmptyStateCard({
  welcomeTitle,
  welcomeSubtitle,
  questions,
  onAsk,
}: EmptyStateCardProps) {
  const popularQuestions = questions.filter((q) => q.popular).slice(0, 3)

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] max-w-2xl mx-auto w-full animate-[fadeInUp_0.5s_ease-out]">
      <div className="text-center mb-8">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
          <Brain className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
          {welcomeTitle}
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {welcomeSubtitle}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
        {popularQuestions.map((q) => (
          <button
            key={q.id}
            onClick={() => onAsk(q.question)}
            className="group/card flex flex-col items-start p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left"
          >
            <span className="text-xs font-medium text-primary-500 dark:text-primary-400 mb-1.5">
              {q.category}
            </span>
            <span className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed group-hover/card:text-neutral-900 dark:group-hover/card:text-white transition-colors">
              {q.question}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
