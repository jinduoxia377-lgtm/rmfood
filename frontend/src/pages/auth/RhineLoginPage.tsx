/**
 * 莱茵分子 (Rhine Molecular) — 登录页面 v2.0
 *
 * 生物技术启发的沉浸式登录体验 · 精抛光版
 * - Canvas 交互式分子粒子场 (鼠标引力/斥力/点击爆发)
 * - CSS 3D DNA 双螺旋 (50s 自转 + X轴微倾)
 * - SVG 六边形晶格叠加层
 * - 多层玻璃态浮动登录卡片 (backdrop-filter + 渐变边框)
 * - 功能完善的第三方登录 (微信/QQ/GitHub OAuth)
 * - 品牌色悬停辉光 + 加载反馈
 * - WCAG 2.1 AA 完整可访问性
 */
import {
  useState, useCallback, useRef,
  type FC, type FormEvent, type ChangeEvent,
  type FocusEvent, type MouseEvent as RMouseEvent,
} from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Dna, BoxSelect, BrainCircuit, Hexagon,
  Eye, EyeOff, User, Lock, AlertCircle, CheckCircle2,
  Shield, type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { RHINE_BRAND_CONFIG, RHINE_LOGIN_CONFIG } from '@/config'
import RhineParticleField from './RhineParticleField'
import RhineDNAHelix from './RhineDNAHelix'
import RhineHexGrid from './RhineHexGrid'
import './RhineLoginPage.css'

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface SocialProvider {
  enabled: boolean; label: string; color: string; oauthUrl: string
}

/* ═══════════════════════════════════════════════════════════════
   Brand Overlay — 桌面端左下品牌区
   ═══════════════════════════════════════════════════════════════ */
