/**
 * ErrorBoundary - AI 模块专用错误边界
 *
 * 统一使用核心 errorBoundary.tsx 的全局错误处理系统。
 * GlobalErrorBoundary 和 ModuleErrorBoundary 已合并到 core/errorBoundary.tsx。
 */
export {
  ErrorBoundary,
  ErrorTrackingProvider,
  useErrorTracking,
  configureErrorHandler,
  reportError,
} from '@/core/errorBoundary'

// 别名导出以保持向后兼容
export { ErrorBoundary as GlobalErrorBoundary } from '@/core/errorBoundary'
export { ErrorBoundary as ModuleErrorBoundary } from '@/core/errorBoundary'
