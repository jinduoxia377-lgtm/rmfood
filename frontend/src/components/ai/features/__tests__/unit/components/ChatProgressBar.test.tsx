/**
 * ChatProgressBar 组件测试
 *
 * 覆盖：
 * 1. idle 状态不渲染
 * 2. active 状态显示阶段文字、进度宽度与已生成字数
 * 3. done 后延迟淡出并最终隐藏（active → done 迁移）
 * 4. error 状态显示「生成失败」并延迟淡出
 *
 * 通过 mock ChatStateContext 的 useChatState 提供可控状态，
 * 避免挂载庞大的 ChatStateProvider。
 */
import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest'
import * as React from 'react'
import { render, screen, act } from '@testing-library/react'
import { ChatProgressBar } from '../../../components/pro/ChatProgressBar'
import { useChatState } from '../../../ChatStateContext'

vi.mock('../../../ChatStateContext', () => ({
  useChatState: vi.fn(),
}))

const mockUseChatState = useChatState as unknown as Mock

function mockChatState(overrides: Record<string, unknown> = {}) {
  mockUseChatState.mockReturnValue({
    streamProgress: 0,
    streamStageKey: '',
    streamChars: 0,
    streamStatus: 'idle',
    streamSteps: [
      { key: 'retrieval', status: 'pending' },
      { key: 'dialectics', status: 'pending' },
      { key: 'generating', status: 'pending' },
      { key: 'safety', status: 'pending' },
    ],
    ...overrides,
  })
}

describe('ChatProgressBar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('idle 状态不渲染任何内容', () => {
    mockChatState({ streamStatus: 'idle' })
    render(<ChatProgressBar />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('active 状态显示阶段文字与进度宽度', () => {
    mockChatState({
      streamStatus: 'active',
      streamProgress: 60,
      streamStageKey: 'ai.chat.progress.generatingAnswer',
      streamChars: 120,
      streamSteps: [
        { key: 'retrieval', status: 'done' },
        { key: 'dialectics', status: 'done' },
        { key: 'generating', status: 'active' },
        { key: 'safety', status: 'pending' },
      ],
    })
    render(<ChatProgressBar />)
    act(() => {
      vi.advanceTimersByTime(0)
    })

    const status = screen.getByRole('status')
    expect(status).toBeInTheDocument()
    // 阶段文字（真实 i18n 文案）
    expect(screen.getByText('正在生成回答…')).toBeInTheDocument()
    // 进度宽度 60%
    expect(status.querySelector('div[style*="width: 60%"]')).not.toBeNull()
    // 已生成字数
    expect(screen.getByText('已生成 120 字')).toBeInTheDocument()
  })

  it('done 后延迟淡出并最终隐藏', () => {
    mockChatState({ streamStatus: 'active' })
    const { rerender } = render(<ChatProgressBar />)
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    // active → done 迁移：先保留可见，600ms 后开始淡出，再 600ms 后隐藏
    mockChatState({ streamStatus: 'done', streamProgress: 100 })
    rerender(<ChatProgressBar />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(screen.getByRole('status').className).toContain('opacity-0')

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('error 状态显示「生成失败」并延迟淡出', () => {
    mockChatState({ streamStatus: 'active' })
    const { rerender } = render(<ChatProgressBar />)
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(screen.getByRole('status')).toBeInTheDocument()

    // active → error 迁移：立即展示「生成失败」，2000ms 后开始淡出
    mockChatState({ streamStatus: 'error', streamProgress: 60 })
    rerender(<ChatProgressBar />)
    expect(screen.getByText('生成失败')).toBeInTheDocument()
    expect(screen.getByRole('status').className).not.toContain('opacity-0')

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('status').className).toContain('opacity-0')

    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})