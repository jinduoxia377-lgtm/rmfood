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
import React, { useState, useCallback } from 'react'
import {
  Info, CheckCircle, AlertTriangle, FileText,
  ChevronDown, ChevronUp, Copy, Check,
} from 'lucide-react'
import type { CalloutData, CalloutVariant } from '../types'

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
    containerClass: 'bg-secondary-50 dark:bg-secondary-950/30',
    iconColor: 'text-secondary-500 dark:text-secondary-700',
    titleColor: 'text-secondary-700 dark:text-secondary-700',
    textColor: 'text-secondary-600/80 dark:text-secondary-700/80',
    borderColor: 'border-secondary-200 dark:border-secondary-800',
  },
  success: {
    icon: CheckCircle,
    label: '分析结果',
    containerClass: 'bg-primary-50 dark:bg-success-950/30',
    iconColor: 'text-primary-500 dark:text-primary-700',
    titleColor: 'text-primary-700 dark:text-primary-700',
    textColor: 'text-primary-700/80 dark:text-primary-700/80',
    borderColor: 'border-success-200 dark:border-success-800',
  },
  warning: {
    icon: AlertTriangle,
    label: '注意事项',
    containerClass: 'bg-warning-50 dark:bg-warning-950/30',
    iconColor: 'text-warning-500 dark:text-warning-700',
    titleColor: 'text-warning-700 dark:text-warning-700',
    textColor: 'text-warning-600/80 dark:text-warning-700/80',
    borderColor: 'border-warning-200 dark:border-warning-800',
  },
  summary: {
    icon: FileText,
    label: '总结',
    containerClass: 'bg-warning-50/60 dark:bg-warning-950/20',
    iconColor: 'text-warning-600 dark:text-warning-700',
    titleColor: 'text-warning-800 dark:text-warning-700',
    textColor: 'text-neutral-600 dark:text-neutral-400',
    borderColor: 'border-warning-200/80 dark:border-warning-800/60',
  },
}

function CalloutBlock({ data }: CalloutBlockProps) {
  // 兼容 style（LLM 常用）→ variant 字段映射
  const normalizedData: CalloutData = {
    ...data,
    variant: ((data as unknown) as Record<string, unknown>).variant as CalloutVariant || 'info',
  }
  const { variant = 'info', title, content, details } = normalizedData
  const [showDetails, setShowDetails] = useState(false)
  const [copied, setCopied] = useState(false)

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [content]) // eslint-disable-line react-hooks/preserve-manual-memoization

  const style = CALLOUT_STYLES[variant] || CALLOUT_STYLES.info
  const Icon = style.icon

  return (
    <div className={`mb-3 last:mb-0 rounded-lg border ${style.borderColor} ${style.containerClass} overflow-hidden`}>
      <div className="flex items-start gap-2 px-3 py-2">
        <Icon className={`flex-shrink-0 w-4 h-4 mt-0.5 ${style.iconColor}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className={`text-xs font-semibold ${style.titleColor}`}>
              {title || style.label}
            </div>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 p-1 rounded hover:bg-white dark:bg-neutral-900/20 transition-colors"
              title="复制内容"
            >
              {copied ? <Check className="w-3 h-3 text-success-500" /> : <Copy className="w-3 h-3 opacity-50 hover:opacity-100" />}
            </button>
          </div>
          <p className={`text-xs leading-relaxed mt-0.5 ${style.textColor}`}>
            {content}
          </p>
        </div>
      </div>

      {details && details.length > 0 && (
        <>
          <button
            onClick={() => setShowDetails(prev => !prev)}
            className="flex items-center gap-1 px-3 py-1.5 w-full text-left
              text-xs text-neutral-400 dark:text-neutral-400
              hover:bg-black/5 dark:hover:bg-white dark:bg-neutral-900/5 transition-colors"
          >
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span>{showDetails ? '收起详情' : '查看详情'}</span>
          </button>
          {showDetails && (
            <div className="px-3 pb-2 space-y-1">
              {details.map((detail, i) => (
                <p key={i} className={`text-xs leading-relaxed pl-6 ${style.textColor} opacity-80`}>
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
