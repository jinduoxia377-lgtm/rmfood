import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { whitelistApi, type WhitelistStatusResult } from '@/api/whitelist'
import { useCountdown, formatCountdown } from '../hooks/useCountdown'

interface ReviewStatusCardProps {
  /** 状态查询 token（申请成功时返回，仅返回一次） */
  token?: string | null
  /** 提交成功后本地暂存的申请 ID（无 token 时也可展示审核中） */
  applicationId?: number | null
  /** 邮箱验证通过后服务端返回的审核截止时间 */
  reviewDeadline?: string | null
  serverTime?: string | null
  onBackToLogin: () => void
}

/**
 * 审核结果卡：审核中 / 通过 / 拒绝 / 过期。
 * 审核中展示「预计审核截止」倒计时；拒绝后展示 7 天冷却倒计时。
 */
export function ReviewStatusCard({ token, applicationId, reviewDeadline, serverTime, onBackToLogin }: ReviewStatusCardProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<WhitelistStatusResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let cancelled = false
    whitelistApi
      .getStatus(token)
      .then((data) => {
        if (!cancelled) setStatus(data)
      })
      .catch(() => {
        if (!cancelled) setError(t('pages.whitelist.errors.unknown'))
      })
    return () => {
      cancelled = true
    }
  }, [token, t])

  // 仅当存在 token 且尚未取得结果/未出错时视为加载中（避免在 effect 内同步 setState）
  const loading = !!token && !status && !error

  const reviewCd = useCountdown(status?.review_deadline ?? reviewDeadline, status?.server_time ?? serverTime)
  const cooldownCd = useCountdown(status?.cooldown_until ?? null, status?.server_time ?? serverTime)

  if (loading) {
    return (
      <Card className="whitelist-card">
        <div className="whitelist-card-body" style={{ alignItems: 'center' }}>
          <span className="whitelist-result-icon whitelist-result-info">…</span>
          <p className="whitelist-result-desc">{t('pages.whitelist.status.reviewing')}</p>
        </div>
      </Card>
    )
  }

  const currentStatus = status?.status ?? 'pending'
  const isApproved = currentStatus === 'approved'
  const isRejected = currentStatus === 'rejected'
  const isExpired = currentStatus === 'expired'

  return (
    <Card className="whitelist-card">
      <div className="whitelist-card-body">
        <div
          className={`whitelist-result-icon ${isApproved ? 'whitelist-result-ok' : isRejected || isExpired ? 'whitelist-result-error' : 'whitelist-result-info'}`}
          aria-hidden="true"
        >
          {isApproved ? '✓' : isRejected ? '✕' : isExpired ? '!' : '⏳'}
        </div>
        <h2 className="whitelist-result-title">
          {isApproved
            ? t('pages.whitelist.status.approved')
            : isRejected
              ? t('pages.whitelist.status.rejected')
              : isExpired
                ? t('pages.whitelist.status.expired')
                : t('pages.whitelist.status.reviewing')}
        </h2>

        {isRejected && status?.reject_reason && (
          <p className="whitelist-result-desc">
            {t('pages.whitelist.status.rejectedReason')}: {status.reject_reason}
          </p>
        )}

        {!isApproved && !isRejected && !isExpired && reviewCd && !reviewCd.expired && (
          <div className="whitelist-window-countdown">
            <span className="whitelist-window-label">{t('pages.whitelist.success.reviewDeadline')}</span>
            <div className="whitelist-countdown-ring" aria-hidden="true">
              <span className="whitelist-countdown-clock">{formatCountdown(reviewCd)}</span>
            </div>
          </div>
        )}

        {isRejected && cooldownCd && !cooldownCd.expired && (
          <p className="whitelist-result-desc">
            {t('pages.whitelist.status.cooldownHint', { days: Math.max(1, Math.ceil(cooldownCd.totalMs / 86400000)) })}
          </p>
        )}

        {error && (
          <div className="whitelist-alert whitelist-alert-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        {applicationId != null && (
          <div className="whitelist-meta-row">
            <span>{t('pages.whitelist.success.requestId')}</span>
            <strong>#{applicationId}</strong>
          </div>
        )}

        <div className="whitelist-actions" style={{ justifyContent: 'center' }}>
          <button type="button" className="whitelist-btn-outline" onClick={onBackToLogin}>
            {t('pages.whitelist.backToLogin')}
          </button>
        </div>
      </div>
    </Card>
  )
}