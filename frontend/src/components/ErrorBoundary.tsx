/**
 * 🔒 P2-4: React ErrorBoundary 组件
 *
 * 错误边界用于捕获子组件树中的 JavaScript 错误，
 * 防止整个应用白屏，只显示错误的部分。
 *
 * 特性:
 * - 捕获渲染阶段、生命周期、构造函数中的错误
 * - 不捕获：事件处理器、异步代码、定时器、SSR
 * - 提供友好的错误提示 UI
 * - 支持错误上报（如 Sentry）
 * - 支持重置和回退
 */
import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { logger } from '@/utils/safeLogger'

interface Props {
  children: ReactNode
  /** 错误上报函数（可选） */
  onErrorReport?: (error: Error, errorInfo: ErrorInfo) => void
  /** 自定义 Fallback UI */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
  /** 包装的类名 */
  className?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
}

export class ErrorBoundary extends Component<Props, State> {
  private static readonly MAX_ERROR_ID_LENGTH = 8

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // 生成唯一错误 ID，便于日志追踪
    const errorId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`
    return {
      hasError: true,
      error,
      errorId,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })

    // 🔒 P2-4: 错误上报（开发环境输出到控制台）
    console.error('🔴 ErrorBoundary caught an error:', error, errorInfo)

    if (this.props.onErrorReport) {
      this.props.onErrorReport(error, errorInfo)
    }

    // 🔒 P2-4: 可扩展：上报到 Sentry / Datadog / 自建服务
    if (import.meta.env.PROD) {
      this.reportToMonitoringService(error, errorInfo)
    }
  }

  private reportToMonitoringService(error: Error, errorInfo: ErrorInfo): void {
    // 🔒 P2-4: 扩展点 - 接入 Sentry / Bugsnag / 自建服务
    // 例：Sentry.captureException(error, { extra: errorInfo })
    const sentry = (window as { Sentry?: { captureException: (err: unknown, info?: { componentStack?: string | null }) => void } }).Sentry;
    if (sentry) {
      sentry.captureException(error, { componentStack: errorInfo.componentStack ?? undefined });
    }
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    })
  }

  private copyErrorToClipboard = (): void => {
    const { error, errorInfo, errorId } = this.state
    if (!error) return

    const errorText = [
      `Error ID: ${errorId}`,
      `Error: ${error.name}: ${error.message}`,
      `Stack: ${error.stack}`,
      `Component Stack: ${errorInfo?.componentStack}`,
    ].join('\n\n')

    navigator.clipboard.writeText(errorText).then(() => {
      alert('错误详情已复制到剪贴板')
    }).catch(() => {
      // Fallback
      logger.log('错误详情:', errorText)
    })
  }

  render(): ReactNode {
    const { hasError, error, errorId } = this.state
    const { children, fallback, className } = this.props

    if (hasError) {
      // 🔒 使用自定义 Fallback
      if (fallback) {
        return typeof fallback === 'function'
          ? fallback(error!, this.handleReset)
          : fallback
      }

      // 🔒 默认错误 UI
      return (
        <div
          className={`error-boundary-container ${className || ''}`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            padding: '32px',
            background: '#FFF0F0',
            borderRadius: '12px',
            border: '1px solid #FFD0D0',
          }}
        >
          <div
            style={{
              fontSize: '48px',
              marginBottom: '16px',
            }}
          >
            ⚠️
          </div>

          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#DC2626',
              margin: '0 0 8px 0',
            }}
          >
            页面遇到了一些问题
          </h2>

          <p
            style={{
              fontSize: '14px',
              color: '#7f1d1d',
              margin: '0 0 16px 0',
              textAlign: 'center',
              maxWidth: '400px',
            }}
          >
            抱歉，页面在加载时发生了错误。请尝试刷新或返回上一页。
          </p>

          {errorId && (
            <p
              style={{
                fontSize: '12px',
                color: '#DC2626',
                fontFamily: 'monospace',
                margin: '0 0 16px 0',
              }}
            >
              错误 ID: {errorId}
            </p>
          )}

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <Button
              onClick={this.handleReset}
              variant="outline"
              size="sm"
            >
              重试
            </Button>

            <Button
              onClick={() => window.location.href = '/'}
              variant="outline"
              size="sm"
            >
              返回首页
            </Button>

            <Button
              onClick={this.copyErrorToClipboard}
              variant="ghost"
              size="sm"
            >
              复制错误信息
            </Button>
          </div>

          {import.meta.env.DEV && error && (
            <details
              style={{
                marginTop: '24px',
                width: '100%',
                maxWidth: '600px',
                textAlign: 'left',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 500,
                  color: '#B91C1C',
                  marginBottom: '8px',
                }}
              >
                🔧 开发模式：错误详情
              </summary>
              <pre
                style={{
                  fontSize: '11px',
                  background: '#1f2937',
                  color: '#f9fafb',
                  padding: '16px',
                  borderRadius: '8px',
                  overflow: 'auto',
                  maxHeight: '300px',
                  margin: 0,
                }}
              >
                {error.name}: {error.message}
                {'\n\n'}
                {error.stack}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return children
  }
}

/**
 * 🔒 P2-4: 异步错误处理 Hook
 *
 * 在异步函数中使用 try-catch 并更新 ErrorBoundary
 *
 * 用法:
 * ```tsx
 * const { error, run } = useAsyncError()
 *
 * const handleSubmit = async () => {
 *   run(async () => {
 *     await api.save(data)
 *   })
 * }
 * ```
 */
export function useAsyncError() {
  const [error, setError] = React.useState<Error | null>(null)

  const run = React.useCallback((promise: Promise<unknown>) => {
    setError(null)
    return promise.catch((e) => {
      setError(e instanceof Error ? e : new Error(String(e)))
      throw e
    })
  }, [])

  const clearError = React.useCallback(() => setError(null), [])

  return { error, run, clearError }
}

/**
 * 🔒 P2-4: 包裹组件的错误边界 HOC
 *
 * 用法:
 * ```tsx
 * const SafeAIChat = withErrorBoundary(AIChatComponent, {
 *   fallback: <div>AI 组件加载失败</div>,
 *   onErrorReport: (error) => logError(error),
 * })
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
    onErrorReport?: (error: Error, errorInfo: ErrorInfo) => void
    className?: string
  },
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary
        fallback={options.fallback}
        onErrorReport={options.onErrorReport}
        className={options.className}
      >
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}
