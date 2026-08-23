/**
 * RMFOOD 设计系统 — 组件统一导出
 *
 * Phase 4 策略: 保留旧组件 (backward compatible) + 新增 shadcn 组件
 * 页面可逐步迁移: import { Button } from '@/components/ui' 继续使用旧版
 * 新页面使用: import { Button } from '@/components/ui/shadcn'
 */

// ═══════════════════════════════════════════════════════════════
// 旧版组件 (保持向后兼容，现有页面无需修改)
// ═══════════════════════════════════════════════════════════════

// 基础 UI 组件
export { Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './Card'
export type { CardProps, CardVariant } from './Card'

export { StatCard } from './StatCard'
export type { StatCardProps, StatVariant as StatCardVariant } from './StatCard'

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
export { Toast, useToast, ToastProvider } from './Toast'
export { ToastContainer } from './ToastContainer'
export type { FeedbackMessage, FeedbackType } from './Toast'

export { default as ErrorBoundary } from './ErrorBoundary'

export { default as NotificationBell } from './NotificationBell'
export { default as CommandPalette } from './CommandPalette'
export { PageState } from './PageState'

// ═══════════════════════════════════════════════════════════════
// shadcn/ui 组件 (全新 — 可选迁移路径)
// 导入方式: import { Button } from '@/components/ui/shadcn'
// ═══════════════════════════════════════════════════════════════

export { Button as ShadcnButton, buttonVariants } from './shadcn/button'
export type { ButtonProps as ShadcnButtonProps } from './shadcn/button'

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './shadcn/dialog'

export {
  Select as ShadcnSelect,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from './shadcn/select'

export { Tabs as ShadcnTabs, TabsList as ShadcnTabsList, TabsTrigger as ShadcnTabsTrigger, TabsContent as ShadcnTabsContent } from './shadcn/tabs'

export { Checkbox as ShadcnCheckbox } from './shadcn/checkbox'

export { Switch as ShadcnSwitch } from './shadcn/switch'

export { Input as ShadcnInput } from './shadcn/input'

export { Textarea as ShadcnTextarea } from './shadcn/textarea'

export { Badge as ShadcnBadge, badgeVariants as shadcnBadgeVariants } from './shadcn/badge'

export {
  Card as ShadcnCard,
  CardHeader as ShadcnCardHeader,
  CardFooter as ShadcnCardFooter,
  CardTitle as ShadcnCardTitle,
  CardDescription as ShadcnCardDescription,
  CardContent as ShadcnCardContent,
} from './shadcn/card'

export { Skeleton as ShadcnSkeleton } from './shadcn/skeleton'

export { Progress as ShadcnProgress } from './shadcn/progress'

export { Tooltip as ShadcnTooltip, TooltipTrigger as ShadcnTooltipTrigger, TooltipContent as ShadcnTooltipContent, TooltipProvider as ShadcnTooltipProvider } from './shadcn/tooltip'

export {
  Toast as ShadcnToast,
  ToastProvider as ShadcnToastProvider,
  ToastViewport as ShadcnToastViewport,
  ToastTitle as ShadcnToastTitle,
  ToastDescription as ShadcnToastDescription,
  ToastClose as ShadcnToastClose,
  ToastAction as ShadcnToastAction,
} from './shadcn/toast'
export type { ToastProps as ShadcnToastProps } from './shadcn/toast'

export { Alert as ShadcnAlert, AlertTitle as ShadcnAlertTitle, AlertDescription as ShadcnAlertDescription } from './shadcn/alert'

export { DataTable, TableHeader, TableBody, TableRow, TableCell, TableCaption } from './shadcn/data-table'
export type { DataTableProps as ShadcnDataTableProps } from './shadcn/data-table'

export { OperationFeedback } from './shadcn/operation-feedback'
export type { OperationFeedbackProps } from './shadcn/operation-feedback'
