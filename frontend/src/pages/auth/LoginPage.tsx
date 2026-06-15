/**
 * RMFOOD 登录页 — v2.0 专业重设计
 *
 * 设计系统: UI/UX Pro Max 智能框架
 * 风格: 专业极简 + 有机自然
 * 布局: 桌面端 55:45 非对称分栏 / 移动端全宽
 *
 * 核心改进:
 * - 品牌区常驻 (移动端不隐藏)
 * - 三段式品牌故事 (传承 · 科学 · 创新)
 * - blur 时内联验证 (替代 setTimeout)
 * - 5 级密码强度可视化
 * - 社交登录品牌色标识
 * - 错误时自动聚焦首个错误字段
 * - 按钮涟漪点击反馈
 * - 完整 WCAG 2.1 AA 可访问性
 */
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type FC,
  type FormEvent,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Leaf,
  Shield,
  Cpu,
  Sun,
  Moon,
  Eye,
  EyeOff,
  User,
  Lock,
  Check,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { LOGIN_PAGE_CONFIG, BRAND_CONFIG } from '@/config'
import { useTheme, useIsDarkMode } from '@/theme'
import './LoginPage.css'
import './LoginPage.theme-bridge.css'

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
interface BrandPillar {
  icon: string
  title: string
  subtitle: string
  description: string
}

interface SocialLoginProvider {
  enabled: boolean
  label: string
  color: string
}

/* ═══════════════════════════════════════════════════════════════
   Brand Panel (Desktop Left Side)
   ═══════════════════════════════════════════════════════════════ */
