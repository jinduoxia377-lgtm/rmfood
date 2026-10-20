/**
 * RMFOOD — 登录页面 (莱茵分子 · Rhine Molecular)
 *
 * 主题系统设计规范对齐版 v5.0 — 双栏深度重构
 *
 * 设计基准 (frontend/design-system/DESIGN.md + RMFOOD-主题系统设计规范.md):
 * ── 桌面端 (≥1024px) 双栏布局:
 *    左栏 = 品牌叙事区 (Logo + 主张 + 三大支柱: 基因组学/蛋白质组学/人工智能)
 *    右栏 = 登录卡片 (440px 主内容宽度, 表单/社交/预登记/安全说明)
 * ── 移动端 (<1024px): 品牌条 + 单卡片全宽, 支柱区收起
 * ── 所有颜色/间距/圆角/阴影/字号全部对接全局语义令牌 (--color-*, --text-*,
 *    --bg-*, --space-*, --radius-*, --shadow-*), Light/Dark 双模式自动适配
 * ── 字号基线 (对齐主题令牌 --text-*): 卡片标题 22px (h4, 卡片标题级),
 *    副标题 14px (body-sm), 正文 15px (body), 注释 12px (caption),
 *    品牌主张 28px (h2), 品牌名 24px (h3), 支柱 14px (body-sm)
 * ── WCAG 2.1 AA: 44×44 触控目标、完整 ARIA、skip link、键盘可达
 * ── 交互: 输入聚焦环、按钮涟漪、卡片入场动画 (尊重 prefers-reduced-motion)
 */
import {
  useState, useCallback, useRef, useLayoutEffect,
  type FC, type FormEvent, type ChangeEvent,
  type FocusEvent, type MouseEvent as RMouseEvent,
  type KeyboardEvent as RKeyboardEvent,
  type CSSProperties,
} from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Eye, EyeOff, User, Lock, AlertCircle, CheckCircle2,
  Shield, Mail, Dna, BoxSelect, BrainCircuit,
  ArrowRight, type LucideIcon,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import { RHINE_BRAND_CONFIG, RHINE_LOGIN_CONFIG } from '@/config'
import './LoginPage.css'

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

  /* ── P0-2: 图标统一继承 CSS color (currentColor), 不再硬编码品牌原色
     GitHub 原 #f0f6fc 近白色在浅色卡片上不可见, 现由 .rhine-social-icon-wrap 统一着色 */
  const socialIconFill = 'currentColor'

  /* ── 微信图标 ── */
  const WechatIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={socialIconFill} aria-hidden="true">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.325.325 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18z"/>
    </svg>
  )

  /* ── QQ 企鹅图标 ── */
  const QQIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={socialIconFill} aria-hidden="true">
      <path d="M12.003 2c-2.265 0-4.346 1.09-5.707 2.793-.403.505-.75 1.056-1.024 1.64C4.088 8.41 4 10.428 4 12c0 3.52 1.187 6.477 3.033 8.308.487.483 1.108.926 1.837 1.252.536.24 1.148.397 1.796.428.11.005.223.012.334.012.111 0 .225-.007.334-.012.648-.031 1.26-.188 1.796-.428.729-.326 1.35-.77 1.837-1.252C18.813 18.477 20 15.52 20 12c0-1.572-.088-3.59-1.27-5.567-.273-.584-.62-1.135-1.023-1.64C16.35 3.09 14.268 2 12.003 2z"/>
      <ellipse cx="8.5" cy="11" rx="1.5" ry="2" fill="#fff" opacity="0.9"/>
      <ellipse cx="15.5" cy="11" rx="1.5" ry="2" fill="#fff" opacity="0.9"/>
      <path d="M10 13.5c0 .8.9 1.5 2 1.5s2-.7 2-1.5" fill="none" stroke="#fff" strokeWidth="0.8" opacity="0.7"/>
    </svg>
  )

  /* ── GitHub 图标 ── */
  const GitHubIcon = () => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill={socialIconFill} aria-hidden="true">
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
              {/* eslint-disable-next-line react-hooks/static-components */}
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
              {/* eslint-disable-next-line react-hooks/static-components */}
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
              {/* eslint-disable-next-line react-hooks/static-components */}
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
   Whitelist Entry — 白名单申请入口 (v6.0 替换原邮箱预登记折叠表单)
   点击跳转独立申请页 /whitelist-apply（含申请窗口截止倒计时）
   ═══════════════════════════════════════════════════════════════ */
