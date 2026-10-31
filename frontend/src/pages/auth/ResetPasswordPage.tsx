/**
 * RMFOOD — 重置密码页面 (莱茵分子 · Rhine Molecular)
 *
 * 主题系统设计规范对齐版 v5.0 — 与找回密码/登录页同级的"莱茵分子"专业设计系统
 *
 * 设计基准 (frontend/design-system/DESIGN.md + RMFOOD-主题系统设计规范.md
 *          + ForgotPasswordPage.tsx / LoginPage.tsx v5.0):
 * ── 桌面端 (≥1024px) 双栏布局:
 *    左栏 = 品牌叙事面板 (Logo + 主张 + 三大支柱: 基因组学/蛋白质组学/人工智能)
 *    右栏 = 重置密码卡片 (440px 主内容宽度, 新密码/确认密码 + 强度条)
 * ── 移动端 (<1024px): 品牌条 + 单卡片全宽, 支柱区收起
 * ── 所有颜色/间距/圆角/阴影/字号全部对接全局语义令牌 (--color-*, --text-*,
 *    --bg-*, --space-*, --radius-*, --shadow-*), Light/Dark 双模式自动适配
 * ── 字号基线 (对齐主题令牌 --text-*): 卡片标题 22px (h4), 副标题 14px (body-sm)
 * ── WCAG 2.1 AA: 44×44 触控目标、完整 ARIA、skip link、键盘可达
 * ── 功能: token 无值 → 无效态; 新密码复杂度校验 (镜像后端, 生产级始终启用);
 *    authApi.resetPassword(token, newPassword) 调用; 错误按 status 映射;
 *    成功态 + 去登录; 密码显示/隐藏切换; 强度条 (5 级)
 */
import {
  useState, useCallback, useRef,
  type FC, type FormEvent, type ChangeEvent,
  type FocusEvent, type MouseEvent as RMouseEvent,
  type CSSProperties,
} from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Eye, EyeOff, Lock, AlertCircle, CheckCircle2,
  Shield, Dna, BoxSelect, BrainCircuit,
  ArrowLeft, type LucideIcon,
} from 'lucide-react'
import { RHINE_BRAND_CONFIG, RHINE_LOGIN_CONFIG, RHINE_RESET_CONFIG } from '@/config'
import { authApi } from '@/api/auth'
import './ResetPasswordPage.css'

/* ═══════════════════════════════════════════════════════════════
   Password Strength — 强度评分 (0-4, 5 档)
   规则: length<8 → 0; 否则 length>=8 +1 / has_upper +1 / has_lower +1 /
   has_digit +1 / length>=12 +1, 取 cap 4
   ═══════════════════════════════════════════════════════════════ */
function getPasswordScore(pw: string): number {
  if (!pw) return 0
  if (pw.length < 8) return 0
  let score = 0
  if (pw.length >= 8) score += 1
  if (/[A-Z]/.test(pw)) score += 1
  if (/[a-z]/.test(pw)) score += 1
  if (/\d/.test(pw)) score += 1
  if (pw.length >= 12) score += 1
  return Math.min(score, 4)
}

/* ═══════════════════════════════════════════════════════════════
   Brand Panel — 桌面端左侧品牌叙事区 (≥1024px)
   与找回密码/登录页完全一致的品牌叙事面板
   ═══════════════════════════════════════════════════════════════ */
const PILLAR_ICON_MAP: Record<string, LucideIcon> = {
  Dna: Dna,
  BoxSelect: BoxSelect,
  BrainCircuit: BrainCircuit,
  Leaf: Dna,
  Cpu: BrainCircuit,
  Shield: Shield,
}

