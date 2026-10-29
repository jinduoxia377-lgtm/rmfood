import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { whitelistApi, type WhitelistApplyResult } from '@/api/whitelist'
import QuotaBanner from './components/QuotaBanner'
import { WindowCountdown } from './components/WindowCountdown'
import { ApplyFormCard, type ApplyFormValues } from './components/ApplyFormCard'
import { VerifyCodeCard } from './components/VerifyCodeCard'
import { ReviewStatusCard } from './components/ReviewStatusCard'
import { StatusLookupSection } from './components/StatusLookupSection'
import './whitelist.css'

/** 申请窗口截止时间：优先读环境变量（M4 上线时由运维配置），未配置时隐藏 Hero 倒计时 */
const APPLY_WINDOW_END: string | null = (import.meta.env.VITE_WHITELIST_WINDOW_END as string | undefined) ?? null

type Step = 'apply' | 'verify' | 'result'

interface PersistedState {
  step: Step
  applicationId: number | null
  statusToken: string | null
  reviewDeadline: string | null
  serverTime: string | null
  email: string
  devVerifyCode: string | null
}

const STORAGE_KEY = 'rmfood_whitelist_apply'

function loadPersisted(): PersistedState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (parsed && parsed.step) return parsed
  } catch {
    /* ignore */
  }
  return null
}

function persist(state: PersistedState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function clearPersisted() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function StepIcon({ done, active, children }: { done?: boolean; active?: boolean; children: ReactNode }) {
  return (
    <span className={`whitelist-step ${active ? 'whitelist-step-active' : ''} ${done ? 'whitelist-step-done' : ''}`}>
      {done ? '✓' : active ? '●' : '○'} {children}
    </span>
  )
}

export default function WhitelistApplyPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const lang = useMemo(() => {
    const l = i18n.language ?? 'zh-CN'
    if (l.startsWith('de')) return 'de-DE'
    if (l.startsWith('en')) return 'en-US'
    return 'zh-CN'
  }, [i18n.language])

  const [state, setState] = useState<PersistedState>(() => {
    const persisted = loadPersisted()
    if (persisted) return persisted
    const token = searchParams.get('token')
    if (token) {
      return { step: 'result', applicationId: null, statusToken: token, reviewDeadline: null, serverTime: null, email: '', devVerifyCode: null }
    }
    return { step: 'apply', applicationId: null, statusToken: null, reviewDeadline: null, serverTime: null, email: '', devVerifyCode: null }
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    persist(state)
  }, [state])

  const handleApplySubmit = async (values: ApplyFormValues) => {
    setSubmitting(true)
    setError('')
    try {
      const result: WhitelistApplyResult = await whitelistApi.apply({
        email: values.email,
        fullName: values.fullName,
        organization: values.organization,
        reason: values.reason,
        source: 'whitelist_page',
        lang,
        captchaId: values.captchaId,
        captchaAnswer: values.captchaAnswer,
      })
      setState((prev) => ({
        ...prev,
        step: 'verify',
        applicationId: result.request_id,
        statusToken: result.status_token,
        email: values.email,
        serverTime: result.server_time,
        devVerifyCode: result.dev_verify_code ?? null,
      }))
    } catch (err) {
      setError(extractErrorMessage(err, t))
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerified = ({ reviewDeadline, serverTime }: { reviewDeadline: string | null; serverTime: string }) => {
    setState((prev) => ({
      ...prev,
      step: 'result',
      reviewDeadline,
      serverTime,
    }))
    setError('')
  }

  const handleBackToLogin = () => {
    clearPersisted()
    navigate('/login')
  }

  const currentStepIndex = state.step === 'apply' ? 0 : state.step === 'verify' ? 1 : 2

  return (
    <div className="whitelist-page-root">
      <div className="whitelist-container">
        {/* 顶部返回登录 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="whitelist-btn-outline" onClick={handleBackToLogin}>
            ← {t('pages.whitelist.backToLogin')}
          </button>
        </div>

        {/* Hero 区 */}
        <header className="whitelist-hero">
          <h1>{t('pages.whitelist.pageTitle')}</h1>
          <p>{t('pages.whitelist.pageSubtitle', { date: APPLY_WINDOW_END ? new Date(APPLY_WINDOW_END).toLocaleString(lang) : '—' })}</p>
          <WindowCountdown deadline={APPLY_WINDOW_END} serverTime={state.serverTime} />
        </header>

        {/* 本轮剩余名额横幅（数据源 GET /auth/whitelist/quota，后端未实现时隐藏） */}
        <QuotaBanner />

        {/* 步骤条 */}
        <nav className="whitelist-stepper" aria-label="whitelist steps">
          <StepIcon active={currentStepIndex === 0} done={currentStepIndex > 0}>
            {t('pages.whitelist.form.submit')}
          </StepIcon>
          <span className="whitelist-step-sep" aria-hidden="true" />
          <StepIcon active={currentStepIndex === 1} done={currentStepIndex > 1}>
            {t('pages.whitelist.verify.title')}
          </StepIcon>
          <span className="whitelist-step-sep" aria-hidden="true" />
          <StepIcon active={currentStepIndex === 2}>{t('pages.whitelist.success.reviewing')}</StepIcon>
        </nav>

        {/* 主体 */}
        <main style={{ maxWidth: 560, width: '100%', margin: '0 auto' }}>
          {state.step === 'apply' && (
            <ApplyFormCard submitting={submitting} error={error} onSubmit={handleApplySubmit} />
          )}

          {state.step === 'verify' && state.applicationId != null && (
            <VerifyCodeCard
              email={state.email}
              requestId={state.applicationId}
              lang={lang}
              onVerified={handleVerified}
              onError={(msg) => setError(msg)}
            />
          )}

          {state.step === 'result' && (
            <>
              <ReviewStatusCard
                token={state.statusToken}
                applicationId={state.applicationId}
                reviewDeadline={state.reviewDeadline}
                serverTime={state.serverTime}
                onBackToLogin={handleBackToLogin}
              />
              {error && (
                <div className="whitelist-alert whitelist-alert-error" role="alert" style={{ marginTop: 12 }}>
                  <span>{error}</span>
                </div>
              )}
            </>
          )}

          {/* 状态查询折叠区 */}
          <StatusLookupSection />
        </main>
      </div>
    </div>
  )
}

/** 将 axios 错误响应映射为用户可读文案（429/409/网络异常） */
function extractErrorMessage(err: unknown, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const anyErr = err as { response?: { data?: { detail?: { code?: string; message?: string; retry_after?: number } } } }
  const detail = anyErr?.response?.data?.detail
  if (detail) {
    if (detail.code === 'EMAIL_REGISTERED') return t('pages.whitelist.errors.alreadyRegistered')
    if (detail.code === 'ALREADY_APPLIED') return t('pages.whitelist.errors.alreadyApplied')
    if (detail.code === 'RATE_LIMITED' || detail.code === 'COOLDOWN') {
      return t('pages.whitelist.errors.rateLimited', { seconds: detail.retry_after ?? 60 })
    }
    return detail.message ?? t('pages.whitelist.errors.unknown')
  }
  return t('pages.whitelist.errors.network')
}