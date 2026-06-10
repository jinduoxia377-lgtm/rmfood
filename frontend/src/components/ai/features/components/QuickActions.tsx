/**
 * QuickActions - 快捷操作栏组件 (v6.0)
 *
 * 职责：展示示例问题按钮组、全局报告按钮等快捷入口。
 * 从 ChatTab 主组件中提取，实现关注点分离。
 *
 * 功能特性:
 * - 示例问题快速填充输入框
 * - 综合报告一键生成入口
 * - 响应式布局适配（移动端/桌面端）
 * - 无障碍访问支持 (ARIA)
 *
 * @version 6.0.0
 * @lastUpdated 2026-05-10
 */

import React, { memo } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import type { QuickQuestion } from '@/config/ai/questions'
import { QUICK_QUESTIONS } from '@/config/ai/questions'

interface QuickActionsProps {
  formulaCount: number
  onGenerateComprehensiveReport: () => void
  isGeneratingReport: boolean
  onQuestionClick?: (question: string) => void
  showQuestions?: boolean
  maxQuestionCount?: number
}

const QuickActions = memo(({
  formulaCount,
  onGenerateComprehensiveReport,
  isGeneratingReport,
  onQuestionClick,
  showQuestions = true,
  maxQuestionCount = 4,
}: QuickActionsProps) => {
  const displayQuestions: QuickQuestion[] = showQuestions
    ? QUICK_QUESTIONS.slice(0, maxQuestionCount)
    : []

  const handleQuestionClick = (question: string) => {
    if (onQuestionClick) {
      onQuestionClick(question)
    }
  }

  return (
    <div className="quick-actions-container" role="region" aria-label="快捷操作">
      {displayQuestions.length > 0 && (
        <div className="quick-questions-section mb-4">
          <div className="flex flex-wrap gap-2 sm:gap-3 max-w-2xl justify-center">
            {displayQuestions.map((q) => (
              <button
                key={q.id}
                onClick={() => handleQuestionClick(q.question)}
                className="
                  text-xs sm:text-sm px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl
                  border border-gray-200 dark:border-gray-700
                  hover:bg-primary-50 dark:hover:bg-primary-900/20
                  hover:border-primary-300 dark:hover:border-primary-700
                  hover:text-primary-700 dark:hover:text-primary-300
                  transition-all duration-200 shadow-sm hover:shadow-md
                  active:scale-[0.98]
                  focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                "
                style={{ color: 'var(--text-secondary)' }}
                aria-label={`快捷问题: ${q.question}`}
                title={q.question}
              >
                <span className="truncate block max-w-[180px]">{q.question}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {formulaCount > 0 && (
        <div className="comprehensive-report-section mt-3">
          <button
            onClick={onGenerateComprehensiveReport}
            disabled={isGeneratingReport || formulaCount === 0}
            className={`
              w-full flex items-center justify-center gap-2 px-4 py-2.5
              bg-gradient-to-r from-indigo-500 to-purple-600 
              hover:from-indigo-600 hover:to-purple-700
              text-white font-medium rounded-xl
              shadow-md hover:shadow-lg
              transition-all duration-200
              active:scale-[0.98]
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
              ${isGeneratingReport
                ? 'opacity-75 cursor-wait'
                : ''
              }
              ${formulaCount === 0
                ? 'opacity-50 cursor-not-allowed'
                : ''
              }
            `}
            aria-label={
              isGeneratingReport
                ? '正在生成综合报告'
                : `生成综合报告 (${formulaCount}个配方)`
            }
          >
            {isGeneratingReport ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" aria-hidden="true" />
                <span>生成综合报告</span>
                {formulaCount > 1 && (
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-mono">
                    {formulaCount}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
})

QuickActions.displayName = 'QuickActions'

export { QuickActions }
export default QuickActions
