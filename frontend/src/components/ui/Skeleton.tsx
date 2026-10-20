import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'circle' | 'rect'
  width?: string | number
  height?: string | number
  radius?: number
  animate?: boolean
  circular?: boolean
  animationType?: string
}

function Skeleton({
  className,
  variant = 'rect',
  width,
  height,
  radius,
  animate = true,
  circular,
  animationType: _animationType,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        (variant === 'circle' || circular) && 'rounded-full',
        width && `w-[${width}]`,
        height && `h-[${height}]`,
        !animate && 'animate-none',
        className,
      )}
      style={radius != null ? { borderRadius: radius } : undefined}
      {...props}
    />
  )
}

export { Skeleton }
