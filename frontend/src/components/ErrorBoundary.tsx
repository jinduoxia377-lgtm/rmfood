/**
 * React Error Boundary — 全局错误捕获
 * 捕获子组件树中的渲染错误，展示友好的错误回退 UI
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home, Send, Info, Network, Code, Database } from 'lucide-react'
import { Button } from '@/components/ui'
import { logger } from '@/utils/safeLogger';


interface Props {
  children: ReactNode
  fallback?: ReactNode
  errorType?: string
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorTime: string
  errorUrl: string
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorTime: new Date().toISOString(),
      errorUrl: window.location.href,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorTime: new Date().toISOString(), errorUrl: window.location.href }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    this.logError(error, errorInfo)
  }

  logError = (error: Error, errorInfo: ErrorInfo) => {
    logger.error('[ErrorBoundary] Caught error:', error, errorInfo)

    // 构建错误日志对象
    const errorLog = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      componentStack: errorInfo.componentStack,
    }

    // 可以发送到服务器或存储在本地
    try {
      // 这里可以添加错误上报逻辑，例如发送到后端API
      // fetch('/api/error-report', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorLog)
      // })

      // 暂时存储在localStorage中
      const existingLogs = JSON.parse(localStorage.getItem('errorLogs') || '[]')
      existingLogs.push(errorLog)
      // 只保留最近10条错误日志
      if (existingLogs.length > 10) {
        existingLogs.shift()
      }
      localStorage.setItem('errorLogs', JSON.stringify(existingLogs))
    } catch (e) {
      logger.error('Error logging failed:', e)
    }
  }

  getErrorType = (error: Error): string => {
    if (error.message.includes('Network') || error.message.includes('fetch') || error.message.includes('axios')) {
      return '网络错误'
    }
    if (error.message.includes('Database') || error.message.includes('SQL') || error.message.includes('database')) {
      return '数据库错误'
    }
    if (error.message.includes('TypeError') || error.message.includes('Cannot')) {
      return '类型错误'
    }
    if (error.message.includes('Syntax')) {
      return '语法错误'
    }
    if (error.message.includes('RangeError')) {
      return '范围错误'
    }
    return '未知错误'
  }

  getErrorIcon = (errorType: string) => {
    switch (errorType) {
      case '网络错误':
        return <Network className="w-8 h-8 text-blue-500" />
      case '数据库错误':
        return <Database className="w-8 h-8 text-green-500" />
      case '类型错误':
      case '语法错误':
      case '范围错误':
        return <Code className="w-8 h-8 text-amber-500" />
      default:
        return <AlertTriangle className="w-8 h-8 text-danger-500" />
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleGoHome = () => {
    window.location.href = '/dashboard'
  }

  handleReportError = () => {
    const { error, errorInfo, errorTime, errorUrl } = this.state
    if (!error) return

    const errorType = this.getErrorType(error)
    const errorLog = {
      timestamp: errorTime,
      url: errorUrl,
      errorType,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
    }

    // 复制错误信息到剪贴板
    navigator.clipboard.writeText(JSON.stringify(errorLog, null, 2))
      .then(() => {
        alert('错误信息已复制到剪贴板，请粘贴给技术支持人员。')
      })
      .catch(err => {
        logger.error('复制失败:', err)
        alert('复制失败，请手动记录错误信息。')
      })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const error = this.state.error
      const errorType = error ? this.getErrorType(error) : '未知错误'
      const errorIcon = this.getErrorIcon(errorType)

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6 animate-fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-danger-50 dark:bg-danger-500/10">
              {errorIcon}
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">出了点问题</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                {errorType}：页面渲染时发生了意外错误。
                {error?.message && (
                  <span className="block mt-2 text-xs text-slate-400 dark:text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-left break-all">
                      {error.message}
                  </span>
                )}
                {this.state.errorInfo?.componentStack && (
                  <details className="mt-2 text-xs text-slate-400 dark:text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-left">
                    <summary className="cursor-pointer">查看组件堆栈</summary>
                    <pre className="whitespace-pre-wrap mt-2">{this.state.errorInfo.componentStack}</pre>
                  </details>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="secondary"
                icon={<RefreshCw className="w-4 h-4" />}
                onClick={this.handleRetry}
              >
                重试
              </Button>
              <Button
                variant="primary"
                icon={<Home className="w-4 h-4" />}
                onClick={this.handleGoHome}
              >
                回到工作台
              </Button>
              <Button
                variant="ghost"
                icon={<Send className="w-4 h-4" />}
                onClick={this.handleReportError}
              >
                报告错误
              </Button>
            </div>

            <div className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              <p>错误发生时间: {new Date(this.state.errorTime).toLocaleString()}</p>
              <p>当前页面: {this.state.errorUrl}</p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
