/**
 * 空状态组件
 *
 * @description 用于列表、搜索等场景的空白状态展示
 * @version 1.0.0
 */

import React from 'react'
import { Sparkles, Search, FileText, AlertCircle, Inbox } from 'lucide-react'
import { Button, Badge } from '@/components/ui'

interface EmptyStateProps {
  type?: 'default' | 'search' | 'form' | 'error' | 'list'
  title?: string
  description?: string
  icon?: React.ReactNode
  action?: {
    label: string
    onClick: () => void
  }
  suggestions?: string[]
}

const DEFAULT_CONFIGS = {
  default: {
    icon: <Inbox className="w-12 h-12" />,
    title: '暂无数据',
    description: '当前没有数据，请稍后再试',
  },
  search: {
    icon: <Search className="w-12 h-12" />,
    title: '未找到结果',
    description: '请尝试调整搜索条件',
  },
  form: {
    icon: <FileText className="w-12 h-12" />,
    title: '开始创建',
    description: '填写表单以创建新内容',
  },
  error: {
    icon: <AlertCircle className="w-12 h-12" />,
    title: '加载失败',
    description: '请稍后重试',
  },
  list: {
    icon: <Sparkles className="w-12 h-12" />,
    title: '开始创建配方',
    description: '选择您希望达到的功效，我们将为您生成科学的配方组合',
  },
} as const

export function EmptyState({
  type = 'default',
  title,
  description,
  icon,
  action,
  suggestions,
}: EmptyStateProps) {
  const config = DEFAULT_CONFIGS[type]
  const displayIcon = icon || config.icon
  const displayTitle = title || config.title
  const displayDescription = description || config.description

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 flex items-center justify-center text-primary-500">
        {displayIcon}
      </div>

      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {displayTitle}
      </h3>

      <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mb-6">
        {displayDescription}
      </p>

      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {suggestions.map((suggestion, index) => (
            <Badge key={index} variant="secondary" className="px-3 py-1.5 text-sm">
              {suggestion}
            </Badge>
          ))}
        </div>
      )}

      {action && (
        <Button onClick={action.onClick} leftIcon={<Sparkles className="w-4 h-4" />}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

export function EmptyFormulaState({ onQuickStart }: { onQuickStart?: () => void }) {
  return (
    <EmptyState
      type="list"
      icon={<Sparkles className="w-12 h-12" />}
      title="开始创建配方"
      description="选择您希望达到的功效，我们将为您生成科学的配方组合"
      suggestions={['💪 增强免疫力', '😴 改善睡眠', '🦴 骨骼关节', '❤️ 心血管健康']}
      action={
        onQuickStart
          ? {
              label: '快速开始',
              onClick: onQuickStart,
            }
          : undefined
      }
    />
  )
}

export function EmptySearchState({ query }: { query?: string }) {
  return (
    <EmptyState
      type="search"
      icon={<Search className="w-12 h-12" />}
      title="未找到匹配的配方"
      description={
        query
          ? `未找到包含"${query}"的配方，请尝试其他关键词`
          : '请尝试调整筛选条件'
      }
    />
  )
}

export function EmptyListState({ message }: { message?: string }) {
  return (
    <EmptyState
      type="default"
      icon={<Inbox className="w-12 h-12" />}
      title="暂无内容"
      description={message || '当前列表为空'}
    />
  )
}