const BrandPanel: FC<{ pillars: BrandPillar[]; isDark: boolean }> = ({ pillars }) => {
  const iconMap: Record<string, LucideIcon> = { Leaf, Cpu, Shield }

  return (
    <div className="login-brand-panel" role="banner" aria-label="品牌展示区">
      {/* 渐变背景 */}
      <div className="login-brand-gradient" aria-hidden="true" />
      {/* 有机纹理 */}
      <div className="login-brand-texture" aria-hidden="true" />

      <div className="login-brand-content">
        {/* Logo */}
        <div className="login-brand-logo login-anim-fade-in-up">
          <div className="login-brand-logo-icon" aria-hidden="true">
            <Leaf size={24} />
          </div>
          <span className="login-brand-logo-text">{BRAND_CONFIG.name}</span>
        </div>

        {/* 标签 */}
        <div className="login-anim-fade-in-up login-delay-100">
          <span className="login-brand-tagline">{LOGIN_PAGE_CONFIG.brandStory.tagline}</span>
        </div>

        {/* 标题 */}
        <h1 className="login-brand-headline login-anim-fade-in-up login-delay-200">
          {LOGIN_PAGE_CONFIG.brandStory.headline}
        </h1>

        {/* 描述 */}
        <p className="login-brand-description login-anim-fade-in-up login-delay-300">
          {LOGIN_PAGE_CONFIG.brandStory.description}
        </p>

        {/* 三大支柱 */}
        <div className="login-brand-pillars login-anim-fade-in-up login-delay-400">
          {pillars.map((pillar, i) => {
            const IconComponent = iconMap[pillar.icon] || Leaf
            return (
              <div
                key={pillar.title}
                className="login-brand-pillar"
                style={{ animationDelay: `${0.4 + i * 0.15}s` }}
              >
                <div className="login-brand-pillar-icon" aria-hidden="true">
                  <IconComponent size={20} />
                </div>
                <div className="login-brand-pillar-text">
                  <h4>{pillar.title}<span style={{fontWeight:400,opacity:0.6,marginLeft:6,fontSize:12}}>{pillar.subtitle}</span></h4>
                  <p>{pillar.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* 版权 */}
        <div
          className="login-brand-footer login-anim-fade-in login-delay-600"
          dangerouslySetInnerHTML={{ __html: BRAND_CONFIG.copyright }}
        />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Password Strength Bar
   ═══════════════════════════════════════════════════════════════ */
const PasswordStrengthBar: FC<{ strength: number }> = ({ strength }) => {
  const levels = LOGIN_PAGE_CONFIG.passwordStrength.levels
  const colors = LOGIN_PAGE_CONFIG.passwordStrength.colors
  const idx = Math.min(strength, levels.length - 1)

  return (
    <div className="login-password-strength" aria-live="polite">
      <div className="login-password-strength-header">
        <span className="login-password-strength-label">密码强度</span>
        <span
          className="login-password-strength-value"
          style={{ color: strength > 0 ? colors[idx] : undefined }}
        >
          {strength > 0 ? levels[idx] : '未输入'}
        </span>
      </div>
      <div className="login-password-strength-bar">
        <div
          className="login-password-strength-fill"
          style={{
            width: `${((strength + 1) / levels.length) * 100}%`,
            backgroundColor: strength > 0 ? colors[idx] : undefined,
          }}
        />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Social Login Buttons
   ═══════════════════════════════════════════════════════════════ */
const SocialLoginButtons: FC<{ onWechatLogin: () => void }> = ({ onWechatLogin }) => {
  const socials = LOGIN_PAGE_CONFIG.socialLogin

  return (
    <>
      <div className="login-divider" aria-hidden="true">
        <span className="login-divider-text">{LOGIN_PAGE_CONFIG.messages.orContinueWith}</span>
      </div>

      <div className="login-social-buttons">
        {/* 微信 */}
        {socials.wechat.enabled && (
          <button
            type="button"
            className="login-social-btn"
            onClick={onWechatLogin}
            aria-label={`使用${socials.wechat.label}登录`}
          >
            <span className="login-social-btn-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill={socials.wechat.color} aria-hidden="true">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.325.325 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.49.49 0 0 1 .178-.554C23.028 18.48 24 16.82 24 14.98c0-3.21-2.931-5.952-7.062-6.122zm-2.18 2.962c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z"/>
              </svg>
            </span>
            <span className="login-social-btn-label">{socials.wechat.label}</span>
          </button>
        )}

        {/* QQ */}
        {socials.qq.enabled && (
          <button
            type="button"
            className="login-social-btn"
            aria-label={`使用${socials.qq.label}登录`}
          >
            <span className="login-social-btn-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill={socials.qq.color} aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.5 14.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </span>
            <span className="login-social-btn-label">{socials.qq.label}</span>
          </button>
        )}

        {/* GitHub */}
        {socials.github.enabled && (
          <button
            type="button"
            className="login-social-btn"
            aria-label={`使用${socials.github.label}登录`}
          >
            <span className="login-social-btn-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill={socials.github.color} aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </span>
            <span className="login-social-btn-label">{socials.github.label}</span>
          </button>
        )}
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Main LoginPage Component
   ═══════════════════════════════════════════════════════════════ */
export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const { setThemeMode } = useTheme()
  const isDark = useIsDarkMode()

  /* ── Refs ── */
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  /* ── Form State ── */
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordStrength, setPasswordStrength] = useState(0)
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [pageReady, setPageReady] = useState(false)

  /* ── Page Mount Animation ── */
  useEffect(() => {
    const timer = setTimeout(() => setPageReady(true), 50)
    return () => clearTimeout(timer)
  }, [])

  /* ═════════════════════════════════════════════════════════════
     Validation (blur-based, not keystroke)
     ═════════════════════════════════════════════════════════════ */
  const validateUsername = useCallback((value: string): string => {
    if (!value.trim()) return '请输入用户名'
    if (value.trim().length < 3) return '用户名至少需要 3 个字符'
    return ''
  }, [])

  const checkPasswordStrength = useCallback((value: string): number => {
    let score = 0
    if (value.length >= 6) score++
    if (value.length >= 10) score++
    if (/[A-Z]/.test(value)) score++
    if (/[a-z]/.test(value)) score++
    if (/[0-9]/.test(value)) score++
    if (/[^A-Za-z0-9]/.test(value)) score++
    return Math.min(score, 4) // 0-4 scale
  }, [])

  const validatePassword = useCallback((value: string): string => {
    if (!value) return '请输入密码'
    if (value.length < 6) return '密码至少需要 6 个字符'
    return ''
  }, [])

  /* ── Event Handlers ── */
  const handleUsernameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setUsername(value)
    if (usernameError) setUsernameError('')
  }, [usernameError])

  const handleUsernameBlur = useCallback((_e: FocusEvent<HTMLInputElement>) => {
    setUsernameError(validateUsername(username))
  }, [username, validateUsername])

  const handlePasswordChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPassword(value)
    setPasswordStrength(checkPasswordStrength(value))
    if (passwordError) setPasswordError('')
  }, [passwordError, checkPasswordStrength])

  const handlePasswordBlur = useCallback((_e: FocusEvent<HTMLInputElement>) => {
    setPasswordError(validatePassword(password))
    setIsPasswordFocused(false)
  }, [password, validatePassword])

  const handlePasswordFocus = useCallback(() => {
    setIsPasswordFocused(true)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeMode(isDark ? 'light' : 'dark')
  }, [isDark, setThemeMode])

  /* ── Submit ── */
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()

    const uErr = validateUsername(username)
    const pErr = validatePassword(password)
    setUsernameError(uErr)
    setPasswordError(pErr)

    // 聚焦第一个错误字段
    if (uErr) {
      usernameRef.current?.focus()
      return
    }
    if (pErr) {
      passwordRef.current?.focus()
      return
    }

    setError('')
    setLoading(true)

    try {
      await login(username, password)

      if (rememberMe) {
        localStorage.setItem('remember_me', 'true')
        localStorage.setItem('username', username)
      } else {
        localStorage.removeItem('remember_me')
        localStorage.removeItem('username')
      }

      setSuccess(LOGIN_PAGE_CONFIG.messages.loginSuccess)
      setTimeout(() => navigate('/dashboard'), 800)
    } catch (err: unknown) {
      const status =
        typeof err === 'object' && err !== null &&
        'response' in err && typeof err.response === 'object' &&
        err.response !== null && 'status' in err.response
          ? (err.response as { status: number }).status
          : null

      if (status === 401) {
        setError(LOGIN_PAGE_CONFIG.messages.errorMessage)
      } else if (status === 429) {
        setError(LOGIN_PAGE_CONFIG.messages.rateLimitError)
      } else {
        setError(LOGIN_PAGE_CONFIG.messages.networkError)
      }
    } finally {
      setLoading(false)
    }
  }, [username, password, rememberMe, validateUsername, validatePassword, login, navigate])

  /* ── WeChat Login ── */
  const handleWechatLogin = useCallback(() => {
    const appId = 'YOUR_WECHAT_APPID'
    const redirectUri = encodeURIComponent(window.location.origin + '/api/auth/wechat/callback')
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    localStorage.setItem('wechat_state', state)
    window.location.href = `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`
  }, [])

  /* ── Ripple Effect ── */
  const handleButtonClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget
    const ripple = document.createElement('span')
    const rect = btn.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    ripple.className = 'login-ripple'
    ripple.style.width = ripple.style.height = `${size}px`
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`
    btn.appendChild(ripple)
    ripple.addEventListener('animationend', () => ripple.remove())
  }, [])

  /* ── Keyboard: Enter to submit ── */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      const form = (e.target as HTMLElement).closest('form')
      if (form) form.requestSubmit()
    }
  }, [loading])

  /* ═════════════════════════════════════════════════════════════
     Render
     ═════════════════════════════════════════════════════════════ */
  const { brandStory, messages, credentials } = LOGIN_PAGE_CONFIG

  return (
    <>
      {/* Skip to main content */}
      <a href="#login-form" className="login-skip-link">
        跳转到登录表单
      </a>

      <div className="login-page" role="main" aria-label="登录页面">
        {/* ── 品牌区 (Desktop + Tablet) ── */}
        <BrandPanel pillars={brandStory.pillars} isDark={isDark} />

        {/* ── 表单区 ── */}
        <div className="login-form-panel">
          <div className="login-form-container">
            {/* 移动端品牌标识 */}
            <div className="login-mobile-brand login-anim-fade-in-up">
              <div className="login-mobile-brand-left">
                <div className="login-mobile-logo-icon" aria-hidden="true">
                  <Leaf size={22} />
                </div>
                <div className="login-mobile-logo-text">
                  <h2>{BRAND_CONFIG.name}</h2>
                  <span>{BRAND_CONFIG.fullName}</span>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="login-theme-toggle"
                aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>

            {/* 登录卡片 */}
            <div
              id="login-form"
              className="login-card login-anim-fade-in-scale login-delay-200"
            >
              {/* 标题 */}
              <div className="login-card-header">
                <h2>{messages.welcome}</h2>
                <p>{messages.prompt}</p>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="login-alert login-alert-error login-anim-shake" role="alert">
                  <AlertCircle size={18} className="login-alert-icon" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              {/* 成功提示 */}
              {success && (
                <div className="login-alert login-alert-success" role="status" aria-live="polite">
                  <CheckCircle2 size={18} className="login-alert-icon" aria-hidden="true" />
                  <span>{success}</span>
                </div>
              )}

              {/* 表单 */}
              <form onSubmit={handleSubmit} noValidate aria-label="登录表单">
                {/* 用户名 */}
                <div className="login-form-group">
                  <label htmlFor="username" className="login-label login-label-required">
                    {messages.usernameLabel}
                  </label>
                  <div className="login-input-wrapper">
                    <User size={20} className="login-input-icon" aria-hidden="true" />
                    <input
                      ref={usernameRef}
                      id="username"
                      type="text"
                      className={`login-input${username ? ' filled' : ''}${usernameError ? ' error' : ''}`}
                      value={username}
                      onChange={handleUsernameChange}
                      onBlur={handleUsernameBlur}
                      onKeyDown={handleKeyDown}
                      placeholder={messages.usernamePlaceholder}
                      autoComplete="username"
                      autoFocus
                      aria-required="true"
                      aria-invalid={!!usernameError}
                      aria-describedby={usernameError ? 'username-error' : undefined}
                    />
                  </div>
                  {usernameError && (
                    <p id="username-error" className="login-error-text" role="alert">
                      {usernameError}
                    </p>
                  )}
                </div>

                {/* 密码 */}
                <div className="login-form-group">
                  <label htmlFor="password" className="login-label login-label-required">
                    {messages.passwordLabel}
                  </label>
                  <div className="login-input-wrapper">
                    <Lock size={20} className="login-input-icon" aria-hidden="true" />
                    <input
                      ref={passwordRef}
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className={`login-input${password ? ' filled' : ''}${passwordError ? ' error' : ''}`}
                      value={password}
                      onChange={handlePasswordChange}
                      onFocus={handlePasswordFocus}
                      onBlur={handlePasswordBlur}
                      onKeyDown={handleKeyDown}
                      placeholder={messages.passwordPlaceholder}
                      autoComplete="current-password"
                      aria-required="true"
                      aria-invalid={!!passwordError}
                      aria-describedby={passwordError ? 'password-error' : undefined}
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                      aria-pressed={showPassword}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {passwordError && (
                    <p id="password-error" className="login-error-text" role="alert">
                      {passwordError}
                    </p>
                  )}
                  {(isPasswordFocused || password) && (
                    <PasswordStrengthBar strength={passwordStrength} />
                  )}
                </div>

                {/* 记住我 & 忘记密码 */}
                <div className="login-form-options">
                  <label className="login-remember-me">
                    <div
                      className={`login-remember-checkbox${rememberMe ? ' checked' : ''}`}
                      onClick={() => setRememberMe(!rememberMe)}
                      role="checkbox"
                      aria-checked={rememberMe}
                      aria-label={messages.rememberMe}
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); setRememberMe(!rememberMe) } }}
                    >
                      {rememberMe && <Check size={14} color="#fff" />}
                    </div>
                    <span>{messages.rememberMe}</span>
                  </label>
                  <Link to="/forgot-password" className="login-forgot-link">
                    {messages.forgotPassword}
                  </Link>
                </div>

                {/* 登录按钮 */}
                <button
                  type="submit"
                  className="login-submit-btn"
                  disabled={loading}
                  onClick={handleButtonClick}
                  aria-label={loading ? messages.loggingIn : messages.loginButton}
                >
                  {loading ? (
                    <>
                      <span className="login-spinner" aria-hidden="true" />
                      <span>{messages.loggingIn}</span>
                    </>
                  ) : (
                    messages.loginButton
                  )}
                </button>
              </form>

              {/* 社交登录 */}
              <SocialLoginButtons onWechatLogin={handleWechatLogin} />

              {/* 安全提示 */}
              <div className="login-security-note">
                <Shield size={14} aria-hidden="true" />
                <span>{messages.securityNote}</span>
              </div>

              {/* 页脚链接 */}
              <div className="login-footer">
                <div className="login-footer-links">
                  <Link to="/privacy-policy">{messages.privacyPolicy}</Link>
                  <span className="login-footer-sep" aria-hidden="true" />
                  <Link to="/terms">{messages.termsOfService}</Link>
                </div>
              </div>

              {/* 🔒 P0 安全修复: 仅开发环境显示默认账号，不显示明文密码 */}
              {import.meta.env?.DEV && credentials.defaultUsername && (
                <div className="login-credentials-hint">
                  <p>
                    {messages.defaultAdmin}：<code>{credentials.defaultUsername}</code> / <code>******</code>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
