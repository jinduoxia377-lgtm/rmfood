/**
 * 🔒 P2-4: React ErrorBoundary 组件
 *
 * 统一导出核心 errorBoundary 系统中的 ErrorBoundary 类组件。
 * 所有组件应从此文件导入，避免重复实现。
 */
export {
  ErrorBoundary,
  ErrorTrackingProvider,
  useErrorTracking,
  configureErrorHandler,
  reportError,
  buildCapturedError,
  handleCapturedError,
  getRecentErrors,
  clearErrorQueue,
  getErrorStats,
} from '@/core/errorBoundary'
