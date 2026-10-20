import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/Card'
import { whitelistApi } from '@/api/whitelist'

export interface ApplyFormValues {
  email: string
  fullName?: string
  organization?: string
  reason?: string
  captchaId: string
  captchaAnswer: string
}

interface ApplyFormCardProps {
  submitting: boolean
  error: string | null
  onSubmit: (values: ApplyFormValues) => void
}

/**
 * 单页申请表单（人机验证码 + 邮箱必填 + 姓名/单位/申请理由选填 + 隐私同意）。
 * 校验错误使用 aria-invalid + aria-describedby（对齐登录页先例）。
 */
export function ApplyFormCard({ submitting, error, onSubmit }: ApplyFormCardProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [organization, setOrganization] = useState('')
  const [reason, setReason] = useState('')
  const [consent, setConsent] = useState(false)
  const [emailErr, setEmailErr] = useState('')
  const [consentErr, setConsentErr] = useState('')

  // ── 人机验证码 ──
  const [captchaId, setCaptchaId] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaAnswer, setCaptchaAnswer] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(true)
  const [captchaErr, setCaptchaErr] = useState('')

  const loadCaptcha = async () => {
    try {
      const data = await whitelistApi.getCaptcha()
      setCaptchaId(data.captcha_id)
      setCaptchaImage(data.image_base64)
      setCaptchaErr('')
      setCaptchaAnswer('')
    } catch {
      setCaptchaErr(t('pages.whitelist.errors.network'))
    } finally {
      setCaptchaLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCaptcha()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    let valid = true
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailErr(t('pages.whitelist.form.emailRequired'))
      valid = false
    } else {
      setEmailErr('')
    }
    if (!captchaAnswer.trim()) {
      setCaptchaErr(t('pages.whitelist.form.captchaRequired'))
      valid = false
    } else if (captchaErr !== t('pages.whitelist.form.captchaRequired')) {
      setCaptchaErr('')
    }
    if (!consent) {
      setConsentErr(t('pages.whitelist.form.consentRequired'))
      valid = false
    } else {
      setConsentErr('')
    }
    if (!valid) return
    onSubmit({
      email: trimmed,
      fullName: fullName.trim() || undefined,
      organization: organization.trim() || undefined,
      reason: reason.trim() || undefined,
      captchaId,
      captchaAnswer: captchaAnswer.trim(),
    })
  }

  return (
    <Card className="whitelist-card">
      <div className="whitelist-card-body">
        <h2 className="whitelist-result-title">{t('pages.whitelist.pageTitle')}</h2>

        {error && (
          <div className="whitelist-alert whitelist-alert-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="whitelist-card-body" style={{ padding: 0 }}>
            {/* 人机验证 */}
            <div className="whitelist-form-group">
              <label htmlFor="wl-captcha" className="whitelist-label">
                {t('pages.whitelist.form.captcha')} <span className="whitelist-label-opt">*</span>
              </label>
              <div className="whitelist-captcha-row">
                {captchaLoading ? (
                  <span className="whitelist-error-text">{t('pages.whitelist.form.captchaLoading')}</span>
                ) : captchaImage ? (
                  <>
                    <img
                      src={captchaImage}
                      alt={t('pages.whitelist.form.captcha')}
                      className="whitelist-captcha-img"
                      style={{ width: 130, height: 46, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}
                    />
                    <button
                      type="button"
                      className="whitelist-btn-outline"
                      onClick={() => { setCaptchaLoading(true); void loadCaptcha() }}
                      disabled={submitting}
                      aria-label={t('pages.whitelist.form.captchaRefresh')}
                    >
                      {t('pages.whitelist.form.captchaRefresh')}
                    </button>
                  </>
                ) : (
                  <span className="whitelist-error-text">{captchaErr}</span>
                )}
              </div>
              <input
                id="wl-captcha"
                type="text"
                autoComplete="off"
                maxLength={8}
                className={`whitelist-input${captchaErr && captchaErr === t('pages.whitelist.form.captchaRequired') ? ' error' : ''}`}
                value={captchaAnswer}
                onChange={(e) => { setCaptchaAnswer(e.target.value); if (captchaErr === t('pages.whitelist.form.captchaRequired')) setCaptchaErr('') }}
                placeholder={t('pages.whitelist.form.captchaPlaceholder')}
                aria-invalid={!!captchaErr}
                aria-describedby={captchaErr ? 'wl-captcha-err' : undefined}
                disabled={submitting || captchaLoading}
              />
              {captchaErr && captchaErr === t('pages.whitelist.form.captchaRequired') && (
                <p id="wl-captcha-err" className="whitelist-error-text" role="alert">{captchaErr}</p>
              )}
            </div>

            <div className="whitelist-form-group">
              <label htmlFor="wl-email" className="whitelist-label">
                {t('pages.whitelist.form.email')} <span className="whitelist-label-opt">*</span>
              </label>
              <input
                id="wl-email"
                type="email"
                autoComplete="email"
                className={`whitelist-input${emailErr ? ' error' : ''}`}
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr('') }}
                placeholder={t('pages.whitelist.form.emailPlaceholder')}
                aria-required="true"
                aria-invalid={!!emailErr}
                aria-describedby={emailErr ? 'wl-email-err' : undefined}
                disabled={submitting}
              />
              {emailErr && <p id="wl-email-err" className="whitelist-error-text" role="alert">{emailErr}</p>}
            </div>

            <div className="whitelist-form-group">
              <label htmlFor="wl-name" className="whitelist-label">
                {t('pages.whitelist.form.fullName')}
              </label>
              <input
                id="wl-name"
                type="text"
                autoComplete="name"
                className="whitelist-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('pages.whitelist.form.fullNamePlaceholder')}
                disabled={submitting}
              />
            </div>

            <div className="whitelist-form-group">
              <label htmlFor="wl-org" className="whitelist-label">
                {t('pages.whitelist.form.organization')}
              </label>
              <input
                id="wl-org"
                type="text"
                autoComplete="organization"
                className="whitelist-input"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder={t('pages.whitelist.form.organizationPlaceholder')}
                disabled={submitting}
              />
            </div>

            <div className="whitelist-form-group">
              <label htmlFor="wl-reason" className="whitelist-label">
                {t('pages.whitelist.form.reason')}
              </label>
              <textarea
                id="wl-reason"
                className="whitelist-input"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('pages.whitelist.form.reasonPlaceholder')}
                disabled={submitting}
              />
            </div>

            <div className="whitelist-consent">
              <input
                id="wl-consent"
                type="checkbox"
                checked={consent}
                onChange={(e) => { setConsent(e.target.checked); if (consentErr) setConsentErr('') }}
                aria-invalid={!!consentErr}
                aria-describedby={consentErr ? 'wl-consent-err' : undefined}
                disabled={submitting}
              />
              <label htmlFor="wl-consent">{t('pages.whitelist.form.consent')}</label>
            </div>
            {consentErr && <p id="wl-consent-err" className="whitelist-error-text" role="alert">{consentErr}</p>}

            <div className="whitelist-actions">
              <button type="submit" className="whitelist-btn-primary" disabled={submitting} aria-busy={submitting}>
                {submitting ? t('pages.whitelist.form.submitting') : t('pages.whitelist.form.submit')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Card>
  )
}