/**
 * 卡片错误状态组件
 * 当数据加载失败时显示，提供重试入口
 */
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Card, CardContent, Button } from '@/components/ui'
import { cn } from '@/lib/utils'

interface ErrorCardProps {
  title: string
  message?: string
  onRetry?: () => void
  className?: string
}

export const ErrorCard: FC<ErrorCardProps> = ({ title, message, onRetry, className }) => {
  const { t } = useTranslation()
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-warning-100 dark:bg-warning-300/25 flex items-center justify-center shrink-0">
            <AlertTriangle size={16} className="text-warning-600 dark:text-warning-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{title}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{message ?? t('pages.dashboard.cards.loadFailed')}</p>
          </div>
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={onRetry}
              className="shrink-0"
            >
              {t('pages.dashboard.cards.retry')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
