// shadcn/ui components — Radix UI primitives with RMFOOD design tokens

// Core primitives (Phase 1)
export { Button } from './button'
export type { ButtonProps } from './button'

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
} from './dialog'

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from './select'

export { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'

export { Checkbox } from './checkbox'

export { Switch } from './switch'

// Surface components (Phase 2)
export { Input } from './input'
export type { InputProps } from './input'

export { Textarea } from './textarea'
export type { TextareaProps } from './textarea'

export { Badge, badgeVariants } from './badge'
export type { BadgeProps } from './badge'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from './card'

export { Skeleton } from './skeleton'
export type { SkeletonProps } from './skeleton'

export { Progress } from './progress'

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip'

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from './toast'
export type { ToastProps, ToastActionElement } from './toast'

export { Alert, AlertTitle, AlertDescription } from './alert'
export type { AlertProps } from './alert'
