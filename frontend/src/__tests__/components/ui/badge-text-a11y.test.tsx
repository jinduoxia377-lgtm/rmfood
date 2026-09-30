/**
 * RMFOOD 设计系统 — Badge / Text 无障碍审计
 *
 * ── 变更历史（T-R1）───────────────────────────────────────────────────
 * 原文件名 radix-components-a11y.test.tsx，导入 { RadixButton, RadixBadge, RadixCard, RadixText }，
 * 但 `RadixComponents.tsx` **从未导出过 RadixButton / RadixCard** —— 该测试自建立起
 * 就因 ImportError 无法运行（且本机 vitest 环境异常，从未被执行）。
 *
 * 随 T-R1（移除 @radix-ui/themes，包装层改项目原生实现）一并修正：
 *   · 仅测试真实存在的导出：RadixBadge、RadixText；
 *   · 保留原测试对 Badge 的无障碍契约断言（role="status"、可访问名称）；
 *   · 补齐颜色语义随主题令牌变化的行为断言。
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { RadixBadge, RadixText } from '@/components/ui/RadixComponents'

// ═══════════════════════════════════════════════════════════════
// Badge 无障碍
// ═══════════════════════════════════════════════════════════════
describe('RadixBadge Accessibility', () => {
  it('should expose role=status', () => {
    render(<RadixBadge variant="success">Active</RadixBadge>)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should provide an accessible name from string children', () => {
    render(<RadixBadge variant="success">Active</RadixBadge>)
    expect(screen.getByRole('status')).toHaveAccessibleName('Active')
  })

  it('should mark decorative dot and icon as aria-hidden', () => {
    const { container } = render(
      <RadixBadge variant="success" dot icon={<span data-testid="ic">i</span>}>
        Online
      </RadixBadge>
    )
    const dot = container.querySelector('.rounded-full[aria-hidden="true"]')
    expect(dot).toBeTruthy()
    expect(container.querySelector('[data-testid="ic"]')?.parentElement).toHaveAttribute('aria-hidden', 'true')
  })

  it('should render every variant', () => {
    for (const v of ['default', 'success', 'warning', 'error', 'info'] as const) {
      const { unmount } = render(<RadixBadge variant={v}>{v}</RadixBadge>)
      expect(screen.getByText(v)).toBeInTheDocument()
      unmount()
    }
  })

  it('should use semantic token classes per variant (not dynamic class names)', () => {
    const { container, unmount } = render(<RadixBadge variant="success">ok</RadixBadge>)
    expect((container.firstChild as HTMLElement).className).toContain('bg-success-container')
    unmount()
    const { container: c2 } = render(<RadixBadge variant="error">no</RadixBadge>)
    expect((c2.firstChild as HTMLElement).className).toContain('bg-error-container')
  })
})

// ═══════════════════════════════════════════════════════════════
// Text 无障碍与排版
// ═══════════════════════════════════════════════════════════════
describe('RadixText Accessibility', () => {
  it('should render heading when as="h1"', () => {
    render(<RadixText as="h1">Heading</RadixText>)
    expect(screen.getByRole('heading', { level: 1, name: /heading/i })).toBeInTheDocument()
  })

  it('should render paragraph by default', () => {
    const { container } = render(<RadixText>Paragraph</RadixText>)
    expect(container.firstChild?.nodeName).toBe('P')
  })

  it('should map all legacy size steps to a font-size', () => {
    for (const size of ['1', '2', '3', '4', '5', '6', '7'] as const) {
      const { container, unmount } = render(<RadixText size={size}>S{size}</RadixText>)
      const el = container.firstChild as HTMLElement
      expect(el.style.fontSize).toContain('var(--text-')
      unmount()
    }
  })

  it('should map weight to numeric font-weight', () => {
    const expected = { regular: '400', medium: '500', bold: '700' } as const
    for (const w of ['regular', 'medium', 'bold'] as const) {
      const { container, unmount } = render(<RadixText weight={w}>W</RadixText>)
      expect((container.firstChild as HTMLElement).style.fontWeight).toBe(expected[w])
      unmount()
    }
  })

  it('should resolve semantic colors via tokens and leave auto/mauve inherited', () => {
    const { container, unmount } = render(<RadixText color="gray">g</RadixText>)
    expect((container.firstChild as HTMLElement).style.color).toContain('var(--text-secondary)')
    unmount()
    const { container: c2 } = render(<RadixText color="auto">a</RadixText>)
    expect((c2.firstChild as HTMLElement).style.color).toBe('')
  })

  it('should forward caller style over computed defaults', () => {
    const { container } = render(<RadixText size="2" style={{ fontSize: '42px' }}>x</RadixText>)
    expect((container.firstChild as HTMLElement).style.fontSize).toBe('42px')
  })
})
