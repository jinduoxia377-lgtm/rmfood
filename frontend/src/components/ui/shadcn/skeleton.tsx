import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'circle' | 'rect'
  width?: string | number
  height?: string | number
  animate?: boolean
}

function Skeleton({
  className,
  variant = 'rect',
  width,
  height,
  animate = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted',
        variant === 'circle' && 'rounded-full',
        width && `w-[${width}]`,
        height && `h-[${height}]`,
        !animate && 'animate-none',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
