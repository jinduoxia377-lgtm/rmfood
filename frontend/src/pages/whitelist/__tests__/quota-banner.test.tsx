import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import QuotaBanner from '../components/QuotaBanner'
import { whitelistApi } from '@/api/whitelist'

// 模拟 react-i18next：value 键返回格式化数字，其余返回 key（便于断言）
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === 'pages.whitelist.quota.value' && opts) return `${opts.remaining} / ${opts.total}`
      return key
    },
  }),
}))

vi.mock('@/api/whitelist', () => ({
  whitelistApi: {
    getQuota: vi.fn(),
  },
}))

describe('QuotaBanner — 白名单剩余名额', () => {
  it('成功时显示「剩余名额：{remaining} / {total}」', async () => {
    vi.mocked(whitelistApi.getQuota).mockResolvedValue({
      total: 500,
      approved: 3,
      remaining: 497,
      server_time: '2026-01-01T00:00:00Z',
    })
    render(<QuotaBanner />)
    await waitFor(() => expect(screen.getByText('497 / 500')).toBeTruthy())
    expect(screen.getByText('pages.whitelist.quota.label')).toBeTruthy()
  })

  it('失败（后端配额端点未实现 / 404）时渲染 null（fail-open，不显示虚假数据）', async () => {
    vi.mocked(whitelistApi.getQuota).mockRejectedValue(new Error('404 Not Found'))
    const { container } = render(<QuotaBanner />)
    await waitFor(() => expect(container.firstChild).toBeNull())
  })
})
