import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { whitelistApi } from '@/api/whitelist'
import { extractWhitelistErrorMessage } from '../errorMapping'

interface VerifyCodeCardProps {
  email: string
  requestId: number
  lang: string
  /** 开发环境（无 SMTP）下由后端返回的明文验证码，用于本地测试 */
  devCode?: string | null
  onVerified: (data: { reviewDeadline: string | null; serverTime: string }) => void
  onError: (message: string) => void
}

/**
 * 邮箱验证码步骤：6 位输入 + 60s 重发冷却。
 * 开发环境后端会返回 devCode，前端展示便于本地测试。
 */
export function VerifyCodeCard({ email, requestId, lang, devCode, onVerified, onError }: VerifyCodeCardProps) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resendIn, setResendIn] = useState(60)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendIn])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (code.length !== 6 || submitting) return
    setSubmitting(true)
    try {
      const data = await whitelistApi.verifyCode(requestId, code)
      onVerified({ reviewDeadline: data.review_deadline, serverTime: data.server_time })
    } catch (err) {
      onError(extractWhitelistErrorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (resendIn > 0 || submitting) return
    setSubmitting(true)
    try {
      await whitelistApi.resendCode(requestId, lang)
      setResendIn(60)
    } catch (err) {
      onError(extractWhitelistErrorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="whitelist-card">
      <div className="whitelist-card-body">
        <h2 className="whitelist-result-title">{t('pages.whitelist.verify.title')}</h2>
        <p className="whitelist-result-desc">
          {t('pages.whitelist.verify.desc', { email })}
        </p>

        {devCode && (
          <div className="whitelist-alert whitelist-alert-success" role="status">
            <span>
              {t('pages.whitelist.verify.devCodeHint')}：<strong style={{ letterSpacing: 4, fontSize: 16 }}>{devCode}</strong>
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="whitelist-form-group">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="whitelist-input"
              style={{ textAlign: 'center', fontSize: 22, letterSpacing: 8 }}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder={t('pages.whitelist.verify.placeholder')}
              aria-label={t('pages.whitelist.verify.placeholder')}
              disabled={submitting}
            />
          </div>

          <div className="whitelist-actions">
            <button type="submit" className="whitelist-btn-primary" disabled={submitting || code.length !== 6} aria-busy={submitting}>
              {submitting ? t('pages.whitelist.verify.verifying') : t('pages.whitelist.verify.verify')}
            </button>
            <button type="button" className="whitelist-btn-outline" disabled={resendIn > 0 || submitting} onClick={handleResend}>
              {resendIn > 0
                ? t('pages.whitelist.verify.resend', { seconds: resendIn })
                : t('pages.whitelist.verify.resendNow')}
            </button>
          </div>
        </form>
      </div>
    </Card>
  )
}