/**
 * RMFOOD — 登录页面
 *
 * 主题系统规范对齐版 (DESIGN.md v2.0 / Dashboard 基准)
 * - 页面背景使用 bg-grid 点阵 + var(--bg-canvas)，与 /dashboard 视觉统一
 * - 容器宽度 max-w-7xl，垂直节奏 space-y-4
 * - 卡片使用全局 Card 体系：rounded-xl bg-primary-600 欢迎横幅 + 顶部 accent bar
 * - 输入框 / 按钮 / 提示 全部对接全局语义令牌，Light/Dark 双模式自适应
 * - 字号基线：页面标题 16px，区块副标题/说明 12px，Tab/辅助 14px
 * - WCAG 2.1 AA 可访问性
 */
import {
  useState, useCallback, useRef, useLayoutEffect,
  type FC, type FormEvent, type ChangeEvent,
  type FocusEvent, type MouseEvent as RMouseEvent,
} from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Eye, EyeOff, User, Lock, AlertCircle, CheckCircle2,
  Shield, type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { RHINE_BRAND_CONFIG, RHINE_LOGIN_CONFIG } from '@/config'

import { logger } from '@/utils/safeLogger';
import './LoginPage.css'

/* ═══════════════════════════════════════════════════════════════
   Startup Validation — OAuth credentials
   NOTE: This must NOT throw at module scope — it would crash the
   entire SPA. Instead, warn in console and let the config layer
   auto-disable providers that lack credentials.
   ═══════════════════════════════════════════════════════════════ */

const OAUTH_CHECK: Record<string, string> = {
  VITE_WECHAT_APPID: '微信 OAuth (VITE_WECHAT_APPID)',
  VITE_QQ_APPID: 'QQ OAuth (VITE_QQ_APPID)',
  VITE_GITHUB_CLIENT_ID: 'GitHub OAuth (VITE_GITHUB_CLIENT_ID)',
}

function checkOAuthEnvVars() {
  const missing: string[] = []
  for (const [key, label] of Object.entries(OAUTH_CHECK)) {
    const val = import.meta.env[key]
    if (!val || val.startsWith('YOUR_')) {
      missing.push(label)
    }
  }
  if (missing.length > 0) {
    // 降噪：OAuth 凭证缺失是预期配置（开发态 .env 留空，社交登录被自动禁用）。
    // 原实现每次加载登录页都打一条 WARN，刷屏且非错误；降级为 debug。
    // 真要启用社交登录时，请填入真实 VITE_* 变量而非依赖此告警。
    logger.debug(
      `[Login] OAuth 未配置（社交登录已自动禁用）：缺少 ${missing.join(', ')}。`
    )
  }
}

