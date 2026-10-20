import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DialogInput } from '../DialogInput'

describe('DialogInput', () => {
  const mockOnChange = vi.fn()
  const mockOnSend = vi.fn()
  const mockOnFocus = vi.fn()
  const mockOnBlur = vi.fn()
  const mockOnKeyDown = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render with default props', () => {
    render(<DialogInput value="" onChange={mockOnChange} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveAttribute('placeholder', '输入您的消息...')
  })

  it('should display custom placeholder', () => {
    render(<DialogInput value="" onChange={mockOnChange} placeholder="自定义提示..." />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('placeholder', '自定义提示...')
  })

  it('should update value on change', () => {
    render(<DialogInput value="" onChange={mockOnChange} />)
    const textarea = screen.getByRole('textbox')
    
    fireEvent.change(textarea, { target: { value: 'test message' } })
    
    expect(mockOnChange).toHaveBeenCalledWith('test message')
  })

  it('should call onSend when Enter is pressed', () => {
    render(<DialogInput value="test" onChange={mockOnChange} onSend={mockOnSend} />)
    const textarea = screen.getByRole('textbox')
    
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    
    expect(mockOnSend).toHaveBeenCalledTimes(1)
  })

  it('should not call onSend when Shift+Enter is pressed', () => {
    render(<DialogInput value="test" onChange={mockOnChange} onSend={mockOnSend} />)
    const textarea = screen.getByRole('textbox')
    
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    
    expect(mockOnSend).not.toHaveBeenCalled()
  })

  it('should not call onSend when input is empty', () => {
    render(<DialogInput value="" onChange={mockOnChange} onSend={mockOnSend} />)
    const textarea = screen.getByRole('textbox')
    
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    
    expect(mockOnSend).not.toHaveBeenCalled()
  })

  it('should call onFocus and onBlur', () => {
    render(
      <DialogInput
        value=""
        onChange={mockOnChange}
        onFocus={mockOnFocus}
        onBlur={mockOnBlur}
      />
    )
    const textarea = screen.getByRole('textbox')
    
    fireEvent.focus(textarea)
    expect(mockOnFocus).toHaveBeenCalledTimes(1)
    
    fireEvent.blur(textarea)
    expect(mockOnBlur).toHaveBeenCalledTimes(1)
  })

  it('should call custom onKeyDown handler', () => {
    render(<DialogInput value="" onChange={mockOnChange} onKeyDown={mockOnKeyDown} />)
    const textarea = screen.getByRole('textbox')
    
    fireEvent.keyDown(textarea, { key: 'Tab' })
    
    expect(mockOnKeyDown).toHaveBeenCalledTimes(1)
  })

  it('should show character count', () => {
    render(<DialogInput value="hello" onChange={mockOnChange} showCharCount />)
    expect(screen.getByText('5/2000')).toBeInTheDocument()
  })

  it('should hide character count when showCharCount is false', () => {
    render(<DialogInput value="hello" onChange={mockOnChange} showCharCount={false} />)
    expect(screen.queryByText('5/2000')).not.toBeInTheDocument()
  })

  it('should disable input when disabled is true', () => {
    render(<DialogInput value="" onChange={mockOnChange} disabled />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
  })

  it('should disable input when isLoading is true', () => {
    render(<DialogInput value="" onChange={mockOnChange} isLoading />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
  })

  it('should show error for required validation', () => {
    render(
      <DialogInput
        value=""
        onChange={mockOnChange}
        validationRules={[{ type: 'required', message: '此字段为必填项' }]}
      />
    )
    
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '' } })
    
    expect(screen.getByText('此字段为必填项')).toBeInTheDocument()
  })

  it('should show error for minLength validation', () => {
    render(
      <DialogInput
        value="ab"
        onChange={mockOnChange}
        minLength={5}
      />
    )
    
    expect(screen.getByText('至少输入 5 个字符')).toBeInTheDocument()
  })

  it('should show error for maxLength validation', () => {
    const longText = 'a'.repeat(2001)
    render(
      <DialogInput
        value={longText}
        onChange={mockOnChange}
        maxLength={2000}
      />
    )
    
    expect(screen.getByText('最多输入 2000 个字符')).toBeInTheDocument()
  })

  it('should show error for email validation', () => {
    render(
      <DialogInput
        value="invalid-email"
        onChange={mockOnChange}
        validationRules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
      />
    )
    
    expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument()
  })

  it('should show error for pattern validation', () => {
    render(
      <DialogInput
        value="123abc"
        onChange={mockOnChange}
        validationRules={[{ type: 'pattern', value: '^[0-9]+$', message: '只能输入数字' }]}
      />
    )
    
    expect(screen.getByText('只能输入数字')).toBeInTheDocument()
  })

  it('should show error for custom validation', () => {
    render(
      <DialogInput
        value="test"
        onChange={mockOnChange}
        validationRules={[
          {
            type: 'custom',
            message: '不能包含test',
            validator: (value) => !value.includes('test'),
          },
        ]}
      />
    )
    
    expect(screen.getByText('不能包含test')).toBeInTheDocument()
  })

  it('should not show errors when validation passes', () => {
    render(
      <DialogInput
        value="valid@example.com"
        onChange={mockOnChange}
        validationRules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
      />
    )
    
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('should apply focused styles when focused', () => {
    render(<DialogInput value="" onChange={mockOnChange} />)
    // 边框类作用在 textarea 的直接父容器（flex items-center 圆角边框层）
    const container = screen.getByRole('textbox').parentElement

    fireEvent.focus(screen.getByRole('textbox'))
    
    expect(container).toHaveClass('border-primary-500')
  })

  it('should apply error styles when validation fails', () => {
    render(
      <DialogInput
        value=""
        onChange={mockOnChange}
        validationRules={[{ type: 'required', message: '必填' }]}
      />
    )
    // 边框类作用在 textarea 的直接父容器（flex items-center 圆角边框层）
    const container = screen.getByRole('textbox').parentElement

    expect(container).toHaveClass('border-error-500')
  })

  it('should auto resize height based on content', async () => {
    // jsdom 不计算布局，scrollHeight 恒为 0；mock 一个高度以验证 autoResize 逻辑
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 120,
    })

    render(<DialogInput value="" onChange={mockOnChange} autoResize />)
    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, { target: { value: 'line1\nline2\nline3\nline4\nline5' } })

    await waitFor(() => {
      // scrollHeight 被 mock 为 120，autoResize 应将高度设为 120px（而非默认 44px）
      expect(textarea.style.height).toBe('120px')
    })
  })

  it('should respect maxLength prop', () => {
    render(<DialogInput value="" onChange={mockOnChange} maxLength={100} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('maxlength', '100')
  })

  it('should support ref forwarding', () => {
    const ref = React.createRef<HTMLTextAreaElement>()
    render(<DialogInput value="" onChange={mockOnChange} ref={ref} />)
    
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
  })

  it('should not call onSend when validation fails', () => {
    render(
      <DialogInput
        value="ab"
        onChange={mockOnChange}
        onSend={mockOnSend}
        minLength={5}
      />
    )
    const textarea = screen.getByRole('textbox')
    
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    
    expect(mockOnSend).not.toHaveBeenCalled()
  })
})
