export { useGenerationProgress } from './useGenerationProgress';
export { usePersistentState } from './usePersistentState';
export { useOperationFeedback } from './useOperationFeedback';
export { usePerformanceMetrics, useFPSMonitor, useResourceTiming } from './usePerformanceMetrics';

// useTheme 已迁移到 @/theme (Zustand 系统)，保留导出以兼容旧代码
// export { useTheme } from './useTheme';
// useThemePersistence 已废弃 — Zustand store 内置持久化
// export { useThemePersistence } from './useThemePersistence';
export { useMemoizedFn, useDebounce, useThrottle, useFormulaCache, usePrevious } from './useMemoOptimization';
export {
  useSmartPrefetch,
  useBackgroundSync,
  useAICache,
  usePrefetchRecommendations,
  useFormulaLinking,
} from './useSmartPrefetch';
export {
  useTour,
  useTooltip,
  useFeatureAnnouncements,
  useGlobalShortcuts,
  useOnboardingProgress,
} from './useOnboarding';
export { useUndoableState, useErrorRecovery, useActionHistory, useSessionRecovery } from './useErrorRecovery';
export {
  useKeyboardShortcuts,
  useGestures,
  useLongPress,
  usePinchZoom,
  FORMULA_GENERATION_SHORTCUTS,
} from './useShortcuts';
export {
  useDeviceInfo,
  useBreakpoint,
  useResponsiveValue,
  useTouchFriendly,
  usePullToRefresh,
  useSwipeNavigation,
} from './useMobileOptimization';

// Organizations Hooks
export {
  useOrganizations,
  type Organization,
  type OrganizationFilters,
  type CreateOrganizationRequest,
  type UpdateOrganizationRequest,
  type UseOrganizationsReturn,
} from './useOrganizations';

export {
  useOrganizationDetail,
  type Member,
  type Role,
  type Team,
  type UseOrganizationDetailReturn,
} from './useOrganizationDetail';

export {
  useBulkOperations,
  type ExportFormat,
  type Permission as BulkPermission,
  type OperationResult,
  type UseBulkOperationsReturn,
} from './useBulkOperations';

export { usePermissions, type Permission } from './usePermissions';