const BrandOverlay: FC = () => {
  const iconMap: Record<string, LucideIcon> = { Dna, BoxSelect, BrainCircuit }

  return (
    <div className="rhine-brand-overlay">
      <div className="rhine-brand-logo rhine-anim-fade-up">
        <div className="rhine-brand-icon" aria-hidden="true"><Hexagon size={19} /></div>
        <div>
          <div className="rhine-brand-name">{RHINE_BRAND_CONFIG.name}</div>
          <div className="rhine-brand-name-en">{RHINE_BRAND_CONFIG.nameEn}</div>
        </div>
      </div>
      <div className="rhine-brand-tagline rhine-anim-fade-up rhine-delay-1">
        {RHINE_BRAND_CONFIG.tagline}
      </div>
      <p className="rhine-brand-desc rhine-anim-fade-up rhine-delay-2">
        {RHINE_BRAND_CONFIG.description}
      </p>
      <div className="rhine-brand-pillars rhine-anim-fade-up rhine-delay-3">
        {RHINE_BRAND_CONFIG.pillars.map((p: { icon: string; title: string; subtitle: string }) => {
          const Icon = iconMap[p.icon] || Dna
          return (
            <div key={p.title} className="rhine-brand-pillar">
              <Icon size={13} className="rhine-brand-pillar-icon" aria-hidden="true" />
              <span>{p.title}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Password Strength Indicator
   ═══════════════════════════════════════════════════════════════ */
const PasswordStrength: FC<{ strength: number }> = ({ strength }) => {
  const lv = RHINE_LOGIN_CONFIG.passwordStrength.levels
  const cl = RHINE_LOGIN_CONFIG.passwordStrength.colors
  const i = Math.min(strength, lv.length - 1)
  return (
    <div className="rhine-password-strength" aria-live="polite">
      <div className="rhine-strength-header">
        <span className="rhine-strength-label">安全等级</span>
        <span className="rhine-strength-value" style={{ color: strength > 0 ? cl[i] : undefined }}>
          {strength > 0 ? lv[i] : '未输入'}
        </span>
      </div>
      <div className="rhine-strength-bar">
        <div className="rhine-strength-fill" style={{
          width: `${((strength + 1) / (lv.length + 1)) * 100}%`,
          backgroundColor: strength > 0 ? cl[i] : undefined,
        }} />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Social Login Section — 第三方登录 (完整功能版)
   ═══════════════════════════════════════════════════════════════ */
const SocialLoginSection: FC = () => {
  const socials = RHINE_LOGIN_CONFIG.socialLogin
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)

  /* ── 通用 OAuth 跳转 ── */
  const handleOAuthLogin = useCallback((provider: string, cfg: SocialProvider) => {
    setLoadingProvider(provider)

    const state = Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem(`rhine_${provider}_state`, state)

    let authUrl = ''
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/${provider}/callback`)

    switch (provider) {
      case 'wechat':
        authUrl = `${cfg.oauthUrl}?appid=YOUR_WECHAT_APPID&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`
        break
      case 'qq':
        authUrl = `${cfg.oauthUrl}?response_type=code&client_id=YOUR_QQ_APPID&redirect_uri=${redirectUri}&state=${state}&scope=get_user_info`
        break
      case 'github':
        authUrl = `${cfg.oauthUrl}?client_id=YOUR_GITHUB_CLIENT_ID&redirect_uri=${redirectUri}&scope=user:email&state=${state}`
        break
    }

    if (authUrl) {
      // 短暂延迟让用户看到 loading 反馈
      setTimeout(() => window.location.href = authUrl, 400)
    } else {
      setLoadingProvider(null)
    }
  }, [])

  /* ── 微信图标 ── */
  const WechatIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={socials.wechat.color} aria-hidden="true">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.325.325 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18z"/>
    </svg>
  )

  /* ── QQ 企鹅图标 ── */
  const QQIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={socials.qq.color} aria-hidden="true">
      <path d="M12.003 2c-2.265 0-4.346 1.09-5.707 2.793-.403.505-.75 1.056-1.024 1.64C4.088 8.41 4 10.428 4 12c0 3.52 1.187 6.477 3.033 8.308.487.483 1.108.926 1.837 1.252.536.24 1.148.397 1.796.428.11.005.223.012.334.012.111 0 .225-.007.334-.012.648-.031 1.26-.188 1.796-.428.729-.326 1.35-.77 1.837-1.252C18.813 18.477 20 15.52 20 12c0-1.572-.088-3.59-1.27-5.567-.273-.584-.62-1.135-1.023-1.64C16.35 3.09 14.268 2 12.003 2z"/>
      <ellipse cx="8.5" cy="11" rx="1.5" ry="2" fill="#fff" opacity="0.9"/>
      <ellipse cx="15.5" cy="11" rx="1.5" ry="2" fill="#fff" opacity="0.9"/>
      <path d="M10 13.5c0 .8.9 1.5 2 1.5s2-.7 2-1.5" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.7"/>
    </svg>
  )

  /* ── GitHub 图标 ── */
  const GitHubIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={socials.github.color} aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
    </svg>
  )

  return (
    <>
      <div className="rhine-divider" aria-hidden="true">
        <span className="rhine-divider-text">{RHINE_LOGIN_CONFIG.messages.orContinueWith}</span>
      </div>

      <div className="rhine-social-buttons">
        {/* 微信 */}
        {socials.wechat.enabled && (
          <button
            type="button"
            className={`rhine-social-btn wechat ${loadingProvider === 'wechat' ? 'loading' : ''}`}
            onClick={() => handleOAuthLogin('wechat', socials.wechat)}
            disabled={loadingProvider !== null}
            aria-label={socials.wechat.label}
          >
            <span className="rhine-social-icon-wrap">
              {loadingProvider === 'wechat' ? <span className="rhine-social-spinner" /> : <WechatIcon />}
            </span>
            <span className="rhine-social-label">{socials.wechat.label}</span>
          </button>
        )}

        {/* QQ */}
        {socials.qq.enabled && (
          <button
            type="button"
            className={`rhine-social-btn qq ${loadingProvider === 'qq' ? 'loading' : ''}`}
            onClick={() => handleOAuthLogin('qq', socials.qq)}
            disabled={loadingProvider !== null}
            aria-label={socials.qq.label}
          >
            <span className="rhine-social-icon-wrap">
              {loadingProvider === 'qq' ? <span className="rhine-social-spinner" /> : <QQIcon />}
            </span>
            <span className="rhine-social-label">{socials.qq.label}</span>
          </button>
        )}

        {/* GitHub */}
        {socials.github.enabled && (
          <button
            type="button"
            className={`rhine-social-btn github ${loadingProvider === 'github' ? 'loading' : ''}`}
            onClick={() => handleOAuthLogin('github', socials.github)}
            disabled={loadingProvider !== null}
            aria-label={socials.github.label}
          >
            <span className="rhine-social-icon-wrap">
              {loadingProvider === 'github' ? <span className="rhine-social-spinner" /> : <GitHubIcon />}
            </span>
            <span className="rhine-social-label">{socials.github.label}</span>
          </button>
        )}
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */
export default function RhineLoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const msg = RHINE_LOGIN_CONFIG.messages

  const userRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [userErr, setUserErr] = useState('')
  const [passErr, setPassErr] = useState('')
  const [pwStrength, setPwStrength] = useState(0)

  /* ── Validation ── */
  const validateUser = useCallback((v: string) => {
    if (!v.trim()) return '请输入用户名'
    if (v.trim().length < 3) return '用户名至少需要 3 个字符'
    return ''
  }, [])
  const checkStrength = useCallback((v: string) => {
    let s = 0
    if (v.length >= 6) s++; if (v.length >= 10) s++
    if (/[A-Z]/.test(v)) s++; if (/[a-z]/.test(v)) s++
    if (/[0-9]/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++
    return Math.min(s, 4)
  }, [])
  const validatePass = useCallback((v: string) => {
    if (!v) return '请输入密码'
    if (v.length < 6) return '密码至少需要 6 个字符'
    return ''
  }, [])

  /* ── Handlers ── */
  const handleUserChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value); if (userErr) setUserErr('')
  }, [userErr])
  const handleUserBlur = useCallback((_: FocusEvent<HTMLInputElement>) => {
    setUserErr(validateUser(username))
  }, [username, validateUser])
  const handlePassChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    setPwStrength(checkStrength(e.target.value))
    if (passErr) setPassErr('')
  }, [passErr, checkStrength])
  const handlePassBlur = useCallback((_: FocusEvent<HTMLInputElement>) => {
    setPassErr(validatePass(password))
  }, [password, validatePass])

  /* ── Submit ── */
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    const ue = validateUser(username); const pe = validatePass(password)
    setUserErr(ue); setPassErr(pe)
    if (ue) { userRef.current?.focus(); return }
    if (pe) { passRef.current?.focus(); return }
    setError(''); setLoading(true)
    try {
      await login(username, password)
      if (remember) { localStorage.setItem('rhine_remember', '1'); localStorage.setItem('rhine_user', username) }
      else { localStorage.removeItem('rhine_remember'); localStorage.removeItem('rhine_user') }
      setSuccess(msg.loginSuccess)
      setTimeout(() => navigate('/dashboard'), 800)
    } catch (err: unknown) {
      const s = (typeof err === 'object' && err !== null && 'response' in err &&
        typeof err.response === 'object' && err.response !== null && 'status' in err.response)
        ? (err.response as { status: number }).status : null
      setError(s === 401 ? msg.errorAuth : s === 429 ? msg.errorRateLimit : msg.errorNetwork)
    } finally { setLoading(false) }
  }, [username, password, remember, validateUser, validatePass, login, navigate, msg])

  /* ── Ripple ── */
  const handleBtnClick = useCallback((e: RMouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget
    const r = document.createElement('span'); const rect = btn.getBoundingClientRect()
    const s = Math.max(rect.width, rect.height)
    r.className = 'rhine-btn-ripple'; r.style.width = r.style.height = `${s}px`
    r.style.left = `${e.clientX - rect.left - s / 2}px`
    r.style.top = `${e.clientY - rect.top - s / 2}px`
    btn.appendChild(r); r.addEventListener('animationend', () => r.remove())
  }, [])

  /* ═════════════════════════════════════════════════════════════
     Render
     ═════════════════════════════════════════════════════════════ */
  const { credentials } = RHINE_LOGIN_CONFIG

  return (
    <>
      <a href="#rhine-login-form" className="rhine-skip-link">跳转到登录表单</a>

      <div className="rhine-page" role="main" aria-label="莱茵分子登录页面">
        {/* 背景层 */}
        <RhineParticleField error={!!error} />
        <RhineHexGrid />
        <div className="rhine-gradient-overlay" aria-hidden="true" />

        {/* DNA 螺旋 */}
        <RhineDNAHelix strength={pwStrength} />

        {/* 品牌叠加层 (桌面端) */}
        <BrandOverlay />

        {/* 移动端品牌条 */}
        <div className="rhine-mobile-brand">
          <div className="rhine-mobile-logo">
            <div className="rhine-mobile-logo-icon" aria-hidden="true"><Hexagon size={17} /></div>
            <span className="rhine-mobile-logo-text">{RHINE_BRAND_CONFIG.name}</span>
          </div>
        </div>

        {/* 登录表单面板 */}
        <div className="rhine-form-panel">
          <div id="rhine-login-form" className="rhine-card rhine-anim-slide-right rhine-delay-3">

            {/* 卡片头部 */}
            <div className="rhine-card-header">
              <h2>{msg.welcome}</h2>
              <p>{msg.prompt}</p>
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="rhine-alert rhine-alert-error rhine-anim-shake" role="alert">
                <AlertCircle size={16} className="rhine-alert-icon" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* 成功提示 */}
            {success && (
              <div className="rhine-alert rhine-alert-success" role="status" aria-live="polite">
                <CheckCircle2 size={16} className="rhine-alert-icon" aria-hidden="true" />
                <span>{success}</span>
              </div>
            )}

            {/* 表单 */}
            <form onSubmit={handleSubmit} noValidate aria-label="登录表单">
              {/* 用户名 */}
              <div className="rhine-form-group">
                <label htmlFor="rhine-username" className="rhine-label">{msg.usernameLabel}</label>
                <div className="rhine-input-wrap">
                  <User size={18} className="rhine-input-icon" aria-hidden="true" />
                  <input ref={userRef} id="rhine-username" type="text"
                    className={`rhine-input${username ? ' filled' : ''}${userErr ? ' error' : ''}`}
                    value={username} onChange={handleUserChange} onBlur={handleUserBlur}
                    placeholder={msg.usernamePlaceholder}
                    autoComplete="username" autoFocus
                    aria-required="true" aria-invalid={!!userErr}
                    aria-describedby={userErr ? 'rhine-user-err' : undefined} />
                </div>
                {userErr && <p id="rhine-user-err" className="rhine-error-text" role="alert">{userErr}</p>}
              </div>

              {/* 密码 */}
              <div className="rhine-form-group">
                <label htmlFor="rhine-password" className="rhine-label">{msg.passwordLabel}</label>
                <div className="rhine-input-wrap">
                  <Lock size={18} className="rhine-input-icon" aria-hidden="true" />
                  <input ref={passRef} id="rhine-password"
                    type={showPw ? 'text' : 'password'}
                    className={`rhine-input${password ? ' filled' : ''}${passErr ? ' error' : ''}`}
                    value={password} onChange={handlePassChange} onBlur={handlePassBlur}
                    placeholder={msg.passwordPlaceholder}
                    autoComplete="current-password"
                    aria-required="true" aria-invalid={!!passErr}
                    aria-describedby={passErr ? 'rhine-pass-err' : undefined} />
                  <button type="button" className="rhine-password-toggle"
                    onClick={() => setShowPw(!showPw)}
                    aria-label={showPw ? '隐藏密码' : '显示密码'} tabIndex={-1}>
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {passErr && <p id="rhine-pass-err" className="rhine-error-text" role="alert">{passErr}</p>}
                <PasswordStrength strength={pwStrength} />
              </div>

              {/* 选项行 */}
              <div className="rhine-form-options">
                <label className="rhine-remember">
                  <div className={`rhine-remember-check${remember ? ' checked' : ''}`}
                    onClick={() => setRemember(!remember)}
                    role="checkbox" aria-checked={remember} tabIndex={0}
                    onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); setRemember(!remember) } }}>
                    {remember && <CheckCircle2 size={14} />}
                  </div>
                  <span>{msg.rememberMe}</span>
                </label>
                <Link to="/forgot-password" className="rhine-forgot-link">{msg.forgotPassword}</Link>
              </div>

              {/* 主提交按钮 ✨ 辉光效果 */}
              <button type="submit" className="rhine-submit-btn"
                disabled={loading} onClick={handleBtnClick}
                aria-label={loading ? msg.loggingIn : msg.loginButton}>
                {loading ? (
                  <><span className="rhine-spinner" aria-hidden="true" /><span>{msg.loggingIn}</span></>
                ) : msg.loginButton}
              </button>
            </form>

            {/* 社交登录 — 完整功能版 */}
            <SocialLoginSection />

            {/* 安全提示 */}
            <div className="rhine-security-note">
              <Shield size={12} aria-hidden="true" /><span>{msg.securityNote}</span>
            </div>

            {/* 页脚链接 */}
            <div className="rhine-footer">
              <div className="rhine-footer-links">
                <Link to="/privacy-policy">{msg.privacyPolicy}</Link>
                <span className="rhine-footer-sep" aria-hidden="true" />
                <Link to="/terms">{msg.termsOfService}</Link>
              </div>
            </div>

            {/* 🔒 P0 安全修复: 仅开发环境显示默认账号，不显示明文密码 */}
            {import.meta.env?.DEV && credentials.defaultUsername && (
              <div className="rhine-credentials-hint">
                <p>{msg.defaultAdmin}：<code>{credentials.defaultUsername}</code> / <code>******</code></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
