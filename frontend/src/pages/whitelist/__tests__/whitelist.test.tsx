import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react'
import { useCountdown, formatCountdown, getAnnouncedRemaining } from '../hooks/useCountdown'
import { ApplyFormCard } from '../components/ApplyFormCard'

// ── 模拟 react-i18next，避免测试环境初始化语言资源 ──
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (!opts) return key
      return key.replace(/\{\{\w+\}\}/g, String(opts[Object.keys(opts)[0]] ?? ''))
    },
  }),
}))

// ── 模拟人机验证码接口，避免组件挂载时发起真实网络请求 ──
vi.mock('@/api/whitelist', () => ({
  whitelistApi: {
    getCaptcha: vi.fn().mockResolvedValue({
      captcha_id: 'test-captcha-id',
      image_base64: 'data:image/png;base64,iVBORw0KGgo=',
      server_time: '2026-01-01T00:00:00Z',
    }),
  },
}))

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('computes days/hours/minutes/seconds from server deadline', () => {
    const deadline = new Date(Date.now() + 3 * 86400000 + 2 * 3600000 + 5 * 60000 + 10 * 1000).toISOString()
    const { result } = renderHook(() => useCountdown(deadline))
    expect(result.current.expired).toBe(false)
    expect(result.current.days).toBe(3)
    expect(result.current.hours).toBe(2)
    expect(result.current.minutes).toBe(5)
    expect(result.current.seconds).toBe(10)
  })

  it('returns expired for past deadline', () => {
    const deadline = new Date(Date.now() - 1000).toISOString()
    const { result } = renderHook(() => useCountdown(deadline))
    expect(result.current.expired).toBe(true)
    expect(result.current.totalMs).toBe(0)
  })

  it('returns empty when no deadline provided', () => {
    const { result } = renderHook(() => useCountdown(null))
    expect(result.current.expired).toBe(false)
    expect(result.current.totalMs).toBe(0)
  })

  it('ticks every second', () => {
    const deadline = new Date(Date.now() + 60000).toISOString()
    const { result } = renderHook(() => useCountdown(deadline))
    expect(result.current.minutes).toBe(1)
    expect(result.current.seconds).toBe(0)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.minutes).toBe(0)
    expect(result.current.seconds).toBe(59)
  })

  it('corrects immediately after visibility change', () => {
    const deadline = new Date(Date.now() + 60000).toISOString()
    const { result } = renderHook(() => useCountdown(deadline))
    act(() => {
      vi.advanceTimersByTime(5000)
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current.seconds).toBe(55)
  })
})

describe('formatCountdown / getAnnouncedRemaining', () => {
  it('formats hh:mm:ss with padding', () => {
    expect(formatCountdown({ days: 0, hours: 3, minutes: 5, seconds: 9, totalMs: 0, expired: false })).toBe('03:05:09')
    expect(formatCountdown({ days: 1, hours: 0, minutes: 0, seconds: 0, totalMs: 86400000, expired: false })).toBe('00:00:00')
  })

  it('returns announced minutes for screen readers', () => {
    expect(getAnnouncedRemaining({ days: 0, hours: 0, minutes: 5, seconds: 0, totalMs: 300000, expired: false })).toBe('5')
    expect(getAnnouncedRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, expired: true })).toBe('')
  })
})

describe('ApplyFormCard', () => {
  it('shows validation errors when submitting empty form', () => {
    render(<ApplyFormCard submitting={false} error={null} onSubmit={() => undefined} />)
    fireEvent.click(screen.getByRole('button', { name: 'pages.whitelist.form.submit' }))
    // 邮箱错误 + 隐私同意错误 + 人机验证码错误均以 role=alert 呈现
    const alerts = screen.getAllByRole('alert')
    expect(alerts.length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText('pages.whitelist.form.emailRequired')).toBeTruthy()
    expect(screen.getByText('pages.whitelist.form.consentRequired')).toBeTruthy()
    expect(screen.getByText('pages.whitelist.form.captchaRequired')).toBeTruthy()
  })

  it('calls onSubmit with trimmed values when valid', async () => {
    const onSubmit = vi.fn()
    render(<ApplyFormCard submitting={false} error={null} onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText(/pages\.whitelist\.form\.email/), {
      target: { value: '  user@example.com  ' },
    })
    fireEvent.click(screen.getByLabelText('pages.whitelist.form.consent'))

    // 等待验证码加载完成并填写
    const captchaInput = await screen.findByPlaceholderText('pages.whitelist.form.captchaPlaceholder')
    fireEvent.change(captchaInput, { target: { value: 'ABCD' } })
    fireEvent.click(screen.getByRole('button', { name: 'pages.whitelist.form.submit' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        captchaId: 'test-captcha-id',
        captchaAnswer: 'ABCD',
      }),
    )
  })
})