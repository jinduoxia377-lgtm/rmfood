/**
 * AI 配额超限全局提示
 * 监听 axios 拦截器派发的 ai-quota-exceeded 事件，
 * 在右下角展示引导横幅，并提供「去升级」按钮跳转到组织订阅页。
 */
import React, { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Zap, X, ArrowRight } from 'lucide-react'

interface QuotaNoticeState {
  message: string
  url?: string
  orgId?: number
  visible: boolean
}

export const AiQuotaNotice: React.FC = () => {
  const { t } = useTranslation()
  const [notice, setNotice] = useState<QuotaNoticeState>({ message: '', visible: false })

  const dismiss = useCallback(() => setNotice((p) => ({ ...p, visible: false })), [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message?: string; url?: string; org_id?: number } | undefined
      setNotice({
        message: detail?.message || t('ai.config.quotaExceeded'),
        url: detail?.url,
        orgId: detail?.org_id,
        visible: true,
      })
    }
    window.addEventListener('ai-quota-exceeded', handler)
    return () => window.removeEventListener('ai-quota-exceeded', handler)
  }, [])

  if (!notice.visible) return null

  return (
    <div className="fixed bottom-6 right-6 z-[1200] max-w-sm w-full bg-white dark:bg-neutral-900 border border-warning-300 dark:border-warning-800 shadow-2xl rounded-xl overflow-hidden animate-page-enter">
      <div className="flex items-start gap-3 p-4">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-warning-100 dark:bg-warning-300/25 flex items-center justify-center">
          <Zap className="w-5 h-5 text-warning-600 dark:text-warning-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white">{t('ai.config.quotaExceeded')}</p>
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mt-0.5 break-words">
            {notice.message}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                // 携带组织 ID 跳转到组织管理页并自动定位到该组织订阅面板
                const target = notice.orgId
                  ? `/organizations?org=${notice.orgId}`
                  : '/organizations'
                window.location.href = target
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-warning-500 text-white hover:bg-warning-600 transition-colors"
            >
              去升级 <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={dismiss}
              className="px-2 py-1.5 text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-700"
            >
              关闭
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 p-1 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hover:text-neutral-700 rounded"
          aria-label="关闭提示"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}