checkOAuthEnvVars()

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface SocialProvider {
  enabled: boolean; label: string; color: string; oauthUrl: string
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
    sessionStorage.setItem(`rhine_${provider}_state`, state)

    let authUrl = ''
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/${provider}/callback`)

    switch (provider) {
      case 'wechat':
        authUrl = `${cfg.oauthUrl}?appid=${import.meta.env.VITE_WECHAT_APPID}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`
        break
      case 'qq':
        authUrl = `${cfg.oauthUrl}?response_type=code&client_id=${import.meta.env.VITE_QQ_APPID}&redirect_uri=${redirectUri}&state=${state}&scope=get_user_info`
        break
      case 'github':
        authUrl = `${cfg.oauthUrl}?client_id=${import.meta.env.VITE_GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user:email&state=${state}`
        break
    }

    if (authUrl) {
      // 短暂延迟让用户看到 loading 反馈
      setTimeout(() => { window.location.href = authUrl }, 400)
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
    <div className="rhine-social-section">
      <div className="rhine-social-buttons">
        {/* 微信 */}
        {socials.wechat.enabled && (
          <button
            type="button"
            className={`rhine-social-btn wechat ${loadingProvider === 'wechat' ? 'loading' : ''}`}
            onClick={() => handleOAuthLogin('wechat', socials.wechat)}
            disabled={loadingProvider !== null}
            aria-label={loadingProvider === 'wechat' ? '微信登录中，请稍候' : '微信登录'}
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
            aria-label={loadingProvider === 'qq' ? 'QQ登录中，请稍候' : 'QQ登录'}
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
            aria-label={loadingProvider === 'github' ? 'GitHub登录中，请稍候' : 'GitHub登录'}
          >
            <span className="rhine-social-icon-wrap">
              {loadingProvider === 'github' ? <span className="rhine-social-spinner" /> : <GitHubIcon />}
            </span>
            <span className="rhine-social-label">{socials.github.label}</span>
          </button>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Brand Strip — 桌面端左上品牌区 (Dashboard 风格，无动画)
   ═══════════════════════════════════════════════════════════════ */
const BrandOverlay: FC = () => {
  return (
    <div className="rhine-brand-overlay">
      <div className="rhine-brand-logo">
        <div className="rhine-brand-icon" aria-hidden="true">
          <Shield size={19} />
        </div>
        <div>
          <div className="rhine-brand-name">{RHINE_BRAND_CONFIG.name}</div>
          <div className="rhine-brand-name-en">{RHINE_BRAND_CONFIG.nameEn}</div>
        </div>
      </div>
      <p className="rhine-brand-tagline">{RHINE_BRAND_CONFIG.tagline}</p>
    </div>
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
  const [rateLimitRemaining, setRateLimitRemaining] = useState(0)

  /* ── Validation ── */
  const validateUser = useCallback((v: string) => {
    if (!v.trim()) return '请输入用户名'
    if (v.trim().length < 3) return '用户名至少需要 3 个字符'
    return ''
  }, [])
  const validatePass = useCallback((v: string) => {
    if (!v) return '请输入密码'
    if (v.length < 6) return '密码至少需要 6 个字符'
    return ''
  }, [])

  /* ── 记住用户名自动填充 — useLayoutEffect 确保 DOM 已挂载 ── */
  useLayoutEffect(() => {
    const stored = sessionStorage.getItem('rhine_remember')
    if (stored !== '1') return
    const savedUser = sessionStorage.getItem('rhine_user')
    if (!savedUser) return
    setUsername(savedUser)
    setRemember(true)
    requestAnimationFrame(() => requestAnimationFrame(() => { passRef.current?.focus() }))
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
    if (passErr) setPassErr('')
  }, [passErr])
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
    setError(''); setRateLimitRemaining(0); setLoading(true)
    try {
      await login(username, password)
      if (remember) { sessionStorage.setItem('rhine_remember', '1'); sessionStorage.setItem('rhine_user', username) }
      else { sessionStorage.removeItem('rhine_remember'); sessionStorage.removeItem('rhine_user') }
      setSuccess(msg.loginSuccess)
      setTimeout(() => navigate('/dashboard'), 1200)
    } catch (err: unknown) {
      const resp = (typeof err === 'object' && err !== null && 'response' in err &&
        typeof (err as Record<string, unknown>).response === 'object' && (err as Record<string, unknown>).response !== null)
        ? (err as { response: { status: number; headers?: Record<string, string> } }).response
        : null
      const s = resp?.status ?? null
      if (s === 429) {
        const retryAfter = parseInt((resp?.headers?.['retry-after'] as string | undefined) ?? '60', 10)
        setRateLimitRemaining(isNaN(retryAfter) ? 60 : retryAfter)
        setError(`验证请求过于频繁，请 ${isNaN(retryAfter) ? 60 : retryAfter} 秒后重试`)
      } else {
        setError(s === 401 ? msg.errorAuth : msg.errorNetwork)
      }
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
  const hasSocialLogin = Object.values(RHINE_LOGIN_CONFIG.socialLogin).some(s => s.enabled)

  return (
    <div className="rhine-page-root">
      <a href="#rhine-login-form" className="rhine-skip-link">跳转到登录表单</a>

      <div className="login-page" role="main" aria-label="莱茵分子登录页面">
        {/* 背景层 — Dashboard 基准：bg-grid 点阵 + var(--bg-canvas) */}
        <div className="rhine-bg-layer" aria-hidden="true" />

        {/* 品牌叠加层 (桌面端) */}
        <BrandOverlay />

        {/* 移动端品牌条 */}
        <div className="rhine-mobile-brand">
          <div className="rhine-mobile-logo">
            <div className="rhine-mobile-logo-icon" aria-hidden="true"><Shield size={17} /></div>
            <span className="rhine-mobile-logo-text">{RHINE_BRAND_CONFIG.name}</span>
          </div>
        </div>

        {/* 登录表单面板 */}
        <div className="rhine-form-panel">
          <div className="rhine-form-content">
            <div id="rhine-login-form" className="rhine-card">

              {/* 卡片头部 — 欢迎横幅：rounded-xl bg-primary-600 含顶部 accent bar */}
              <div className="rhine-card-header">
                <div className="rhine-card-accent" aria-hidden="true" />
                <h2>{msg.welcome}</h2>
                <p>{msg.prompt}</p>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="rhine-alert rhine-alert-error" role="alert">
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
                      aria-label={showPw ? '隐藏密码' : '显示密码'}>
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {passErr && <p id="rhine-pass-err" className="rhine-error-text" role="alert">{passErr}</p>}
                </div>

                {/* 选项行 */}
                <div className="rhine-form-options">
                  <label className="rhine-remember">
                    <div
                      className={`rhine-remember-check${remember ? ' checked' : ''}`}
                      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setRemember(!remember) } }}
                      role="checkbox" aria-checked={remember} tabIndex={0}
                      aria-label={remember ? '已勾选：保持登录' : '未勾选：保持登录'}
                    >
                      {remember && <CheckCircle2 size={14} />}
                    </div>
                    <span>{msg.rememberMe}</span>
                  </label>
                  <Link to="/forgot-password" className="rhine-forgot-link">{msg.forgotPassword}</Link>
                </div>

                {/* 主提交按钮 */}
                <button type="submit" className="rhine-submit-btn"
                  disabled={loading} onClick={handleBtnClick}
                  aria-label={loading ? msg.loggingIn : msg.loginButton}
                  aria-busy={loading}>
                  {loading ? (
                    <span className="rhine-btn-content">
                      <span className="rhine-spinner" aria-hidden="true" />
                      <span>{msg.loggingIn}</span>
                    </span>
                  ) : msg.loginButton}
                </button>
              </form>

              {/* 社交登录 — 仅在至少一个启用时渲染 */}
              {hasSocialLogin && (
                <div className="rhine-social-divider-section">
                  <div className="rhine-divider" aria-hidden="true">
                    <span className="rhine-divider-text">{RHINE_LOGIN_CONFIG.messages.orContinueWith}</span>
                  </div>
                  <SocialLoginSection />
                </div>
              )}

              {/* 安全提示 */}
              <div className="rhine-security-note">
                <Shield size={12} aria-hidden="true" /><span>{msg.securityNote}</span>
              </div>

              {/* 页脚链接 */}
              <div className="rhine-footer">
                <div className="rhine-footer-links">
                  <Link to="/privacy">{msg.privacyPolicy}</Link>
                  <span className="rhine-footer-sep" aria-hidden="true" />
                  <Link to="/terms">{msg.termsOfService}</Link>
                </div>
              </div>
            </div>

            {/* 注册状态提示 — 卡片正下方，在 rhine-form-content 内垂直堆叠 */}
            <p className="rhine-registration-notice">
              平台暂未开放自助注册，请联系管理员开通账号
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
