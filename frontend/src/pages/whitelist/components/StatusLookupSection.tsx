import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { whitelistApi, type WhitelistStatusResult } from '@/api/whitelist'

/**
 * 底部折叠区：输入状态 token 查询申请进度（审核中/通过/拒绝/过期）。
 */
export function StatusLookupSection() {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<WhitelistStatusResult | null>(null)
  const [error, setError] = useState('')

  const handleQuery = async () => {
    if (!token.trim() || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await whitelistApi.getStatus(token.trim())
      setResult(data)
    } catch {
      setError(t('pages.whitelist.lookup.error'))
    } finally {
      setLoading(false)
    }
  }

  const statusText = result
    ? result.status === 'approved'
      ? t('pages.whitelist.status.approved')
      : result.status === 'rejected'
        ? t('pages.whitelist.status.rejected')
        : result.status === 'expired'
          ? t('pages.whitelist.status.expired')
          : t('pages.whitelist.status.reviewing')
    : ''

  return (
    <div className="whitelist-lookup">
      <button type="button" className="whitelist-lookup-toggle" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        ▸ {t('pages.whitelist.lookup.title')}
      </button>
      {expanded && (
        <div className="whitelist-lookup-body">
          <input
            className="whitelist-input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('pages.whitelist.lookup.tokenPlaceholder')}
            aria-label={t('pages.whitelist.lookup.tokenPlaceholder')}
            disabled={loading}
          />
          <button type="button" className="whitelist-btn-outline" onClick={handleQuery} disabled={loading}>
            {t('pages.whitelist.lookup.query')}
          </button>
        </div>
      )}
      {error && (
        <p className="whitelist-error-text" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}
      {result && (
        <div style={{ marginTop: 8 }}>
          <div className="whitelist-meta-row">
            <span>{t('pages.whitelist.success.requestId')}</span>
            <strong>#{result.request_id}</strong>
          </div>
          <div className="whitelist-meta-row">
            <span>{t('pages.whitelist.lookup.title')}</span>
            <strong>{statusText}</strong>
          </div>
        </div>
      )}
    </div>
  )
}