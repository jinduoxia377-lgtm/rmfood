import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { whitelistApi, type WhitelistQuotaResult } from '@/api/whitelist'

/**
 * 白名单剩余名额横幅（公开，申请页展示）。
 *
 * 数据来源：GET /auth/whitelist/quota（公开端点，无需登录）。
 *   → 成功：显示「剩余名额：{remaining} / {total}」。
 *   → 失败（后端尚未实现 / 网络异常 / 404）：渲染 null（fail-open），
 *     不阻断申请流程、不显示虚假数据。后端配额端点实现后自动显示真实名额。
 *
 * P2-8：通过可选 onRemainingChange 把剩余名额回传给父组件（remaining=0 → 禁用提交）。
 *   成功时回调 remaining；失败时回调 null（表示不可用，不禁用）。
 */
interface QuotaBannerProps {
  /** 剩余名额变化回调（null=配额端点不可用/未加载）。可选，兼容既有调用点。 */
  onRemainingChange?: (remaining: number | null) => void
}

export default function QuotaBanner({ onRemainingChange }: QuotaBannerProps) {
  const { t } = useTranslation()
  const [quota, setQuota] = useState<WhitelistQuotaResult | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    whitelistApi
      .getQuota()
      .then((data) => {
        if (!cancelled) {
          setQuota(data)
          onRemainingChange?.(data.remaining)
        }
      })
      .catch(() => {
        // fail-open：配额端点不可用时隐藏横幅（不显示虚假数据）
        if (!cancelled) {
          setFailed(true)
          onRemainingChange?.(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [onRemainingChange])

  // 后端配额端点未实现 / 请求失败 → 隐藏（不渲染占位虚假数字）
  if (failed) return null

  return (
    <div className="whitelist-quota-banner" role="status">
      {quota ? (
        <>
          <span className="whitelist-quota-label">{t('pages.whitelist.quota.label')}</span>
          <strong className="whitelist-quota-value">
            {t('pages.whitelist.quota.value', { remaining: quota.remaining, total: quota.total })}
          </strong>
        </>
      ) : (
        <span className="whitelist-quota-label">{t('pages.whitelist.quota.loading')}</span>
      )}
    </div>
  )
}
