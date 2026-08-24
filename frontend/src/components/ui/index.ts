/**
 * RMFOOD 设计系统 — 组件统一导出
 *
 * Phase 7: 所有核心组件已迁移至 shadcn/ui + Radix UI primitives
 * 品牌 Token 通过 CSS 变量映射 (见 src/styles/tokens/base.css)
 */

// ═══════════════════════════════════════════════════════════════
// Core Primitives (Radix UI)
// ═══════════════════════════════════════════════════════════════

export { Button } from './Button'
export type { ButtonProps } from './Button'

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
  Modal,
} from './Modal'

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from './Select'

export { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs'

export { Checkbox } from './Checkbox'

export { Switch } from './Switch'

// ═══════════════════════════════════════════════════════════════
// Surface Components (shadcn/ui)
// ═══════════════════════════════════════════════════════════════

export { Input } from './Input'
export type { InputProps } from './Input'

export { Textarea } from './Textarea'
export type { TextareaProps } from './Textarea'

export { Badge, badgeVariants } from './Badge'
export type { BadgeProps } from './Badge'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './Card'

export { Skeleton } from './Skeleton'
export type { SkeletonProps } from './Skeleton'

export { Progress } from './Progress'

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './Tooltip'

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  useToast,
} from './Toast'
export type { ToastProps, ToastActionElement } from './Toast'

export { Alert, AlertTitle, AlertDescription } from './Alert'
export type { AlertProps } from './Alert'

// ═══════════════════════════════════════════════════════════════
// Complex Widgets
// ═══════════════════════════════════════════════════════════════

export { OperationFeedback } from './OperationFeedback'
export type { OperationFeedbackProps } from './OperationFeedback'

export {
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableCaption,
  DataTable,
} from './shadcn/data-table'
export type { DataTableProps } from './shadcn/data-table'

// ═══════════════════════════════════════════════════════════════
// Business Components (unmigrated — retain original implementation)
// ═══════════════════════════════════════════════════════════════

export { StatCard } from './StatCard'
export type { StatCardProps, StatVariant as StatCardVariant } from './StatCard'

export { default as ErrorBoundary } from './ErrorBoundary'
export { default as NotificationBell } from './NotificationBell'
export { default as CommandPalette } from './CommandPalette'
export { PageState } from './PageState'
export { PageHeader } from './PageHeader'

export { StatusBadge, EmptyState, Pagination } from './Common'
export { EmptyStateIllustration } from './EmptyStateIllustration'
export type { EmptyStateType } from './EmptyStateIllustration'

export { TableSkeleton, ListSkeleton, DetailSkeleton, CardSkeleton, FormSkeleton, ChartSkeleton, FormulaCardSkeleton, FormulaListSkeleton } from './SkeletonPresets'

export { LoadingSpinner, ProgressSpinner } from './LoadingSpinner'
export { LoadingState, FormulaGenerateSkeleton, PanelSkeleton } from './LoadingState'

export { ToastContainer } from './ToastContainer'

export { Divider } from './Divider'
export type { DividerProps } from './Divider'

export { Slider } from './Slider'
export type { SliderProps } from './Slider'

export { FocusRing } from './FocusRing'
export { Icon } from './Icon'
export { LazyImage } from './LazyImage'
export { SaveStatusIndicator } from './SaveStatusIndicator'
export { ShortcutHelp } from './ShortcutHelp'
export { WebSocketStatus } from './WebSocketStatus'
export { ConditionalRender } from './ConditionalRender'

// Legacy aliases for backward compatibility
export type { FeedbackMessage, FeedbackType } from './Toast'

// ═══════════════════════════════════════════════════════════════
// Radix Themes Components (Phase 3)
// ═══════════════════════════════════════════════════════════════

export { Button as RadixButton, Badge as RadixBadge, Card as RadixCard, Text as RadixText } from './RadixComponents'
export type { ButtonProps as RadixButtonProps, BadgeProps as RadixBadgeProps, CardProps as RadixCardProps, TextProps as RadixTextProps } from './RadixComponents'

