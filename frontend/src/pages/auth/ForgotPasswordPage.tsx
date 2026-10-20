/**
 * 密码找回页面
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui/Icon'
import { Mail, Check } from 'lucide-react'
import { Input } from '@/components/ui'
import { Button } from '@/components/ui'
import { BRAND_CONFIG } from '@/config'
import { authApi } from '@/api/auth'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await authApi.forgotPassword(email)
      setSuccess(true)
    } catch {
      setError('发送密码重置邮件失败，请检查邮箱地址')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-grid flex" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      {/* ══ 左侧品牌区 ══ */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-primary-950">
        {/* 分子纹理背景 */}
        <div className="absolute inset-0 opacity-[0.07]">
          <svg className="w-full h-full" viewBox="0 0 800 800">
            <defs>
              <pattern id="molecules" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="3" fill="white" />
                <circle cx="80" cy="60" r="2" fill="white" />
                <circle cx="40" cy="90" r="4" fill="white" />
                <circle cx="100" cy="30" r="2.5" fill="white" />
                <line x1="20" y1="20" x2="80" y2="60" stroke="white" strokeWidth="0.5" />
                <line x1="80" y1="60" x2="40" y2="90" stroke="white" strokeWidth="0.5" />
                <line x1="20" y1="20" x2="40" y2="90" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#molecules)" />
          </svg>
        </div>
        {/* 渐变叠加 */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary-950/40 via-transparent to-transparent" />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 text-white">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--bg-secondary)]/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
              <Icon name="Beaker" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{BRAND_CONFIG.name}</h1>
              <p className="text-[var(--color-primary-text)]/80 text-sm">{BRAND_CONFIG.fullName} v{BRAND_CONFIG.version}</p>
            </div>
          </div>

          {/* 主体文案 */}
          <div className="max-w-lg">
            <h2 className="text-3xl xl:text-4xl font-bold leading-tight mb-[var(--space-apple-md)] tracking-tight">
              药食同源功能性食品
              <br />
              <span className="text-[var(--color-primary-text)]">专业配方研发平台</span>
            </h2>
            <p className="text-[var(--color-primary-text)]/70 leading-relaxed text-[15px] max-w-md">
              {BRAND_CONFIG.description}
            </p>
          </div>
        </div>
      </div>

      {/* ══ 右侧密码找回区 ══ */}
      <div className="flex-1 flex items-center justify-center p-[var(--space-apple-lg)] sm:p-8 bg-[var(--bg-tertiary)] dark:bg-neutral-950">
        <div className="w-full max-w-md mx-auto">
          {/* 移动端 Logo */}
          <div className="lg:hidden flex items-center gap-[var(--space-apple-sm)] mb-10 justify-center">
            <div className="w-12 h-12 rounded-[var(--radius-Apple-md)] bg-primary-container text-[var(--color-primary)] flex items-center justify-center shadow-lg">
              <Icon name="Beaker" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{BRAND_CONFIG.name}</h1>
              <p className="text-xs text-[var(--text-muted)]">{BRAND_CONFIG.fullName}</p>
            </div>
          </div>

          <div className="card p-8 sm:p-10">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-[var(--space-apple-md)]">
                <Link
                  to="/login"
                  className="p-2 rounded-[var(--radius-Apple-sm)] hover:bg-[var(--bg-tertiary)] dark:hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <Icon name="ArrowLeft" size={16} />
                </Link>
                <h2 className="h2 text-[var(--text-primary)]">忘记密码</h2>
              </div>
              <p className="text-[var(--text-muted)] text-sm">
                请输入您的邮箱地址，我们将发送密码重置链接到您的邮箱
              </p>
            </div>

            {error && (
              <div className="mb-6 p-[var(--space-apple-sm)] rounded-[var(--radius-Apple-md)] bg-danger-50 dark:bg-danger-300/20 border border-danger-200 dark:border-danger-800/60 text-danger-700 dark:text-danger-700 text-sm flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-[var(--radius-pill)] bg-danger-500 shrink-0" />
                {error}
              </div>
            )}

            {success ? (
              <div className="mb-6 p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] bg-[var(--color-primary-container)] border border-[var(--color-success-border)] dark:border-[var(--color-success)]/60 text-[var(--color-primary-text)] text-sm flex items-center gap-[var(--space-apple-sm)]">
                <div className="w-8 h-8 rounded-[var(--radius-pill)] bg-[var(--color-primary-container)] dark:bg-[var(--color-primary-container)]/30 flex items-center justify-center shrink-0">
                  <Check size={16} className="text-[var(--color-primary-text)]" />
                </div>
                <div>
                  <p className="font-medium">密码重置邮件已发送</p>
                  <p className="text-xs mt-1">请检查您的邮箱，点击邮件中的链接重置密码</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
                    邮箱地址
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">
                      <Mail size={16} />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      size="lg"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="请输入您的邮箱地址"
                      required
                      autoComplete="email"
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  loading={loading}
                  className="w-full"
                >
                  {loading ? '发送中...' : '发送重置链接'}
                </Button>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-[var(--border-color)]/60 text-center">
              <Link
                to="/login"
                className="text-sm text-primary hover:text-primary-hover transition-colors"
              >
                返回登录
              </Link>
            </div>
          </div>

          {/* 底部版权 */}
          <p className="mt-6 text-center text-xs text-[var(--text-muted)]">{BRAND_CONFIG.copyright}</p>
        </div>
      </div>
    </div>
  )
}
