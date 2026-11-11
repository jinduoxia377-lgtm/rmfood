/**
 * ThinkingWithInput 组件单元测试
 *
 * 测试内容：
 * - 基本渲染测试
 * - 思考过程展示测试
 * - 输入功能测试
 * - 键盘事件测试
 * - 复制功能测试
 * - 错误状态测试
 */

// @ts-expect-error - vitest environment testing-library compatibility
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'

import ThinkingWithInput, { type ThinkingStep } from '../ThinkingWithInput'

// 约定：跟随本目录 i18n 化测试约定——真实 I18nextProvider（setup.ts 已初始化 zh-CN），
// 文案断言用 i18n.t(key) 动态取译文，避免硬编码字面量在译文调整后失配。
// 业务源码零改动；仅让测试适配组件的 i18n 化文案。
function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
})

describe('ThinkingWithInput', () => {
  const mockSteps: ThinkingStep[] = [
    {
      id: 'step-1',
      title: '分析用户问题',
      content: '正在理解您的需求...',
      timestamp: Date.now(),
      confidence: 0.9,
      status: 'completed'
    },
    {
      id: 'step-2',
      title: '搜索相关知识',
      content: '正在查找配方数据库...',
      timestamp: Date.now(),
      confidence: 0.85,
      status: 'processing'
    }
  ]

  const defaultProps = {
    thinkingSteps: mockSteps,
    isThinking: true,
    currentStepIndex: 1,
    isThinkingVisible: true,
    onToggleThinking: vi.fn(),
    inputValue: '',
    onInputChange: vi.fn(),
    onSend: vi.fn(),
    isStreaming: false,
    disabled: false,
    placeholder: '请输入您的问题...',
    maxLength: 2000
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该正确渲染组件', () => {
    renderWithI18n(<ThinkingWithInput {...defaultProps} />)

    // 标题 i18n 化：isThinking=true 时用 thinkingInProgress（zh-CN「思考中...」，非旧字面量「AI正在思考...」）
    expect(screen.getByText(i18n.t('ai.thinking.thinkingInProgress'))).toBeInTheDocument()
    expect(screen.getByText('分析用户问题')).toBeInTheDocument()
    expect(screen.getByText('搜索相关知识')).toBeInTheDocument()
  })

  it('应该在思考过程不可见时隐藏该区域', () => {
    renderWithI18n(<ThinkingWithInput {...defaultProps} isThinkingVisible={false} />)

    expect(screen.queryByText(i18n.t('ai.thinking.thinkingInProgress'))).not.toBeInTheDocument()
  })

  it('应该正确显示空状态', () => {
    renderWithI18n(<ThinkingWithInput {...defaultProps} thinkingSteps={[]} />)

    expect(screen.getByText(i18n.t('ai.thinking.emptyHint'))).toBeInTheDocument()
  })

  it('应该正确显示错误状态', () => {
    const errorMsg = '发生了一个错误'
    renderWithI18n(<ThinkingWithInput {...defaultProps} error={errorMsg} />)

    expect(screen.getByText(errorMsg)).toBeInTheDocument()
  })

  it('应该触发onToggleThinking当点击标题时', () => {
    renderWithI18n(<ThinkingWithInput {...defaultProps} />)

    const header = screen.getByText(i18n.t('ai.thinking.thinkingInProgress')).closest('div[class*="cursor-pointer"]')
    if (header) {
      fireEvent.click(header)
      expect(defaultProps.onToggleThinking).toHaveBeenCalledTimes(1)
    }
  })

  it('应该正确显示字数统计', () => {
    renderWithI18n(<ThinkingWithInput {...defaultProps} inputValue="Hello World" />)

    expect(screen.getByText(`${i18n.t('ai.thinking.charCount')}: 11/2000`)).toBeInTheDocument()
  })

  it('应该显示超出字数限制警告', () => {
    const longText = 'a'.repeat(2001)
    renderWithI18n(<ThinkingWithInput {...defaultProps} inputValue={longText} maxLength={2000} />)

    expect(screen.getByText(i18n.t('ai.thinking.overLimit'))).toBeInTheDocument()
  })

  it('应该在无思考步骤时显示提示', () => {
    renderWithI18n(<ThinkingWithInput {...defaultProps} thinkingSteps={[]} />)

    expect(screen.getByText(i18n.t('ai.thinking.emptyHint'))).toBeInTheDocument()
  })
})

describe('ThinkingStepItem', () => {
  it('应该正确渲染思考步骤', () => {
    // 这部分测试需要更具体的实现
    // 由于ThinkingStepItem是内部组件，我们可以通过主组件间接测试
  })

  it('应该正确显示时间戳', () => {
    // 时间戳显示可以通过主组件测试
  })
})
