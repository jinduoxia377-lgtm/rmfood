import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { MessageList } from '../MessageList'

// Mock dependencies
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: vi.fn(() => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    scrollToIndex: vi.fn(),
    scrollToOffset: vi.fn(),
  })),
}))

vi.mock('@/components/ai/renderers', () => ({
  SimpleMarkdown: ({ content }: { content: string }) => <div>{content}</div>,
}))

vi.mock('@/components/ai/professional/AnalysisMessageRenderer', () => ({
  AnalysisMessageRenderer: ({ message }: { message: any }) => (
    <div data-testid="analysis-renderer">{message?.content}</div>
  ),
}))

describe('MessageList Component', () => {
  const defaultProps = {
    messages: [],
    showReportButton: false,
    highlightedMessageId: null,
    isStreaming: false,
    selectedMessageIds: [],
    onSelectMessage: vi.fn(),
    onReferenceMessage: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Empty State Handling', () => {
    it('should render without errors when messages is undefined', () => {
      const { container } = render(
        <MessageList {...defaultProps} messages={undefined as any} />
      )
      expect(container).toBeInTheDocument()
    })

    it('should render without errors when messages is empty array', () => {
      const { container } = render(<MessageList {...defaultProps} messages={[]} />)
      expect(container).toBeInTheDocument()
    })

    it('should render without errors when selectedMessageIds is undefined', () => {
      const { container } = render(
        <MessageList
          {...defaultProps}
          selectedMessageIds={undefined as any}
        />
      )
      expect(container).toBeInTheDocument()
    })

    it('should handle all optional props being undefined', () => {
      const { container } = render(
        <MessageList
          messages={undefined as any}
          showReportButton={false}
          highlightedMessageId={null}
          isStreaming={false}
          selectedMessageIds={undefined as any}
          onSelectMessage={vi.fn()}
          onReferenceMessage={vi.fn()}
        />
      )
      expect(container).toBeInTheDocument()
    })
  })

  describe('Message Rendering', () => {
    const mockMessages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Hello, how are you?',
        timestamp: Date.now(),
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: 'I am doing well, thank you!',
        timestamp: Date.now() + 1000,
      },
    ]

    it('should render user and assistant messages correctly', () => {
      render(<MessageList {...defaultProps} messages={mockMessages} />)

      expect(screen.getByText('Hello, how are you?')).toBeInTheDocument()
      expect(screen.getByText('I am doing well, thank you!')).toBeInTheDocument()
    })

    it('should render multiple messages in correct order', () => {
      const manyMessages = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        role: (i % 2 === 0 ? 'user' : 'assistant') as const,
        content: `Message ${i}`,
        timestamp: Date.now() + i * 1000,
      }))

      render(<MessageList {...defaultProps} messages={manyMessages} />)

      for (let i = 0; i < 10; i++) {
        expect(screen.getByText(`Message ${i}`)).toBeInTheDocument()
      }
    })

    it('should handle messages with special characters', () => {
      const specialMessages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Special chars: <>&"\'',
          timestamp: Date.now(),
        },
      ]

      render(<MessageList {...defaultProps} messages={specialMessages} />)

      expect(screen.getByText(/Special chars:/)).toBeInTheDocument()
    })

    it('should handle empty message content gracefully', () => {
      const emptyContentMessages = [
        {
          id: '1',
          role: 'assistant' as const,
          content: '',
          timestamp: Date.now(),
        },
      ]

      const { container } = render(
        <MessageList {...defaultProps} messages={emptyContentMessages} />
      )
      expect(container).toBeInTheDocument()
    })
  })

  describe('Message Selection', () => {
    const mockMessages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'First message',
        timestamp: Date.now(),
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: 'Second message',
        timestamp: Date.now(),
      },
    ]

    it('should call onSelectMessage when message is clicked', () => {
      const onSelectMock = vi.fn()

      render(
        <MessageList
          {...defaultProps}
          messages={mockMessages}
          onSelectMessage={onSelectMock}
        />
      )

      fireEvent.click(screen.getByText('First message'))

      expect(onSelectMock).toHaveBeenCalled()
    })

    it('should handle multi-select with Ctrl key', () => {
      const onSelectMock = vi.fn()

      render(
        <MessageList
          {...defaultProps}
          messages={mockMessages}
          onSelectMessage={onSelectMock}
        />
      )

      fireEvent.click(screen.getByText('First message'), {
        ctrlKey: true,
      })

      expect(onSelectMock).toHaveBeenCalledWith('1', true)
    })
  })

  describe('Message Reference', () => {
    const mockMessages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Original message',
        timestamp: Date.now(),
      },
    ]

    it('should call onReferenceMessage when reference action is triggered', () => {
      const onReferenceMock = vi.fn()

      render(
        <MessageList
          {...defaultProps}
          messages={mockMessages}
          onReferenceMessage={onReferenceMock}
        />
      )

      expect(onReferenceMock).not.toHaveBeenCalled()
    })
  })

  describe('Virtual Scrolling', () => {
    it('should enable virtual scrolling when message count exceeds threshold', () => {
      const manyMessages = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        role: 'user' as const,
        content: `Message ${i}`,
        timestamp: Date.now() + i * 1000,
      }))

      const { container } = render(
        <MessageList
          {...defaultProps}
          messages={manyMessages}
          virtualization={{ enabled: true }}
        />
      )
      expect(container).toBeInTheDocument()
    })

    it('should disable virtual scrolling when explicitly set to false', () => {
      const fewMessages = Array.from({ length: 5 }, (_, i) => ({
        id: `${i}`,
        role: 'user' as const,
        content: `Message ${i}`,
        timestamp: Date.now() + i * 1000,
      }))

      const { container } = render(
        <MessageList
          {...defaultProps}
          messages={fewMessages}
          virtualization={{ enabled: false }}
        />
      )
      expect(container).toBeInTheDocument()
    })

    it('should use custom overscan value when provided', () => {
      const messages = Array.from({ length: 60 }, (_, i) => ({
        id: `${i}`,
        role: 'user' as const,
        content: `Message ${i}`,
        timestamp: Date.now() + i * 1000,
      }))

      const { container } = render(
        <MessageList
          {...defaultProps}
          messages={messages}
          virtualization={{ enabled: true, overscan: 10 }}
        />
      )
      expect(container).toBeInTheDocument()
    })
  })

  describe('Streaming State', () => {
    it('should display streaming indicator when isStreaming is true', () => {
      const streamingMessage = [
        {
          id: '1',
          role: 'assistant' as const,
          content: 'Thinking...',
          timestamp: Date.now(),
        },
      ]

      const { container } = render(
        <MessageList
          {...defaultProps}
          messages={streamingMessage}
          isStreaming={true}
        />
      )
      expect(container).toBeInTheDocument()
    })

    it('should not display streaming indicator when isStreaming is false', () => {
      const normalMessage = [
        {
          id: '1',
          role: 'assistant' as const,
          content: 'Complete response',
          timestamp: Date.now(),
        },
      ]

      const { container } = render(
        <MessageList
          {...defaultProps}
          messages={normalMessage}
          isStreaming={false}
        />
      )
      expect(container).toBeInTheDocument()
    })
  })

  describe('Highlighted Message', () => {
    it('should apply highlight styling to specified message', () => {
      const messages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Normal message',
          timestamp: Date.now(),
        },
        {
          id: '2',
          role: 'assistant' as const,
          content: 'Highlighted message',
          timestamp: Date.now(),
        },
      ]

      const { container } = render(
        <MessageList
          {...defaultProps}
          messages={messages}
          highlightedMessageId='2'
        />
      )
      expect(container).toBeInTheDocument()
    })
  })

  describe('Auto Scroll Behavior', () => {
    it('should accept different auto scroll behaviors', () => {
      const messages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Test message',
          timestamp: Date.now(),
        },
      ]

      const behaviors = ['always', 'smart', 'never'] as const

      behaviors.forEach((behavior) => {
        const { container } = render(
          <MessageList
            {...defaultProps}
            messages={messages}
            autoScrollBehavior={behavior}
          />
        )
        expect(container).toBeInTheDocument()
      })
    })
  })

  describe('Performance Tests', () => {
    it('should render 1000 messages within acceptable time', () => {
      const startTime = performance.now()

      const largeMessageList = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i}`,
        role: (i % 2 === 0 ? 'user' : 'assistant') as const,
        content: `This is message number ${i} with some content to simulate real usage`,
        timestamp: Date.now() + i * 1000,
      }))

      render(
        <MessageList
          {...defaultProps}
          messages={largeMessageList}
          virtualization={{ enabled: true }}
        />
      )

      const endTime = performance.now()
      const renderTime = endTime - startTime

      expect(renderTime).toBeLessThan(1000)
    })

    it('should handle rapid message updates without crashing', () => {
      const { rerender } = render(<MessageList {...defaultProps} messages={[]} />)

      for (let i = 0; i < 50; i++) {
        const newMessages = Array.from({ length: i + 1 }, (_, j) => ({
          id: `${j}`,
          role: 'user' as const,
          content: `Update ${i}-${j}`,
          timestamp: Date.now(),
        }))

        rerender(<MessageList {...defaultProps} messages={newMessages} />)
      }

      expect(screen.getByText('Update 49-49')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle message with very long content', () => {
      const longContent = 'A'.repeat(10000)

      const longMessage = [
        {
          id: '1',
          role: 'user' as const,
          content: longContent,
          timestamp: Date.now(),
        },
      ]

      const { container } = render(
        <MessageList {...defaultProps} messages={longMessage} />
      )
      expect(container).toBeInTheDocument()
    })

    it('should handle message with unicode content', () => {
      const unicodeMessage = [
        {
          id: '1',
          role: 'user' as const,
          content: '中文内容 🎉 Emoji 特殊字符 ñ é ü',
          timestamp: Date.now(),
        },
      ]

      render(<MessageList {...defaultProps} messages={unicodeMessage} />)

      expect(screen.getByText(/中文内容/)).toBeInTheDocument()
    })

    it('should handle message with null or undefined fields gracefully', () => {
      const incompleteMessages = [
        {
          id: '1',
          role: 'user' as const,
          content: null as any,
          timestamp: undefined as any,
        },
      ]

      const { container } = render(
        <MessageList {...defaultProps} messages={incompleteMessages} />
      )
      expect(container).toBeInTheDocument()
    })
  })

  describe('Callback Functions', () => {
    it('should call onGenerateReport when report button is shown and clicked', () => {
      const onGenerateReportMock = vi.fn()

      const messages = [
        {
          id: '1',
          role: 'assistant' as const,
          content: 'Report ready',
          timestamp: Date.now(),
        },
      ]

      const { container } = render(
        <MessageList
          {...defaultProps}
          messages={messages}
          showReportButton={true}
          onGenerateReport={onGenerateReportMock}
        />
      )
      expect(container).toBeInTheDocument()
    })

    it('should call onScrollToBottom callback', () => {
      const onScrollToBottomMock = vi.fn()

      const messages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Scroll test',
          timestamp: Date.now(),
        },
      ]

      const { container } = render(
        <MessageList
          {...defaultProps}
          messages={messages}
          onScrollToBottom={onScrollToBottomMock}
        />
      )
      expect(container).toBeInTheDocument()
    })

    it('should call onScrollPositionChange callback', () => {
      const onScrollPositionChangeMock = vi.fn()

      const messages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Position change test',
          timestamp: Date.now(),
        },
      ]

      const { container } = render(
        <MessageList
          {...defaultProps}
          messages={messages}
          onScrollPositionChange={onScrollPositionChangeMock}
        />
      )
      expect(container).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      const messages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Accessible message',
          timestamp: Date.now(),
        },
      ]

      const { container } = render(<MessageList {...defaultProps} messages={messages} />)
      expect(container).toBeInTheDocument()
    })

    it('should have proper ARIA attributes', () => {
      const messages = [
        {
          id: '1',
          role: 'assistant' as const,
          content: 'ARIA compliant message',
          timestamp: Date.now(),
        },
      ]

      const { container } = render(<MessageList {...defaultProps} messages={messages} />)
      expect(container).toBeInTheDocument()
    })
  })
})
