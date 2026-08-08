/**
 * 骨架屏组件 (Skeleton Loading)
 *
 * 功能:
 * - 多种形状骨架屏（文本/头像/卡片/表格）
 * - 动画效果（脉冲/渐变shimmer）
 * - 自动适配暗色主题
 * - 可配置加载时间
 * - 支持多种动画类型
 *
 * @author RMFOOD Team
 */

import React from 'react'
import { cn } from '@/lib/utils'

export type SkeletonAnimationType = 'shimmer' | 'pulse' | 'wave' | 'none'

interface SkeletonProps {
  /** 宽度 */
  width?: string | number
  /** 高度 */
  height?: string | number
  /** 圆角 */
  radius?: string | number
  /** 是否显示动画 */
  animate?: boolean
  /** 动画类型 */
  animationType?: SkeletonAnimationType
  /** 自定义类名 */
  className?: string
  /** 是否显示为圆形 */
  circular?: boolean
}

export function Skeleton({
  width = '100%',
  height = '1em',
  radius = 4,
  animate = true,
  animationType = 'shimmer',
  className,
  circular = false,
}: SkeletonProps) {
  const animationClass = animate
    ? animationType === 'pulse'
      ? 'animate-pulse'
      : animationType === 'wave'
      ? 'animate-skeleton-wave'
      : animationType === 'shimmer'
      ? 'skeleton'
      : ''
    : ''

  return (
    <div
      className={cn(
        animationClass,
        !animate && 'bg-neutral-200 dark:bg-neutral-700',
        className,
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: circular ? '50%' : typeof radius === 'number' ? `${radius}px` : radius,
      }}
      aria-hidden="true"
    />
  )
}

// ── 预设骨架屏组件 ──

/** 文本行骨架 */
export function TextSkeleton({
  lines = 3,
  className,
  animationType = 'shimmer',
}: {
  lines?: number
  className?: string
  animationType?: SkeletonAnimationType
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="1em"
          width={i === lines - 1 ? '60%' : '100%'}
          className={cn(i === lines - 1 && 'w-3/5')}
          animationType={animationType}
        />
      ))}
    </div>
  )
}

/** 头像骨架 */
export function AvatarSkeleton({
  size = 40,
  className,
  animationType = 'shimmer',
}: {
  size?: number
  className?: string
  animationType?: SkeletonAnimationType
}) {
  return (
    <Skeleton
      width={size}
      height={size}
      circular
      className={cn(className)}
      animationType={animationType}
    />
  )
}

/** 卡片骨架 */
export function CardSkeleton({
  className,
  animationType = 'shimmer',
}: {
  className?: string
  animationType?: SkeletonAnimationType
}) {
  return (
    <div className={cn('p-4 bg-white dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 space-y-3', className)}>
      {/* 标题 */}
      <div className="flex items-center gap-3">
        <AvatarSkeleton size={40} animationType={animationType} />
        <div className="flex-1 space-y-2">
          <Skeleton height="0.9em" width="60%" animationType={animationType} />
          <Skeleton height="0.75em" width="40%" animationType={animationType} />
        </div>
      </div>

      {/* 内容 */}
      <TextSkeleton lines={2} animationType={animationType} />

      {/* 底部操作栏 */}
      <div className="flex gap-2 pt-2">
        <Skeleton height="2em" width="5em" radius={6} animationType={animationType} />
        <Skeleton height="2em" width="5em" radius={6} animationType={animationType} />
      </div>
    </div>
  )
}

/** 表格行骨架 */
export function TableRowSkeleton({
  columns = 4,
  className,
  animationType = 'shimmer',
}: {
  columns?: number
  className?: string
  animationType?: SkeletonAnimationType
}) {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton
            height="0.9em"
            width={i === 0 ? '30%' : i === columns - 1 ? '20%' : '100%'}
            animationType={animationType}
          />
        </td>
      ))}
    </tr>
  )
}

