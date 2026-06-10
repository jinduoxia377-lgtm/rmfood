/**
 * Analytics Error Boundary — 企业级错误边界组件
 *
 * 设计目标：
 * 1. 捕获子组件渲染期间的 JavaScript 错误
 * 2. 防止错误蔓延导致整个应用白屏
 * 3. 提供友好的错误恢复界面
 * 4. 支持错误日志记录和上报
 * 5. 支持开发环境下的详细错误信息显示
 */
import React, { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Bug, Home, Copy } from 'lucide-react'
import { logger } from '@/utils/safeLogger';


interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string
  showDetails: boolean
  copied: boolean
}

export class AnalyticsErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: this.generateErrorId(),
      showDetails: false,
      copied: false,
    }
  }

  // React 生命周期方法：捕获子组件异常
  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `ERR-${Date.now().toString(36).toUpperCase()}`,
    }
  }

  // 错误回调：用于日志记录和监控
  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('[AnalyticsErrorBoundary] 捕获到错误:', {
      errorId: this.state.errorId,
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    })

    this.setState({ errorInfo })

    // 调用外部错误处理函数（如 Sentry、LogRocket 等）
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // 开发环境下输出详细堆栈信息
    if (process.env.NODE_ENV === 'development') {
      console.groupCollapsed(`%c🔴 Analytics Error [${this.state.errorId}]`, 'color: red; font-weight: bold;')
      logger.error('Error:', error)
      logger.error('Component Stack:', errorInfo.componentStack)
      console.groupEnd()
    }
  }

  // 生成唯一错误ID
  private generateErrorId(): string {
    return `ERR-${Math.random().toString(36).substring(2, 11).toUpperCase()}`
  }

  // 重置错误状态（尝试恢复）
  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: this.generateErrorId(),
      showDetails: false,
      copied: false,
    })
  }

  // 切换详细信息的显示
  toggleDetails = () => {
    this.setState(prevState => ({ showDetails: !prevState.showDetails }))
  }

  // 复制错误信息到剪贴板
  copyErrorDetails = async () => {
    const { error, errorInfo, errorId } = this.state
    const details = `
错误ID: ${errorId}
时间: ${new Date().toISOString()}
URL: ${window.location.href}
错误消息: ${error?.message}
堆栈跟踪:
${error?.stack}
组件堆栈:
${errorInfo?.componentStack}
    `.trim()

    try {
      await navigator.clipboard.writeText(details)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch (err) {
      logger.error('复制失败:', err)
    }
  }

  override render() {
    // 如果没有错误，正常渲染子组件
    if (!this.state.hasError) {
      return this.props.children
    }

    // 如果提供了自定义 fallback，使用它
    if (this.props.fallback) {
      return this.props.fallback
    }

    // 默认的错误UI
    const { error, errorId, showDetails, copied } = this.state

    return (
      <div className="min-h-[400px] flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-red-200 dark:border-red-800 overflow-hidden">
          {/* 错误头部 */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-white">组件渲染出错</h2>
                <p className="text-sm text-white/80 mt-0.5">错误代码: {errorId}</p>
              </div>
            </div>
          </div>

          {/* 错误内容区 */}
          <div className="p-6 space-y-4">
            {/* 错误消息 */}
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm font-mono text-red-800 dark:text-red-300 break-all">
                {error?.message || '未知错误'}
              </p>
            </div>

            {/* 详细信息切换按钮 */}
            <button
              onClick={this.toggleDetails}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 transition-colors"
            >
              <Bug className="w-4 h-4" />
              {showDetails ? '隐藏' : '显示'}技术详情
            </button>

            {/* 详细错误信息 */}
            {showDetails && (
              <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-xs space-y-3">
                <div>
                  <div className="font-semibold text-text-muted mb-1">堆栈跟踪:</div>
                  <pre className="whitespace-pre-wrap text-red-700 dark:text-red-400 break-all">
                    {error?.stack}
                  </pre>
                </div>
                {this.state.errorInfo && (
                  <div>
                    <div className="font-semibold text-text-muted mb-1">组件堆栈:</div>
                    <pre className="whitespace-pre-wrap text-blue-700 dark:text-blue-400 break-all">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* 操作按钮组 */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                重试加载
              </button>

              <button
                onClick={this.copyErrorDetails}
                className={`px-4 py-2 border rounded-lg transition-colors flex items-center gap-2 ${
                  copied
                    ? 'bg-green-50 border-green-300 text-green-700'
                    : 'border-gray-300 dark:border-slate-700 text-text-primary hover:bg-gray-50'
                }`}
              >
                <Copy className="w-4 h-4" />
                {copied ? '已复制!' : '复制错误信息'}
              </button>

              <a
                href="/"
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 transition-colors flex items-center gap-2 ml-auto"
              >
                <Home className="w-4 h-4" />
                返回首页
              </a>
            </div>

            {/* 帮助文本 */}
            <div className="text-xs text-text-muted bg-gray-50 dark:bg-slate-800/50 rounded-lg p-3">
              <strong>提示:</strong> 如果问题持续存在，请复制错误信息并联系技术支持。
              {process.env.NODE_ENV === 'development' && (
                <> 请检查浏览器控制台获取更多调试信息。</>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

// 函数式包装器（方便在函数组件中使用）
export function withAnalyticsErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>,
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component'

  const ComponentWithErrorBoundary = (props: P) => (
    <AnalyticsErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </AnalyticsErrorBoundary>
  )

  ComponentWithErrorBoundary.displayName = `withAnalyticsErrorBoundary(${displayName})`

  return ComponentWithErrorBoundary
}

export default AnalyticsErrorBoundary
