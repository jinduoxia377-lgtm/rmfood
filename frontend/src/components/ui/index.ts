/**
 * RMFOOD 设计系统 — 组件统一导出
 */

// 基础 UI 组件
export { Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card'
export type { CardProps, CardVariant } from './Card'

export { Input } from './Input'
export type { InputProps, InputSize } from './Input'

export { Checkbox } from './Checkbox'
export type { CheckboxProps } from './Checkbox'

export { Textarea } from './Textarea'
export type { TextareaProps } from './Textarea'

export { Progress } from './Progress'
export type { ProgressProps } from './Progress'

export { Divider } from './Divider'
export type { DividerProps } from './Divider'

export { Slider } from './Slider'
export type { SliderProps } from './Slider'

export { Switch } from './Switch'
export type { SwitchProps } from './Switch'

export { Select } from './Select'
export type { SelectProps, SelectSize } from './Select'

export { Alert, AlertTitle, AlertDescription } from './Alert'
export type { AlertProps, AlertTitleProps, AlertDescriptionProps } from './Alert'

export { Badge } from './Badge'
export type { BadgeProps, BadgeVariant, BadgeSize } from './Badge'

export { Tooltip } from './Tooltip'

export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs'

export { Modal } from './Modal'

export { PageHeader } from './PageHeader'

// 通用组件（保持 Common.tsx 兼容性）
export { StatusBadge, EmptyState, Skeleton, Pagination } from './Common'

// 增强组件
export { EmptyStateIllustration } from './EmptyStateIllustration'
export type { EmptyStateType } from './EmptyStateIllustration'

export { TableSkeleton, ListSkeleton, DetailSkeleton, CardSkeleton, FormSkeleton, ChartSkeleton, FormulaCardSkeleton, FormulaListSkeleton } from './SkeletonPresets'

// 加载状态组件
export { LoadingSpinner, ProgressSpinner } from './LoadingSpinner'
export { LoadingState, FormulaGenerateSkeleton, PanelSkeleton } from './LoadingState'

// 功能组件 - 增强版通知系统 v2.0
export { Toast, ToastContainer, useToast, ToastProvider } from './Toast'
export type { FeedbackMessage, FeedbackType } from '@/utils/uiuxEnhancement'

export { default as ErrorBoundary } from './ErrorBoundary'

export { default as NotificationBell } from './NotificationBell'
export { default as CommandPalette } from './CommandPalette'
