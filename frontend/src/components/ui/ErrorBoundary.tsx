/**
 * Error Boundary v2.0 - 专业级错误处理组件
 *
 * 基于 UI/UX Pro Max 规范的用户友好错误处理
 *
 * 特性:
 * - 优雅的错误展示UI
 * - 错误详情折叠/展开
 * - 一键重试功能
 * - 错误上报（可配置）
 * - 开发环境详细信息
 * - 生产环境用户友好提示
 */

import React, { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Copy, Bug } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showErrorDetails?: boolean
  showRetry?: boolean
  customMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  showDetails: boolean
  isRetrying: boolean
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      isRetrying: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })

    console.error('[ErrorBoundary] ❌ 捕获到错误:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleRetry = () => {
    this.setState({ isRetrying: true })

    setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        showDetails: false,
        isRetrying: false,
      })
    }, 300)
  }

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
  }

  copyErrorToClipboard = async () => {
    const { error, errorInfo } = this.state
    if (!error) return

    const errorText = `
错误信息: ${error.message}
错误时间: ${new Date().toISOString()}
组件堆栈:
${errorInfo?.componentStack || 'N/A'}
调用栈:
${error.stack || 'N/A'}
    `.trim()

    try {
      await navigator.clipboard.writeText(errorText)
      alert('✅ 错误信息已复制到剪贴板')
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const isDev = process.env.NODE_ENV === 'development'

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6" role="alert">
          <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="bg-red-50 dark:bg-red-950/30 px-6 py-4 border-b border-red-100 dark:border-red-900/30">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-red-900 dark:text-red-200">
                    {this.props.customMessage || '应用程序遇到意外错误'}
                  </h2>
                  <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                    请不要担心，这个问题已被记录。您可以尝试刷新页面或点击重试按钮。
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4">
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {this.props.showRetry !== false && (
                  <button
                    onClick={this.handleRetry}
                    disabled={this.state.isRetrying}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 ${this.state.isRetrying ? 'animate-spin' : ''}`} />
                    {this.state.isRetrying ? '正在重试...' : '重试'}
                  </button>
                )}

                <button
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                >
                  刷新页面
                </button>

                {(isDev || this.props.showErrorDetails) && (
                  <>
                    <button
                      onClick={this.toggleDetails}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    >
                      {this.state.showDetails ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                      {this.state.showDetails ? '隐藏详情' : '显示详情'}
                    </button>

                    <button
                      onClick={this.copyErrorToClipboard}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                      复制错误
                    </button>
                  </>
                )}
              </div>

              {/* Error Details */}
              {(isDev || this.props.showErrorDetails) && this.state.showDetails && this.state.error && (
                <div className="bg-gray-900 dark:bg-black rounded-lg p-4 overflow-auto max-h-96">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700">
                    <Bug className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs font-mono font-semibold text-yellow-500 uppercase tracking-wider">
                      错误详情
                    </span>
                  </div>

                  {/* Error Message */}
                  <div className="mb-4">
                    <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">
                      错误消息
                    </div>
                    <pre className="text-sm font-mono text-red-400 whitespace-pre-wrap break-all">
                      {this.state.error.message}
                    </pre>
                  </div>

                  {/* Stack Trace */}
                  {this.state.error.stack && (
                    <div className="mb-4">
                      <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">
                        调用栈
                      </div>
                      <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-all opacity-80">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}

                  {/* Component Stack */}
                  {this.state.errorInfo?.componentStack && (
                    <div>
                      <div className="text-xs font-mono text-gray-400 uppercase tracking-wider mb-1">
                        组件堆栈
                      </div>
                      <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-all opacity-80">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Help Text */}
              <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                <p className="font-medium mb-2">需要帮助？</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>如果问题持续存在，请尝试清除浏览器缓存后重试</li>
                  <li>您可以将错误信息发送给技术支持团队</li>
                  <li>按 F12 打开开发者工具查看更多调试信息</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
