/**
 * Error Boundary v2.0 - 统一导出核心 errorBoundary 系统
 */
import {
  ErrorBoundary as _ErrorBoundary,
  ErrorTrackingProvider,
  useErrorTracking,
} from '@/core/errorBoundary'

export {
  _ErrorBoundary as ErrorBoundary,
  ErrorTrackingProvider,
  useErrorTracking,
}

export default _ErrorBoundary