/** 配方列表页骨架屏 */
export function FormulaListSkeleton({
  count = 6,
  animationType = 'shimmer',
}: {
  count?: number
  animationType?: SkeletonAnimationType
}) {
  return (
    <div className="space-y-4 p-4">
      {/* 搜索和筛选栏 */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <Skeleton height="2.5em" width="300" radius={8} animationType={animationType} />
        <Skeleton height="2.5em" width="120" radius={8} animationType={animationType} />
        <Skeleton height="2.5em" width="120" radius={8} animationType={animationType} />
      </div>

      {/* 卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} animationType={animationType} />
        ))}
      </div>
    </div>
  )
}

/** 仪表盘骨架屏 */
export function DashboardSkeleton({
  animationType = 'shimmer',
}: {
  animationType?: SkeletonAnimationType
}) {
  return (
    <div className="space-y-6 p-6">
      {/* 统计卡片区 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between mb-3">
              <Skeleton height="2em" width="2em" radius={8} animationType={animationType} />
              <Skeleton height="1em" width="4em" animationType={animationType} />
            </div>
            <Skeleton height="2em" width="50%" animationType={animationType} />
          </div>
        ))}
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700 h-80">
          <Skeleton height="1em" width="8em" className="mb-4" animationType={animationType} />
          <div className="h-[calc(100%-2.5rem)]">
            <Skeleton height="100%" width="100%" radius={8} animationType={animationType} />
          </div>
        </div>
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700 h-80">
          <Skeleton height="1em" width="10em" className="mb-4" animationType={animationType} />
          <div className="h-[calc(100%-2.5rem)]">
            <Skeleton height="100%" width="100%" radius={8} animationType={animationType} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** 表单骨架 */
export function FormSkeleton({
  fields = 6,
  hasTextarea = true,
  animationType = 'shimmer',
}: {
  fields?: number
  hasTextarea?: boolean
  animationType?: SkeletonAnimationType
}) {
  return (
    <div className="space-y-4 p-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton height="0.875em" width="6em" animationType={animationType} />
          {hasTextarea && i === fields - 1 ? (
            <Skeleton height="100px" width="100%" radius={8} animationType={animationType} />
          ) : (
            <Skeleton height="2.5em" width="100%" radius={8} animationType={animationType} />
          )}
        </div>
      ))}
      <div className="flex gap-3 pt-2">
        <Skeleton height="2.5em" width="120" radius={8} animationType={animationType} />
        <Skeleton height="2.5em" width="100" radius={8} animationType={animationType} />
      </div>
    </div>
  )
}

/** 详情页骨架 */
export function DetailSkeleton({
  animationType = 'shimmer',
}: {
  animationType?: SkeletonAnimationType
}) {
  return (
    <div className="space-y-6 p-6">
      {/* 标题区 */}
      <div className="space-y-2">
        <Skeleton height="2rem" width="250" animationType={animationType} />
        <Skeleton height="1rem" width="380" animationType={animationType} />
      </div>

      {/* 操作栏 */}
      <div className="flex gap-3">
        <Skeleton height="2.25em" width="100" radius={8} animationType={animationType} />
        <Skeleton height="2.25em" width="100" radius={8} animationType={animationType} />
        <Skeleton height="2.25em" width="100" radius={8} animationType={animationType} />
      </div>

      {/* 内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-neutral-200 dark:border-neutral-700">
            <Skeleton height="1rem" width="80" className="mb-4" animationType={animationType} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton height="0.75em" width="60" animationType={animationType} />
                  <Skeleton height="1.25em" width="100" animationType={animationType} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-neutral-200 dark:border-neutral-700">
            <Skeleton height="1rem" width="80" className="mb-4" animationType={animationType} />
            <Skeleton height="1rem" width="100%" className="mb-2" animationType={animationType} />
            <Skeleton height="1rem" width="100%" className="mb-2" animationType={animationType} />
            <Skeleton height="1rem" width="75%" animationType={animationType} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-neutral-200 dark:border-neutral-700">
            <Skeleton height="1rem" width="80" className="mb-4" animationType={animationType} />
            <Skeleton height="1rem" width="100%" className="mb-2" animationType={animationType} />
            <Skeleton height="1rem" width="100%" className="mb-2" animationType={animationType} />
            <Skeleton height="1rem" width="75%" animationType={animationType} />
          </div>
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 border border-neutral-200 dark:border-neutral-700">
            <Skeleton height="1rem" width="80" className="mb-4" animationType={animationType} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton height="2em" width="2em" radius={8} animationType={animationType} />
                <div className="flex-1 space-y-1">
                  <Skeleton height="0.75em" width="75%" animationType={animationType} />
                  <Skeleton height="0.625em" width="50%" animationType={animationType} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 加载状态包装组件 ──

interface LoadingWrapperProps {
  loading: boolean
  children: React.ReactNode
  skeleton?: React.ReactNode
  /** 最小显示时间（避免闪烁） */
  minDuration?: number
  /** 动画类型 */
  animationType?: SkeletonAnimationType
}

export function LoadingWrapper({
  loading,
  children,
  skeleton,
  minDuration = 300,
}: LoadingWrapperProps) {
  const [showLoading, setShowLoading] = React.useState(loading)

  React.useEffect(() => {
    if (!loading) {
      // 延迟隐藏，避免闪烁
      const timer = setTimeout(() => setShowLoading(false), minDuration)
      return () => clearTimeout(timer)
    } else {
      setShowLoading(true)
    }
    return
  }, [loading, minDuration])

  if (showLoading) {
    return <>{skeleton || <DashboardSkeleton />}</>
  }

  return <>{children}</>
}

export default Skeleton