const WhitelistEntryButton: FC = () => {
  const { t } = useTranslation()

  return (
    <div className="rhine-preregister whitelist-login-entry">
      <Link to="/whitelist-apply" className="rhine-preregister-toggle" aria-label={t('pages.whitelist.loginEntry')}>
        <Mail size={15} aria-hidden="true" />
        <span>{t('pages.whitelist.loginEntry')}</span>
      </Link>
      <span className="whitelist-login-entry-sub">{t('pages.whitelist.loginEntrySub')}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Brand Panel — 桌面端左侧品牌叙事区 (≥1024px)
   Logo + 主张 + 三大支柱 (基因组学 / 蛋白质组学 / 人工智能)
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
      {/* 背景纹理层 — 点阵网格 + 径向光晕, 与 Dashboard bg-grid 同规格 */}
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
export default function RhineLoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const requiresTwoFactor = useAuthStore((s) => s.requiresTwoFactor)
  const twoFactorUsername = useAuthStore((s) => s.twoFactorUsername)
  const clearTwoFactor = useAuthStore((s) => s.clearTwoFactor)
  const msg = RHINE_LOGIN_CONFIG.messages

  const userRef = useRef<HTMLInputElement>(null)
  const passRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [userErr, setUserErr] = useState('')
  const [passErr, setPassErr] = useState('')
  /* F3-3: 大写锁定检测 (密码框聚焦期间) */
  const [capsOn, setCapsOn] = useState(false)

  /* 进入登录页时重置 2FA 中间状态 */
  useLayoutEffect(() => {
    clearTwoFactor()
  }, [clearTwoFactor])

  /* 429 限频倒计时 (秒) — 与 429 错误提示联动 */
  const [rateCountdown, setRateCountdown] = useState(0)
  useLayoutEffect(() => {
    if (rateCountdown <= 0) return
    const t = setTimeout(() => setRateCountdown((s) => (s > 1 ? s - 1 : 0)), 1000)
    return () => clearTimeout(t)
  }, [rateCountdown])

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsername(savedUser)
    setRemember(true)
    requestAnimationFrame(() => requestAnimationFrame(() => { passRef.current?.focus() }))
  }, [])

  /* ── Handlers ── */
  const handleUserChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value); if (userErr) setUserErr('')
  }, [userErr])
  const handleUserBlur = useCallback((_: FocusEvent<HTMLInputElement>) => {
    void _;
    setUserErr(validateUser(username))
  }, [username, validateUser])
  const handlePassChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    if (passErr) setPassErr('')
  }, [passErr])
  const handlePassBlur = useCallback((_: FocusEvent<HTMLInputElement>) => {
    void _;
    setPassErr(validatePass(password))
    setCapsOn(false) /* F3-3: 失焦后不再提示大写锁定 */
  }, [password, validatePass])

  /* F3-3: 仅在密码框聚焦时探测 CapsLock 状态 (getModifierState 为 KeyboardEvent 标准 API) */
  const handlePassKeyUp = useCallback((e: RKeyboardEvent<HTMLInputElement>) => {
    const on = typeof e.getModifierState === 'function' ? e.getModifierState('CapsLock') : false
    setCapsOn((prev) => (prev === on ? prev : on))
  }, [])

  /* ── Submit ── */
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    if (rateCountdown > 0) { userRef.current?.focus(); return }
    const ue = validateUser(username); const pe = validatePass(password)
    setUserErr(ue); setPassErr(pe)
    if (ue) { userRef.current?.focus(); return }
    if (pe) { passRef.current?.focus(); return }
    setError(''); setRateCountdown(0); setLoading(true)
    try {
      // 2FA 二次验证：要求输入 6 位动态码
      if (requiresTwoFactor && twoFactorCode.trim().length !== 6) {
        setError('请输入 6 位动态验证码')
        codeRef.current?.focus()
        setLoading(false)
        return
      }
      const result = await login(username, password, requiresTwoFactor ? twoFactorCode.trim() : undefined)
      // 2FA 二次验证：登录未完成，等待用户输入动态码
      if (result === '2fa') return
      if (requiresTwoFactor) {
        setSuccess('验证成功，正在登录...')
        setTimeout(() => navigate('/dashboard'), 1200)
        return
      }
      if (remember) {
        sessionStorage.setItem('rhine_remember', '1')
        sessionStorage.setItem('rhine_user', username)
        /* F3-2修复: 补 SameSite=Lax (原缺失, 无该属性时现代浏览器按 Lax 处理但行为不一致) */
        document.cookie = `rhine_user=${encodeURIComponent(username)}; path=/; max-age=604800; SameSite=Lax`
      } else {
        sessionStorage.removeItem('rhine_remember')
        sessionStorage.removeItem('rhine_user')
        document.cookie = 'rhine_user=; path=/; max-age=0; SameSite=Lax'
      }
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
        const secs = isNaN(retryAfter) ? 60 : retryAfter
        setRateCountdown(secs)
        setError('验证请求过于频繁，请稍后再试')
      } else if (s === 400) {
        setError('2FA 验证码错误，请重新输入')
        setTwoFactorCode('')
        codeRef.current?.focus()
      } else {
        setError(s === 401 ? msg.errorAuth : msg.errorNetwork)
      }
    } finally { setLoading(false) }
  }, [username, password, twoFactorCode, requiresTwoFactor, remember, validateUser, validatePass, login, navigate, msg, rateCountdown])

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

        {/* 品牌叙事面板 (桌面端) — 移动端收起, 由下方品牌条承接 */}
        <BrandPanel />

        {/* 移动端品牌条
            F2-7修复: <1024px 时桌面品牌面板(h1 所在)被隐藏, 页面原本没有 h1。
            此品牌名改由 <h1> 承载 (视觉不变), 保证移动端标题层级完整。 */}
        <div className="rhine-mobile-brand">
          <div className="rhine-mobile-logo">
            <div className="rhine-mobile-logo-icon" aria-hidden="true"><Shield size={17} /></div>
            <h1 className="rhine-mobile-logo-text">{RHINE_BRAND_CONFIG.name}</h1>
          </div>
        </div>

        {/* 登录表单面板 */}
        <div className="rhine-form-panel">
          <div className="rhine-form-content">
            <div id="rhine-login-form" className="rhine-card">

              {/* 卡片头部 — 欢迎横幅: 卡片标题 (h4 级 22px) + 副标题 (body-sm 14px)
                  P1-1: 移除装饰性 accent bar — 登录是单一任务页, 卡片靠阴影+hairline 边框建立层级 */}
              <div className="rhine-card-header">
                <h2>{msg.welcome}</h2>
                <p>{msg.prompt}</p>
              </div>

              {/* 错误提示区 — 同时显示动态倒计时 (限频冷却期内) */}
              {error && (
                <div className="rhine-alert rhine-alert-error" role="alert">
                  <AlertCircle size={16} className="rhine-alert-icon" aria-hidden="true" />
                  {/* F2-8修复: 倒计时秒数对辅助技术隐藏。
                      原实现把「（Ns）」拼进 role="alert" 文本, 每秒改写 live region →
                      屏幕阅读器每秒打断播报。现仅视觉可见; 冷却语义由按钮禁用态承载。 */}
                  <span>
                    {error}
                    {rateCountdown > 0 && <span aria-hidden="true">（{rateCountdown}s）</span>}
                  </span>
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
                      onKeyUp={handlePassKeyUp}
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
                  {/* F3-3: 大写锁定提示 — 与校验错误互斥, 避免同一行堆叠两条提示 */}
                  {!passErr && capsOn && (
                    <p className="rhine-caps-hint" role="status">大写锁定已开启，可能导致密码输入错误</p>
                  )}
                </div>

                {/* 2FA 动态验证码（启用两步验证后出现） */}
                {requiresTwoFactor && (
                  <div className="rhine-form-group">
                    <label htmlFor="rhine-2fa-code" className="rhine-label">
                      {twoFactorUsername ? `${twoFactorUsername} 的两步验证` : '两步验证'}
                    </label>
                    <div className="rhine-input-wrap">
                      <Shield size={18} className="rhine-input-icon" aria-hidden="true" />
                      <input
                        ref={codeRef}
                        id="rhine-2fa-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        className="rhine-input"
                        value={twoFactorCode}
                        onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="6 位动态验证码"
                        aria-required="true"
                      />
                    </div>
                    <p className="rhine-error-text" role="alert" style={{ minHeight: 0 }}>
                      {error}
                    </p>
                    <button
                      type="button"
                      className="rhine-forgot-link"
                      onClick={() => { clearTwoFactor(); setTwoFactorCode(''); setError('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}
                    >
                      返回重新输入密码
                    </button>
                  </div>
                )}

                {/* 选项行 */}
                <div className="rhine-form-options">
                  <label className="rhine-remember" htmlFor="rhine-remember">
                    {/* P3-2: 原生 checkbox — 屏幕阅读器兼容性优于 div[role=checkbox],
                        外观由 CSS 自定义 (appearance: none + 视觉 18px), 可点热区 44px */}
                    <input
                      id="rhine-remember"
                      type="checkbox"
                      className="rhine-remember-check"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      aria-label={remember ? '取消保持登录' : '保持登录'}
                    />
                    <span>{msg.rememberMe}</span>
                  </label>
                  <Link to="/forgot-password" className="rhine-forgot-link">{msg.forgotPassword}</Link>
                </div>

                {/* 主提交按钮 — 限频冷却期内禁用 */}
                <button type="submit" className="rhine-submit-btn"
                  disabled={loading || rateCountdown > 0} onClick={handleBtnClick}
                  aria-label={loading ? msg.loggingIn : (rateCountdown > 0 ? `请 ${rateCountdown} 秒后重试` : msg.loginButton)}
                  aria-busy={loading}>
                  {loading ? (
                    <span className="rhine-btn-content">
                      <span className="rhine-spinner" aria-hidden="true" />
                      <span>{msg.loggingIn}</span>
                    </span>
                  ) : rateCountdown > 0 ? (
                    /* F2-8: 冷却期按钮文案与禁用态一致, 视觉上直接说明剩余时间 */
                    <span className="rhine-btn-content">
                      <span>请 {rateCountdown}s 后重试</span>
                    </span>
                  ) : (
                    <span className="rhine-btn-content">
                      <span>{msg.loginButton}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  )}
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

              {/* 白名单申请入口 — 跳转独立申请页（含窗口截止倒计时） */}
              <WhitelistEntryButton />

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
          </div>
        </div>
      </div>
    </div>
  )
}
