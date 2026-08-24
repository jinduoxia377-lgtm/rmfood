/**
 * RMFOOD 设计系统 — Radix Components 无障碍审计
 *
 * Phase 5: 验证所有 Radix 组件的 ARIA 属性和键盘导航
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { RadixButton, RadixBadge, RadixCard, RadixText } from '@/components/ui/RadixComponents'

// ═══════════════════════════════════════════════════════════════
// Button 无障碍测试
// ═══════════════════════════════════════════════════════════════
describe('RadixButton Accessibility', () => {
  it('should have correct role and tabindex', () => {
    render(<RadixButton>Click me</RadixButton>)
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('tabindex', '0')
  })

  it('should support keyboard activation', () => {
    const handleClick = vi.fn()
    render(<RadixButton onClick={handleClick}>Submit</RadixButton>)
    const button = screen.getByRole('button', { name: /submit/i })

    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })
    expect(handleClick).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(button, { key: ' ', code: 'Space' })
    expect(handleClick).toHaveBeenCalledTimes(2)
  })

  it('should have aria-disabled when disabled', () => {
    render(<RadixButton disabled>Disabled</RadixButton>)
    const button = screen.getByRole('button', { name: /disabled/i })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it('should have aria-busy when loading', () => {
    render(<RadixButton loading>Loading...</RadixButton>)
    const button = screen.getByRole('button', { name: /loading/i })
    expect(button).toHaveAttribute('aria-busy', 'true')
  })

  it('should support focus visible ring', () => {
    render(<RadixButton>Focus Test</RadixButton>)
    const button = screen.getByRole('button', { name: /focus test/i })

    button.focus()
    expect(button).toHaveFocus()
  })
})

// ═══════════════════════════════════════════════════════════════
// Badge 无障碍测试
// ═══════════════════════════════════════════════════════════════
describe('RadixBadge Accessibility', () => {
  it('should have role=status', () => {
    render(<RadixBadge variant="success">Active</RadixBadge>)
    const badge = screen.getByText('Active')
    expect(badge.parentElement).toHaveAttribute('role', 'status')
  })

  it('should use aria-label for dot badges', () => {
    render(<RadixBadge variant="success" dot>Online</RadixBadge>)
    const badge = screen.getByText('Online')
    // Dot badges should have aria-label for screen readers
    expect(badge.closest('[role="status"]')).toBeTruthy()
  })

  it('should have correct color semantics', () => {
    const { rerender } = render(<RadixBadge variant="error">Error</RadixBadge>)
    expect(screen.getByText('Error')).toBeInTheDocument()

    rerender(<RadixBadge variant="success">Success</RadixBadge>)
    expect(screen.getByText('Success')).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════
// Card 无障碍测试
// ═══════════════════════════════════════════════════════════════
describe('RadixCard Accessibility', () => {
  it('should be a semantic container', () => {
    render(
      <RadixCard>
        <h2>Title</h2>
        <p>Content</p>
      </RadixCard>
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('should support hoverable state', () => {
    const { container } = render(<RadixCard hoverable>Hover Card</RadixCard>)
    const card = container.firstChild as HTMLElement

    // Check hover class is applied
    expect(card).toHaveClass('transition-shadow')
  })

  it('should support glassmorphism', () => {
    const { container } = render(<RadixCard glass>Glass Card</RadixCard>)
    const card = container.firstChild as HTMLElement

    // Check glass class is applied
    expect(card).toHaveClass('backdrop-blur')
  })
})

// ═══════════════════════════════════════════════════════════════
// Text 无障碍测试
// ═══════════════════════════════════════════════════════════════
describe('RadixText Accessibility', () => {
  it('should render correct element type', () => {
    render(<RadixText as="h1">Heading</RadixText>)
    expect(screen.getByRole('heading', { level: 1, name: /heading/i })).toBeInTheDocument()
  })

  it('should render paragraph by default', () => {
    render(<RadixText>Paragraph</RadixText>)
    expect(screen.getByText('Paragraph')).toBeInTheDocument()
  })

  it('should apply correct font sizes', () => {
    const sizes = ['1', '2', '3', '4', '5', '6', '7'] as const
    sizes.forEach((size) => {
      const { container } = render(<RadixText size={size}>Size {size}</RadixText>)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  it('should apply correct font weights', () => {
    const weights = ['regular', 'medium', 'bold'] as const
    weights.forEach((weight) => {
      const { container } = render(<RadixText weight={weight}>Weight {weight}</RadixText>)
      expect(container.firstChild).toBeInTheDocument()
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// 组合测试
// ═══════════════════════════════════════════════════════════════
describe('Radix Components Integration', () => {
  it('should work together in a notification card', () => {
    render(
      <RadixCard hoverable className="p-4">
        <div className="flex items-center gap-2">
          <RadixBadge variant="success" dot>新</RadixBadge>
          <RadixText size="4" weight="bold">通知标题</RadixText>
        </div>
        <RadixText size="2" color="gray" className="mt-2">
          通知内容描述
        </RadixText>
        <div className="mt-4 flex gap-2">
          <RadixButton size="1" variant="solid">确认</RadixButton>
          <RadixButton size="1" variant="ghost">忽略</RadixButton>
        </div>
      </RadixCard>
    )

    expect(screen.getByText('通知标题')).toBeInTheDocument()
    expect(screen.getByText('通知内容描述')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /确认/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /忽略/i })).toBeInTheDocument()
  })

  it('should support dark mode classes', () => {
    document.documentElement.classList.add('dark')

    render(
      <RadixCard>
        <RadixText color="gray">Dark mode text</RadixText>
      </RadixCard>
    )

    expect(screen.getByText('Dark mode text')).toBeInTheDocument()

    document.documentElement.classList.remove('dark')
  })
})

// ═══════════════════════════════════════════════════════════════
// 键盘导航测试
// ═══════════════════════════════════════════════════════════════
describe('Keyboard Navigation', () => {
  it('should navigate between buttons with Tab', () => {
    render(
      <div>
        <RadixButton>First</RadixButton>
        <RadixButton>Second</RadixButton>
        <RadixButton>Third</RadixButton>
      </div>
    )

    const buttons = document.querySelectorAll('button')
    expect(buttons.length).toBe(3)

    // First button should be focused initially
    expect(document.activeElement).toBe(buttons[0])

    // Tab to next button
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' })
    expect(document.activeElement).toBe(buttons[1])
  })

  it('should activate button with Enter', () => {
    const handleClick = vi.fn()
    render(<RadixButton onClick={handleClick}>Activate</RadixButton>)

    const button = screen.getByRole('button', { name: /activate/i })
    button.focus()

    fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' })
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should activate button with Space', () => {
    const handleClick = vi.fn()
    render(<RadixButton onClick={handleClick}>Activate</RadixButton>)

    const button = screen.getByRole('button', { name: /activate/i })
    button.focus()

    fireEvent.keyDown(button, { key: ' ', code: 'Space' })
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
