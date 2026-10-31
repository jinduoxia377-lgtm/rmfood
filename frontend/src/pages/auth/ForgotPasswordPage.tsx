/**
 * RMFOOD — 找回密码页面 (莱茵分子 · Rhine Molecular)
 *
 * 主题系统设计规范对齐版 v5.0 — 与登录页同级的"莱茵分子"专业设计系统
 *
 * 设计基准 (frontend/design-system/DESIGN.md + RMFOOD-主题系统设计规范.md
 *          + 登录页 LoginPage.tsx / LoginPage.css v5.0):
 * ── 桌面端 (≥1024px) 双栏布局:
 *    左栏 = 品牌叙事面板 (Logo + 主张 + 三大支柱: 基因组学/蛋白质组学/人工智能)
 *    右栏 = 找回密码卡片 (440px 主内容宽度, 邮箱表单/成功提示/安全说明)
 * ── 移动端 (<1024px): 品牌条 + 单卡片全宽, 支柱区收起
 * ── 所有颜色/间距/圆角/阴影/字号全部对接全局语义令牌 (--color-*, --text-*,
 *    --bg-*, --space-*, --radius-*, --shadow-*), Light/Dark 双模式自动适配
 * ── 字号基线 (对齐主题令牌 --text-*): 卡片标题 22px (h4, 卡片标题级),
 *    副标题 14px (body-sm), 正文 15px (body), 注释 12px (caption)
 * ── WCAG 2.1 AA: 44×44 触控目标、完整 ARIA、skip link、键盘可达
 * ── 交互: 输入聚焦环、按钮涟漪、卡片入场动画 (尊重 prefers-reduced-motion)
 * ── 功能: 邮箱必填/格式校验、authApi.forgotPassword 调用、成功态 + 60s 重发冷却
 */
import {
  useState, useCallback, useRef, useEffect,
  type FC, type FormEvent, type ChangeEvent,
  type FocusEvent, type MouseEvent as RMouseEvent,
  type CSSProperties,
} from 'react'
import { Link } from 'react-router-dom'
import {
  Mail, AlertCircle, CheckCircle2,
  Shield, Dna, BoxSelect, BrainCircuit,
  ArrowLeft, type LucideIcon,
} from 'lucide-react'
import { RHINE_BRAND_CONFIG, RHINE_FORGOT_CONFIG } from '@/config'
import { authApi } from '@/api/auth'
import './ForgotPasswordPage.css'

