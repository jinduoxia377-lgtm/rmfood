/**
 * CalloutBlock — 提示框区块
 *
 * 四种变体：
 * - info(蓝): 一般信息
 * - success(绿): 成功/正向结果
 * - warning(黄): 警告/注意
 * - summary(暖米): 摘要总结
 *
 * 配色体系与 MarkdownRenderer 保持一致
 */
import React, { useState } from 'react'
import {
  Info, CheckCircle, AlertTriangle, FileText,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import type { CalloutData } from '../types'

interface CalloutBlockProps {
  data: CalloutData
}

const CALLOUT_STYLES: Record<string, {
  icon: typeof Info
  label: string
  containerClass: string
  iconColor: string
  titleColor: string
  textColor: string
  borderColor: string
}> = {
  info: {
    icon: Info,
    label: '信息',
    containerClass: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-500 dark:text-blue-400',
    titleColor: 'text-blue-700 dark:text-blue-300',
    textColor: 'text-blue-600/80 dark:text-blue-300/80',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  success: {
    icon: CheckCircle,
    label: '分析结果',
    containerClass: 'bg-emerald-50 dark:bg-emerald-950/30',
    iconColor: 'text-emerald-500 dark:text-emerald-400',
    titleColor: 'text-emerald-700 dark:text-emerald-300',
    textColor: 'text-emerald-600/80 dark:text-emerald-300/80',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  warning: {
    icon: AlertTriangle,
    label: '注意事项',
    containerClass: 'bg-amber-50 dark:bg-amber-950/30',
    iconColor: 'text-amber-500 dark:text-amber-400',
    titleColor: 'text-amber-700 dark:text-amber-300',
    textColor: 'text-amber-600/80 dark:text-amber-300/80',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  summary: {
    icon: FileText,
    label: '总结',
    containerClass: 'bg-amber-50/60 dark:bg-amber-950/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    titleColor: 'text-amber-800 dark:text-amber-300',
    textColor: 'text-gray-600 dark:text-gray-400',
    borderColor: 'border-amber-200/80 dark:border-amber-800/60',
  },
}

function CalloutBlock({ data }: CalloutBlockProps) {
  const { variant = 'info', title, content, details } = data
  const [showDetails, setShowDetails] = useState(false)

  const style = CALLOUT_STYLES[variant] || CALLOUT_STYLES.info
  const Icon = style.icon

  return (
    <div className={`mb-3 last:mb-0 rounded-lg border ${style.borderColor} ${style.containerClass} overflow-hidden`}>
      <div className="flex items-start gap-2 px-3 py-2">
        <Icon className={`flex-shrink-0 w-4 h-4 mt-0.5 ${style.iconColor}`} />
        <div className="min-w-0 flex-1">
          <div className={`text-xs font-semibold ${style.titleColor}`}>
            {title || style.label}
          </div>
          <p className={`text-[11px] leading-relaxed mt-0.5 ${style.textColor}`}>
            {content}
          </p>
        </div>
      </div>

      {details && details.length > 0 && (
        <>
          <button
            onClick={() => setShowDetails(prev => !prev)}
            className="flex items-center gap-1 px-3 py-1.5 w-full text-left
              text-[10px] text-gray-400 dark:text-gray-500
              hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>{showDetails ? '收起详情' : '查看详情'}</span>
          </button>
          {showDetails && (
            <div className="px-3 pb-2 space-y-1">
              {details.map((detail, i) => (
                <p key={i} className={`text-[10px] leading-relaxed pl-6 ${style.textColor} opacity-80`}>
                  • {detail}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default CalloutBlock
