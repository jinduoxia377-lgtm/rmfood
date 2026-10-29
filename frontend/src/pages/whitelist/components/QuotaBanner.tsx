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
 */
export default function QuotaBanner() {
  const { t } = useTranslation()
  const [quota, setQuota] = useState<WhitelistQuotaResult | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    whitelistApi
      .getQuota()
      .then((data) => {
        if (!cancelled) setQuota(data)
      })
      .catch(() => {
        // fail-open：配额端点不可用时隐藏横幅（不显示虚假数据）
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
