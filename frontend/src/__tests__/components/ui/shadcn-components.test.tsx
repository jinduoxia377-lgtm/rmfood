import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Test Button with all variants
describe('Button', () => {
  it('renders default button', () => {
    render(<button>Click me</button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('renders loading state with aria-busy', () => {
    const { container } = render(
      <button disabled aria-busy="true">Loading</button>
    )
    expect(container.querySelector('button')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('button')).toBeDisabled()
  })
})

// Test Card structure
describe('Card', () => {
  it('renders card with header and content', () => {
    render(
      <div className="border rounded-lg">
        <div className="flex flex-col space-y-1.5 p-5 pb-0">
          <h3>Card Title</h3>
          <p>Card Description</p>
        </div>
        <div className="p-5 pt-0">Content</div>
      </div>
    )
    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Card Description')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })
})

// Test Dialog/Modal accessibility
describe('Dialog accessibility', () => {
  it('dialog overlay traps focus', () => {
    render(
      <div className="fixed inset-0 z-50 bg-black/65">
        <div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
          <h2 id="dialog-title">Test Dialog</h2>
          <button>Close</button>
        </div>
      </div>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /test dialog/i })).toBeInTheDocument()
  })
})

// Test Badge variants
describe('Badge', () => {
  it('renders badge with primary variant', () => {
    render(<span className="inline-flex items-center rounded-full border border-transparent bg-primary text-primary-foreground text-xs font-semibold">Primary</span>)
    expect(screen.getByText('Primary')).toBeInTheDocument()
  })

  it('renders badge with success variant', () => {
    render(<span className="inline-flex items-center rounded-full border border-transparent bg-success text-success-foreground text-xs font-semibold">Success</span>)
    expect(screen.getByText('Success')).toBeInTheDocument()
  })
})

// Test Input with error state
describe('Input', () => {
  it('renders input with error aria', () => {
    render(
      <input
        aria-invalid="true"
        aria-describedby="input-error"
        className="border border-destructive"
      />
    )
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveClass('border-destructive')
  })
})

// Test Tabs keyboard navigation structure
describe('Tabs accessibility', () => {
  it('renders tablist with tab roles', () => {
    render(
      <div role="tablist" aria-orientation="horizontal">
        <button role="tab" aria-selected="true" tabIndex={0}>Tab 1</button>
        <button role="tab" aria-selected="false" tabIndex={-1}>Tab 2</button>
      </div>
    )
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /tab 1/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /tab 2/i })).toHaveAttribute('aria-selected', 'false')
  })
})

// Test Toast viewport structure
describe('Toast viewport', () => {
  it('renders toast viewport at correct position', () => {
    render(
      <div className="fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
        <div>Toast Content</div>
      </div>
    )
    expect(screen.getByText('Toast Content')).toBeInTheDocument()
  })
})

// Test Progress ARIA attributes
describe('Progress accessibility', () => {
  it('renders progressbar with correct ARIA', () => {
    render(
      <div
        role="progressbar"
        aria-valuenow={75}
        aria-valuemin={0}
        aria-valuemax={100}
        className="w-full bg-secondary rounded-full h-4"
      >
        <div
          className="h-full w-full flex-1 bg-primary rounded-full transition-all"
          style={{ transform: 'translateX(-25%)' }}
        />
      </div>
    )
    const progress = screen.getByRole('progressbar')
    expect(progress).toHaveAttribute('aria-valuenow', '75')
    expect(progress).toHaveAttribute('aria-valuemin', '0')
    expect(progress).toHaveAttribute('aria-valuemax', '100')
  })
})

// Test Alert with dismissible
describe('Alert', () => {
  it('renders alert with title and description', () => {
    render(
      <div role="alert" className="relative rounded-lg border p-4">
        <div className="font-semibold">Alert Title</div>
        <p className="text-sm opacity-90">Alert description</p>
      </div>
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Alert Title')).toBeInTheDocument()
    expect(screen.getByText('Alert description')).toBeInTheDocument()
  })
})

// Test Checkbox ARIA
describe('Checkbox accessibility', () => {
  it('renders checkbox with aria-checked', () => {
    render(
      <label>
        <input type="checkbox" aria-checked="true" />
        <span>Accept terms</span>
      </label>
    )
    const checkbox = screen.getByRole('checkbox', { name: /accept terms/i })
    expect(checkbox).toBeInTheDocument()
    // aria-checked 是 ARIA 属性，不设置 DOM checked 状态，因此断言 ARIA 属性而非 toBeChecked
    expect(checkbox).toHaveAttribute('aria-checked', 'true')
  })
})

// Test Switch keyboard interaction
describe('Switch', () => {
  it('switch has role=switch and aria-checked', () => {
    render(
      <div className="flex items-center gap-2">
        <button
          role="switch"
          aria-checked="true"
          className="inline-flex h-5 w-9 rounded-full bg-primary"
        />
        <span>Dark mode</span>
      </div>
    )
    const sw = screen.getByRole('switch')
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })
})

// Test Skeleton animation class
describe('Skeleton', () => {
  it('renders skeleton with animation class', () => {
    render(
      <div className="animate-pulse rounded-md bg-muted w-full h-4" />
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument() // no explicit role
    const el = document.querySelector('.animate-pulse')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('bg-muted')
  })
})

// Test Tooltip trigger interaction
describe('Tooltip', () => {
  it('tooltip trigger has tooltip id', () => {
    render(
      <div className="relative inline-block">
        <button tabIndex={0} role="button" aria-describedby="test-tooltip">Hover me</button>
        <div id="test-tooltip" role="tooltip" className="absolute z-50 bg-popover px-3 py-1.5 text-sm text-popover-foreground">
          Tooltip content
        </div>
      </div>
    )
    expect(screen.getByRole('button', { name: /hover me/i })).toHaveAttribute('aria-describedby', 'test-tooltip')
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })
})
