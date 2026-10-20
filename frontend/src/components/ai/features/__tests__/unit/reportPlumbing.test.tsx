/**
 * Verifies the ChatState context plumbing added for the report generator:
 * ChatTab's "生成报告" button was previously a stub that only showed a
 * "not available" notice, because handleGenerateReport / setShowReportModal
 * were never exposed through ChatStateContext even though useReportGenerator
 * provides a fully working client-side report generator.
 */
import '@testing-library/jest-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as React from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ChatStateProvider } from '../../ChatStateProvider'
import { useChatState } from '../../ChatStateContext'
import type { ChatState } from '../../ChatStateContext'

/** Reads the live context shape and stamps it onto the container element. */
function Probe({ _: _ignored }: { _?: never }) {
  void _ignored;
  const ctx = useChatState() as Partial<ChatState>
  return React.createElement('div', {
    'data-testid': 'probe',
    'data-gen': typeof ctx.handleGenerateReport,
    'data-set-modal': typeof ctx.setShowReportModal,
    'data-report-modal': String(Boolean(ctx.showReportModal)),
    'data-generating': String(Boolean(ctx.isGeneratingReport)),
    'data-formula-count': String(ctx.formulaCount ?? 'missing'),
  })
}

function renderWithProviders() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(ChatStateProvider, null,
        React.createElement(Probe as React.ComponentType<object>)),
    ),
  )
}

describe('ChatStateContext report plumbing', () => {
  beforeEach(() => {
    // 静默掉 provider 内部的 react-query 网络调用
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
  })

  it('exposes handleGenerateReport as a callable function', () => {
    const { container } = renderWithProviders()
    const probe = container.querySelector('[data-testid="probe"]')!
    expect(probe.getAttribute('data-gen')).toBe('function')
  })

  it('exposes setShowReportModal so the report modal can be closed', () => {
    const { container } = renderWithProviders()
    const probe = container.querySelector('[data-testid="probe"]')!
    expect(probe.getAttribute('data-set-modal')).toBe('function')
  })

  it('starts with the report modal closed and not generating', () => {
    const { container } = renderWithProviders()
    const probe = container.querySelector('[data-testid="probe"]')!
    expect(probe.getAttribute('data-report-modal')).toBe('false')
    expect(probe.getAttribute('data-generating')).toBe('false')
  })
})