const BrandPanel: FC = () => {
  const pillars = RHINE_BRAND_CONFIG.pillars

  return (
    <aside className="rhine-brand-panel" aria-label="品牌介绍">
      <div className="rhine-brand-panel-bg" aria-hidden="true" />

      <div className="rhine-brand-panel-inner">
        <div className="rhine-brand-id">
          <div className="rhine-brand-logo">
            <div className="rhine-brand-logo-mark" aria-hidden="true">
              <Shield size={20} />
            </div>
            <div className="rhine-brand-logo-text">
              <span className="rhine-brand-name">{RHINE_BRAND_CONFIG.name}</span>
              <span className="rhine-brand-name-en">{RHINE_BRAND_CONFIG.nameEn}</span>
            </div>
          </div>
        </div>

        <div className="rhine-brand-claim">
          <p className="rhine-brand-tagline">{RHINE_BRAND_CONFIG.tagline}</p>
          <h1 className="rhine-brand-headline">{RHINE_BRAND_CONFIG.description}</h1>
        </div>

        <ul className="rhine-brand-pillars">
          {pillars.map((p, i) => {
            const Icon = PILLAR_ICON_MAP[p.icon] ?? Shield
            return (
              <li key={p.title} className="rhine-pillar"
                style={{ '--pillar-delay': `${i * 90}ms` } as CSSProperties}>
                <span className="rhine-pillar-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="rhine-pillar-body">
                  <span className="rhine-pillar-title">
                    {p.title}
                    <span className="rhine-pillar-subtitle">{p.subtitle}</span>
                  </span>
                  <span className="rhine-pillar-desc">{p.description}</span>
                </span>
              </li>
            )
          })}
        </ul>

        <p className="rhine-brand-copyright">{RHINE_BRAND_CONFIG.copyright}</p>
      </div>
    </aside>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function ResetPasswordPage() {
  const msg = RHINE_RESET_CONFIG.messages
  const strengthLevels = RHINE_LOGIN_CONFIG.passwordStrength.levels
  const strengthColors = RHINE_LOGIN_CONFIG.passwordStrength.colors

  /* ── token 读取 (邮件重置链接携带) ── */
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const pwRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [pwErr, setPwErr] = useState('')
  const [confirmErr, setConfirmErr] = useState('')

  /* ── 强度条 ── */
  const pwScore = getPasswordScore(newPassword)

  /* ── Validation (镜像后端复杂度要求, 生产级始终启用) ── */
  const validatePassword = useCallback((v: string) => {
    if (!v) return msg.errorEmptyPw
    if (v.length < 8) return msg.errorShortPw
    if (!(/[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v))) return msg.errorComplexPw
    return ''
  }, [msg])

  const validateConfirm = useCallback((v: string) => {
    if (!v) return msg.errorEmptyConfirm
    if (v !== newPassword) return msg.errorMismatch
    return ''
  }, [newPassword, msg])

  /* ── Handlers ── */
  const handlePwChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setNewPassword(e.target.value)
    if (pwErr) setPwErr('')
    if (error) setError('')
  }, [pwErr, error])

  const handlePwBlur = useCallback((_: FocusEvent<HTMLInputElement>) => {
    void _
    setPwErr(validatePassword(newPassword))
  }, [newPassword, validatePassword])

  const handleConfirmChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value)
    if (confirmErr) setConfirmErr('')
    if (error) setError('')
  }, [confirmErr, error])

  const handleConfirmBlur = useCallback((_: FocusEvent<HTMLInputElement>) => {
    void _
    setConfirmErr(validateConfirm(confirmPassword))
  }, [confirmPassword, validateConfirm])

  /* ── 提取后端错误 status/detail (镜像 LoginPage 的错误解析) ── */
  const extractError = useCallback((err: unknown) => {
    const resp = (typeof err === 'object' && err !== null && 'response' in err &&
      typeof (err as Record<string, unknown>).response === 'object' && (err as Record<string, unknown>).response !== null)
      ? (err as { response: { status: number; data?: { detail?: unknown } } }).response
      : null
    const detail = typeof resp?.data?.detail === 'string' ? resp.data.detail : ''
    return { status: resp?.status ?? null, detail }
  }, [])

  /* ── Submit ── */
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const pe = validatePassword(newPassword)
    const ce = validateConfirm(confirmPassword)
    setPwErr(pe)
    setConfirmErr(ce)
    if (pe) { pwRef.current?.focus(); return }
    if (ce) { confirmRef.current?.focus(); return }
    setError('')
    setLoading(true)
    try {
      await authApi.resetPassword(token, newPassword)
      setSuccess(true)
    } catch (err: unknown) {
      const { status, detail } = extractError(err)
      if (status === 401) setError(msg.errorInvalidToken)
      else if (status === 400) setError(detail || msg.errorComplexPw)
      else if (status === 404) setError(msg.errorUserNotFound)
      else if (status === 409) setError(msg.errorConcurrent)
      else setError(msg.errorNetwork)
    } finally {
      setLoading(false)
    }
  }, [newPassword, confirmPassword, token, validatePassword, validateConfirm, extractError, msg])

  /* ── Ripple ── */
  const handleBtnClick = useCallback((e: RMouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget
    const r = document.createElement('span')
    const rect = btn.getBoundingClientRect()
    const s = Math.max(rect.width, rect.height)
    r.className = 'rhine-btn-ripple'
    r.style.width = r.style.height = `${s}px`
    r.style.left = `${e.clientX - rect.left - s / 2}px`
    r.style.top = `${e.clientY - rect.top - s / 2}px`
    btn.appendChild(r)
    r.addEventListener('animationend', () => r.remove())
  }, [])

  /* ═════════════════════════════════════════════════════════════
     Render
     ═════════════════════════════════════════════════════════════ */
  return (
    <div className="rhine-page-root">
      <a href="#rhine-reset-form" className="rhine-skip-link">跳转到重置密码表单</a>

      <div className="reset-page" role="main" aria-label="莱茵分子重置密码页面">
        <div className="rhine-bg-layer" aria-hidden="true" />

        <BrandPanel />

        <div className="rhine-mobile-brand">
          <div className="rhine-mobile-logo">
            <div className="rhine-mobile-logo-icon" aria-hidden="true"><Shield size={17} /></div>
            <h1 className="rhine-mobile-logo-text">{RHINE_BRAND_CONFIG.name}</h1>
          </div>
        </div>

        <div className="rhine-form-panel">
          <div className="rhine-form-content">
            <div id="rhine-reset-form" className="rhine-card">

              {/* 卡片头部 — 返回登录链接 + 标题 (h4 级 22px) + 副标题 (body-sm 14px) */}
              <div className="rhine-card-header">
                <Link to="/login" className="rhine-back-link" aria-label={msg.backToLogin}>
                  <ArrowLeft size={18} aria-hidden="true" />
                </Link>
                <h2>{msg.title}</h2>
                <p>{msg.subtitle}</p>
              </div>

              {/* 错误提示区 — 提交失败时出现 */}
              {error && (
                <div className="rhine-alert rhine-alert-error" role="alert">
                  <AlertCircle size={16} className="rhine-alert-icon" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {!token ? (
                /* ── 无效态: 无 token (链接失效/已使用) ── */
                <div className="rhine-invalid-state" role="alert">
                  <div className="rhine-invalid-icon" aria-hidden="true"><AlertCircle size={20} /></div>
                  <h3 className="rhine-invalid-title">{msg.invalidTokenTitle}</h3>
                  <p className="rhine-invalid-desc">{msg.invalidTokenBody}</p>
                  <Link to="/forgot-password" className="rhine-submit-btn rhine-invalid-reapply">{msg.reapply}</Link>
                  <div className="rhine-invalid-back">
                    <Link to="/login" className="rhine-forgot-link">{msg.backToLogin}</Link>
                  </div>
                </div>
              ) : success ? (
                /* ── 成功态 ── */
                <div className="rhine-success-state">
                  <div className="rhine-alert rhine-alert-success" role="status" aria-live="polite">
                    <CheckCircle2 size={16} className="rhine-alert-icon" aria-hidden="true" />
                    <div className="rhine-alert-body">
                      <p className="rhine-alert-title">{msg.successTitle}</p>
                      <p className="rhine-alert-desc">{msg.successBody}</p>
                    </div>
                  </div>
                  <div className="rhine-resend-row">
                    <Link to="/login" className="rhine-submit-btn rhine-go-login">{msg.goLogin}</Link>
                  </div>
                </div>
              ) : (
                /* ── 表单 ── */
                <form onSubmit={handleSubmit} noValidate aria-label="重置密码表单">
                  {/* 新密码 */}
                  <div className="rhine-form-group">
                    <label htmlFor="rhine-new-password" className="rhine-label">{msg.passwordLabel}</label>
                    <div className="rhine-input-wrap">
                      <Lock size={18} className="rhine-input-icon" aria-hidden="true" />
                      <input
                        ref={pwRef}
                        id="rhine-new-password"
                        type={showPw ? 'text' : 'password'}
                        className={`rhine-input${newPassword ? ' filled' : ''}${pwErr ? ' error' : ''}`}
                        value={newPassword}
                        onChange={handlePwChange}
                        onBlur={handlePwBlur}
                        placeholder={msg.passwordPlaceholder}
                        autoComplete="new-password"
                        autoFocus
                        aria-required="true"
                        aria-invalid={!!pwErr}
                        aria-describedby={pwErr ? 'rhine-new-password-err' : undefined}
                      />
                      <button
                        type="button"
                        className="rhine-password-toggle"
                        onClick={() => setShowPw(!showPw)}
                        aria-label={showPw ? '隐藏密码' : '显示密码'}
                      >
                        {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {pwErr && (
                      <p id="rhine-new-password-err" className="rhine-error-text" role="alert">{pwErr}</p>
                    )}
                    {/* 强度条 — 空密码不显示 */}
                    {newPassword.length > 0 && (
                      <div className="rhine-strength-meter" aria-hidden="true">
                        <div className="rhine-strength-bar">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className={`rhine-strength-seg${i < pwScore ? ' active' : ''}`}
                              style={i < pwScore ? { backgroundColor: strengthColors[pwScore] } : undefined}
                            />
                          ))}
                        </div>
                        <span className="rhine-strength-label">{strengthLevels[pwScore]}</span>
                      </div>
                    )}
                  </div>

                  {/* 确认密码 */}
                  <div className="rhine-form-group">
                    <label htmlFor="rhine-confirm-password" className="rhine-label">{msg.confirmLabel}</label>
                    <div className="rhine-input-wrap">
                      <Lock size={18} className="rhine-input-icon" aria-hidden="true" />
                      <input
                        ref={confirmRef}
                        id="rhine-confirm-password"
                        type={showConfirm ? 'text' : 'password'}
                        className={`rhine-input${confirmPassword ? ' filled' : ''}${confirmErr ? ' error' : ''}`}
                        value={confirmPassword}
                        onChange={handleConfirmChange}
                        onBlur={handleConfirmBlur}
                        placeholder={msg.confirmPlaceholder}
                        autoComplete="new-password"
                        aria-required="true"
                        aria-invalid={!!confirmErr}
                        aria-describedby={confirmErr ? 'rhine-confirm-password-err' : undefined}
                      />
                      <button
                        type="button"
                        className="rhine-password-toggle"
                        onClick={() => setShowConfirm(!showConfirm)}
                        aria-label={showConfirm ? '隐藏确认密码' : '显示确认密码'}
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {confirmErr && (
                      <p id="rhine-confirm-password-err" className="rhine-error-text" role="alert">{confirmErr}</p>
                    )}
                  </div>

                  {/* 主提交按钮 — 加载态禁用 */}
                  <button
                    type="submit"
                    className="rhine-submit-btn"
                    disabled={loading}
                    onClick={handleBtnClick}
                    aria-label={loading ? msg.submitting : msg.submitButton}
                    aria-busy={loading}
                  >
                    {loading ? (
                      <span className="rhine-btn-content">
                        <span className="rhine-spinner" aria-hidden="true" />
                        <span>{msg.submitting}</span>
                      </span>
                    ) : (
                      <span className="rhine-btn-content">
                        <span>{msg.submitButton}</span>
                      </span>
                    )}
                  </button>
                </form>
              )}

              {/* 表单下方 — 返回登录链接 (无效态已有返回登录, 不重复渲染) */}
              {token && (
                <div className="rhine-forgot-back">
                  <Link to="/login" className="rhine-forgot-link">{msg.backToLogin}</Link>
                </div>
              )}

              <div className="rhine-security-note">
                <Shield size={12} aria-hidden="true" /><span>{msg.securityNote}</span>
              </div>

              <div className="rhine-footer">
                <div className="rhine-footer-links">
                  <Link to="/privacy">{msg.privacyPolicy}</Link>
                  <span className="rhine-footer-sep" aria-hidden="true" />
                  <Link to="/terms">{msg.termsOfService}</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