/* ═══════════════════════════════════════════════════════════════
   Brand Panel — 桌面端左侧品牌叙事区 (≥1024px)
   Logo + 主张 + 三大支柱 (基因组学 / 蛋白质组学 / 人工智能)
   与登录页完全一致的品牌叙事面板
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
      {/* 背景纹理层 — 点阵网格 + 径向光晕, 与登录页同规格 */}
      <div className="rhine-brand-panel-bg" aria-hidden="true" />

      <div className="rhine-brand-panel-inner">
        {/* ── 品牌标识 ── */}
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

        {/* ── 主张 ── */}
        <div className="rhine-brand-claim">
          <p className="rhine-brand-tagline">{RHINE_BRAND_CONFIG.tagline}</p>
          <h1 className="rhine-brand-headline">{RHINE_BRAND_CONFIG.description}</h1>
        </div>

        {/* ── 三大支柱 ── */}
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

        {/* ── 底部版权 ── */}
        <p className="rhine-brand-copyright">{RHINE_BRAND_CONFIG.copyright}</p>
      </div>
    </aside>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function ForgotPasswordPage() {
  const msg = RHINE_FORGOT_CONFIG.messages
  const COOLDOWN_SECONDS = RHINE_FORGOT_CONFIG.resendCooldownSeconds

  const emailRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [emailErr, setEmailErr] = useState('')
  /* 重发冷却倒计时 (秒) — 成功后进入 60s 冷却期 */
  const [cooldown, setCooldown] = useState(0)

  /* ── 冷却倒计时: 每秒递减, 归零后恢复可发送 ── */
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => (s > 1 ? s - 1 : 0)), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  /* ── Validation ── */
  const validateEmail = useCallback((v: string) => {
    if (!v.trim()) return msg.errorEmpty
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return msg.errorInvalid
    return ''
  }, [msg])

  /* ── Handlers ── */
  const handleEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    if (emailErr) setEmailErr('')
  }, [emailErr])

  const handleEmailBlur = useCallback((_: FocusEvent<HTMLInputElement>) => {
    void _
    setEmailErr(validateEmail(email))
  }, [email, validateEmail])

  /* ── 发送邮件核心 (表单提交 & 重发共用) ── */
  const performSend = useCallback(async (target: string) => {
    setLoading(true)
    setError('')
    try {
      await authApi.forgotPassword(target)
      setSuccess(true)
      setCooldown(COOLDOWN_SECONDS)
    } catch {
      setError(msg.errorSend)
    } finally {
      setLoading(false)
    }
  }, [msg, COOLDOWN_SECONDS])

  /* ── Submit ── */
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const ee = validateEmail(email)
    setEmailErr(ee)
    if (ee) { emailRef.current?.focus(); return }
    await performSend(email.trim())
  }, [email, validateEmail, performSend])

  /* ── Resend ── */
  const handleResend = useCallback(async () => {
    if (cooldown > 0) return
    await performSend(email.trim())
  }, [email, cooldown, performSend])

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

  const resendInLabel = msg.resendIn.replace('{seconds}', String(cooldown))

  /* ═════════════════════════════════════════════════════════════
     Render
     ═════════════════════════════════════════════════════════════ */
  return (
    <div className="rhine-page-root">
      <a href="#rhine-forgot-form" className="rhine-skip-link">跳转到找回密码表单</a>

      <div className="forgot-page" role="main" aria-label="莱茵分子找回密码页面">
        {/* 背景层 — 与登录页同基准: bg-grid 点阵 + var(--bg-canvas) */}
        <div className="rhine-bg-layer" aria-hidden="true" />

        {/* 品牌叙事面板 (桌面端) — 移动端收起, 由下方品牌条承接 */}
        <BrandPanel />

        {/* 移动端品牌条 — <1024px 时页面唯一的 h1, 保证标题层级完整 */}
        <div className="rhine-mobile-brand">
          <div className="rhine-mobile-logo">
            <div className="rhine-mobile-logo-icon" aria-hidden="true"><Shield size={17} /></div>
            <h1 className="rhine-mobile-logo-text">{RHINE_BRAND_CONFIG.name}</h1>
          </div>
        </div>

        {/* 找回密码表单面板 */}
        <div className="rhine-form-panel">
          <div className="rhine-form-content">
            <div id="rhine-forgot-form" className="rhine-card">

              {/* 卡片头部 — 返回登录链接 + 标题 (h4 级 22px) + 副标题 (body-sm 14px) */}
              <div className="rhine-card-header">
                <Link to="/login" className="rhine-back-link" aria-label={msg.backToLogin}>
                  <ArrowLeft size={18} aria-hidden="true" />
                </Link>
                <h2>{msg.title}</h2>
                <p>{msg.subtitle}</p>
              </div>

              {/* 错误提示区 — 表单提交/重发失败时出现 */}
              {error && (
                <div className="rhine-alert rhine-alert-error" role="alert">
                  <AlertCircle size={16} className="rhine-alert-icon" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {success ? (
                /* ── 成功态: 成功提示块 + 重发链接 (冷却期禁用) ── */
                <div className="rhine-success-state">
                  <div className="rhine-alert rhine-alert-success" role="status" aria-live="polite">
                    <CheckCircle2 size={16} className="rhine-alert-icon" aria-hidden="true" />
                    <div className="rhine-alert-body">
                      <p className="rhine-alert-title">{msg.successTitle}</p>
                      <p className="rhine-alert-desc">{msg.successBody}</p>
                    </div>
                  </div>

                  <div className="rhine-resend-row">
                    <button
                      type="button"
                      className="rhine-forgot-link"
                      disabled={cooldown > 0}
                      onClick={handleResend}
                      aria-label={cooldown > 0 ? resendInLabel : msg.resend}
                    >
                      {cooldown > 0 ? (
                        /* 倒计时文案对辅助技术隐藏 — 禁用态承载"等待"语义, aria-label 提供完整可读文本 */
                        <span aria-hidden="true">{resendInLabel}</span>
                      ) : (
                        <span>{msg.resend}</span>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── 表单 ── */
                <form onSubmit={handleSubmit} noValidate aria-label="找回密码表单">
                  <div className="rhine-form-group">
                    <label htmlFor="rhine-forgot-email" className="rhine-label">{msg.emailLabel}</label>
                    <div className="rhine-input-wrap">
                      <Mail size={18} className="rhine-input-icon" aria-hidden="true" />
                      <input
                        ref={emailRef}
                        id="rhine-forgot-email"
                        type="email"
                        className={`rhine-input${email ? ' filled' : ''}${emailErr ? ' error' : ''}`}
                        value={email}
                        onChange={handleEmailChange}
                        onBlur={handleEmailBlur}
                        placeholder={msg.emailPlaceholder}
                        autoComplete="email"
                        autoFocus
                        aria-required="true"
                        aria-invalid={!!emailErr}
                        aria-describedby={emailErr ? 'rhine-forgot-email-err' : undefined}
                      />
                    </div>
                    {emailErr && (
                      <p id="rhine-forgot-email-err" className="rhine-error-text" role="alert">{emailErr}</p>
                    )}
                  </div>

                  {/* 主提交按钮 — 加载/冷却期内禁用 */}
                  <button
                    type="submit"
                    className="rhine-submit-btn"
                    disabled={loading || cooldown > 0}
                    onClick={handleBtnClick}
                    aria-label={loading ? msg.sending : msg.submitButton}
                    aria-busy={loading}
                  >
                    {loading ? (
                      <span className="rhine-btn-content">
                        <span className="rhine-spinner" aria-hidden="true" />
                        <span>{msg.sending}</span>
                      </span>
                    ) : (
                      <span className="rhine-btn-content">
                        <span>{msg.submitButton}</span>
                      </span>
                    )}
                  </button>
                </form>
              )}

              {/* 表单下方 — 返回登录链接 + 安全提示 + 页脚 */}
              <div className="rhine-forgot-back">
                <Link to="/login" className="rhine-forgot-link">{msg.backToLogin}</Link>
              </div>

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
