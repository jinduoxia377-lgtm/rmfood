/**
 * ErrorBoundary - 错误边界组件 (v6.0)
 *
 * 功能特性：
 * 1. 捕获子组件渲染期间的 JavaScript 错误
 * 2. 显示友好的错误回退 UI
 * 3. 提供"重试"按钮恢复功能
 * 4. 支持自定义错误展示组件
 * 5. 记录错误日志（可集成错误监控系统）
 *
 * 使用层级：
 * - 全局级别：包裹整个 ChatTab
 * - 模块级别：包裹 MessageList、FormulaPanel 等
 * - 组件级别：包裹第三方库调用
 *
 * @version 6.0.0
 * @lastUpdated 2026-05-10
 */

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react'
import { Button } from '@/components/ui'
import { logger } from '@/utils/safeLogger'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode)
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  level?: 'global' | 'module' | 'component'
  moduleName?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorId: string
}

interface DefaultFallbackProps {
  error: Error
  resetError: () => void
  level: 'global' | 'module' | 'component'
  moduleName?: string
}

/**
 * DefaultFallback - 默认的错误回退 UI
 */
function DefaultFallback({ error, resetError, level, moduleName }: DefaultFallbackProps) {
  const isGlobal = level === 'global'
  const title = isGlobal ? '应用程序出错' : `${moduleName || '模块'}加载失败`
  const description = isGlobal
    ? '很抱歉，发生了意外错误。您可以尝试刷新页面或重试。'
    : `该${moduleName || '部分'}暂时无法正常工作，但不会影响其他功能。`

  return (
    <div className={`flex flex-col items-center justify-center p-${isGlobal ? '16' : '8'} text-center`}>
      <div className={`w-${isGlobal ? '20' : '16'} h-${isGlobal ? '20' : '16'} rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4`}>
        <AlertTriangle className={`w-${isGlobal ? '10' : '8'} h-${isGlobal ? '10' : '8'} text-red-600 dark:text-red-400`} />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        {description}
      </p>

      {/* 错误详情（仅开发环境显示） */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mb-6 text-left w-full max-w-lg">
          <summary className="cursor-pointer text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <Bug className="w-3 h-3 inline mr-1" />
            技术细节（仅开发模式）
          </summary>
          <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-red-600 dark:text-red-400 overflow-auto max-h-40">
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        </details>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={resetError}
          className="inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          重试
        </Button>

        {!isGlobal && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
          >
            刷新页面
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * ErrorBoundary - React 错误边界类组件
 *
 * 捕获子组件树中的 JavaScript 错误，
 * 记录错误并显示回退 UI。
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorId: '',
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `err-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, level, moduleName } = this.props

    // 记录错误日志
    logger.error(`[ErrorBoundary:${level || 'component'}] ❌ ${moduleName || '未知模块'} 发生错误:`, {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })

    // 调用自定义错误处理回调
    if (onError) {
      onError(error, errorInfo)
    }

    // TODO: 可在此处集成错误监控系统（如 Sentry、LogRocket）
    // Example:
    // Sentry.captureException(error, { extra: { errorInfo, level, moduleName } })
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorId: '',
    })
  }

  override render(): ReactNode {
    const { hasError, error } = this.state
    const { children, fallback, level = 'component', moduleName } = this.props

    if (hasError && error) {
      // 自定义回退 UI
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback(error, this.resetError)
        }
        return fallback
      }

      // 默认回退 UI
      return (
        <DefaultFallback
          error={error}
          resetError={this.resetError}
          level={level}
          moduleName={moduleName}
        />
      )
    }

    return children
  }
}

// ===== 预配置的 ErrorBoundary 实例 =====

/**
 * GlobalErrorBoundary - 全局级别的错误边界
 * 用于包裹整个应用或主要功能模块
 */
export function GlobalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="global"
      moduleName="智能对话系统"
      onError={(error, errorInfo) => {
        console.error('[GlobalErrorBoundary] 全局错误:', error, errorInfo)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * ModuleErrorBoundary - 模块级别的错误边界
 * 用于包裹独立的功能模块（如 MessageList、FormulaPanel）
 */
export function ModuleErrorBoundary({
  children,
  moduleName,
}: {
  children: ReactNode
  moduleName: string
}) {
  return (
    <ErrorBoundary
      level="module"
      moduleName={moduleName}
    >
      {children}
    </ErrorBoundary>
  )
}

// ===== 默认导出 =====
export { ErrorBoundary }
export default ErrorBoundary
