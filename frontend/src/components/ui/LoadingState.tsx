/**
 * 加载状态组件
 *
 * @description 提供统一的加载状态展示
 * @version 1.0.0
 */

import React from'react'
import { Loader2, FileText, Sparkles } from'lucide-react'
import { Button, Progress } from'@/components/ui'

interface LoadingStateProps {
 type?:'spinner' |'progress' |'skeleton'
 message?: string
 subMessage?: string
 progress?: number
 remainingTime?: string
 onCancel?: () => void
}

export function LoadingState({
 type ='spinner',
 message,
 subMessage,
 progress,
 remainingTime,
 onCancel,
}: LoadingStateProps) {
 if (type ==='skeleton') {
 return <LoadingSkeleton />
 }

 if (type ==='progress' && progress !== undefined) {
 return (
 <div className="flex flex-col items-center justify-center py-12 px-4">
 <div className="relative w-24 h-24 mb-6">
 <div className="absolute inset-0 rounded-full border-4 border-primary-200 dark:border-primary-800" />
 <div
 className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"
 style={{ animationDuration:'1s' }}
 />
 <div className="absolute inset-0 flex items-center justify-center">
 <span className="text-h2 font-semibold text-primary-600">
 {progress}%
 </span>
 </div>
 </div>

 <h3 className="text-h2 font-semibold text-text-primary mb-2">
 {message ||'正在加载...'}
 </h3>

 {subMessage && (
 <p className="text-sm text-text-muted mb-4">
 {subMessage}
 </p>
 )}

 {remainingTime && (
 <p className="text-xs text-text-disabled mb-4">
 预计还需 {remainingTime}
 </p>
 )}

 <Progress value={progress} className="w-64 mb-4" />

 {onCancel && (
 <Button variant="ghost" size="sm" onClick={onCancel}>
 取消
 </Button>
 )}
 </div>
 )
 }

 return (
 <div className="flex flex-col items-center justify-center py-12 px-4">
 <Loader2 className="w-12 h-12 text-primary-500 animate-spin mb-4" />

 <h3 className="text-h2 font-semibold text-text-primary mb-2">
 {message ||'加载中...'}
 </h3>

 {subMessage && (
 <p className="text-sm text-text-muted mb-4">
 {subMessage}
 </p>
 )}

 {onCancel && (
 <Button variant="ghost" size="sm" onClick={onCancel} className="mt-2">
 取消
 </Button>
 )}
 </div>
 )
}

export function LoadingSkeleton() {
 return (
 <div className="space-y-4 p-4">
 <div className="animate-pulse">
 <div className="h-4 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-3/4 mb-4" />
 <div className="h-4 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-1/2 mb-4" />
 <div className="h-4 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-5/6" />
 </div>
 <div className="grid grid-cols-3 gap-4 mt-6">
 {[1, 2, 3].map((i) => (
 <div key={i} className="h-32 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded-lg animate-pulse" />
 ))}
 </div>
 </div>
 )
}

interface GeneratingStateProps {
 progress?: number
 message?: string
 remainingTime?: string
 onCancel?: () => void
}

export function GeneratingState({
 progress = 0,
 message,
 remainingTime,
 onCancel,
}: GeneratingStateProps) {
 return (
 <LoadingState
 type="progress"
 message={message ||'正在生成配方...'}
 subMessage="请稍候，这可能需要几秒钟"
 progress={progress}
 remainingTime={remainingTime}
 onCancel={onCancel}
 />
 )
}

interface ExportingStateProps {
 format?:'json' |'csv' |'pdf'
 onCancel?: () => void
}

export function ExportingState({ format ='csv', onCancel }: ExportingStateProps) {
 const formatLabels = {
 json:'JSON',
 csv:'CSV',
 pdf:'PDF',
 }

 return (
 <LoadingState
 type="spinner"
 message={`正在导出 ${formatLabels[format]} 文件...`}
 subMessage="请稍候"
 onCancel={onCancel}
 />
 )
}

export function FormulaGenerateSkeleton() {
 return (
 <div className="space-y-6 p-6">
 <div className="animate-pulse">
 <div className="h-6 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-1/2 mb-4" />
 <div className="h-4 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-3/4 mb-2" />
 <div className="h-4 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-1/3" />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {[1, 2, 3, 4, 5, 6].map((i) => (
 <div key={i} className="bg-[var(--card-bg-solid,#fff)] dark:bg-[var(--bg-surface,#0f172a)] rounded-xl p-4 border border-[var(--border-subtle,#f8fafc)] dark:border-[var(--border-subtle,#334155)] animate-pulse">
 <div className="flex items-center gap-3 mb-3">
 <div className="w-10 h-10 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded-lg" />
 <div className="flex-1 space-y-1">
 <div className="h-4 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-3/4" />
 <div className="h-3 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-1/2" />
 </div>
 </div>
 <div className="space-y-2">
 <div className="h-8 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded" />
 <div className="h-8 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded" />
 <div className="h-8 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded" />
 </div>
 <div className="flex gap-2 mt-3">
 <div className="flex-1 h-8 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded" />
 <div className="flex-1 h-8 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded" />
 </div>
 </div>
 ))}
 </div>
 </div>
 )
}

export function PanelSkeleton() {
 return (
 <div className="space-y-4 p-4 animate-pulse">
 <div className="flex items-center justify-between mb-4">
 <div className="h-5 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-1/3" />
 <div className="h-5 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-1/4" />
 </div>

 <div className="space-y-3">
 {[1, 2, 3].map((i) => (
 <div key={i} className="flex items-center gap-4 p-3 bg-[var(--bg-surface-container-low,#f8fafc)] dark:bg-[var(--bg-surface,#0f172a)] rounded-lg">
 <div className="w-12 h-12 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded-full" />
 <div className="flex-1 space-y-2">
 <div className="h-4 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-2/3" />
 <div className="h-3 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-1/2" />
 </div>
 <div className="w-20 h-8 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded" />
 </div>
 ))}
 </div>

 <div className="pt-4 border-t border-[var(--border-subtle,#e2e8f0)] dark:border-[var(--border-subtle,#334155)]">
 <div className="h-4 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded w-1/2 mb-3" />
 <div className="flex gap-3">
 <div className="flex-1 h-10 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded" />
 <div className="flex-1 h-10 bg-[var(--fill-secondary,#e2e8f0)] dark:bg-[var(--fill-secondary,#334155)] rounded" />
 </div>
 </div>
 </div>
 )
}
