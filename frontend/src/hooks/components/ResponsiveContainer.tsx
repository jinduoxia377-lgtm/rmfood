/**
 * 响应式容器组件
 * 自动适配移动端/平板/桌面端布局，处理安全区域
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { useBreakpoint, useSafeArea } from '../useMobile'

interface ResponsiveContainerProps {
  children: React.ReactNode
  className?: string
  /** 是否启用安全区域适配 */
  safeArea?: boolean
  /** 最大内容宽度（桌面端） */
  maxWidth?: number
  /** 是否在桌面端固定宽度 */
  fixedWidth?: boolean
}

export default function ResponsiveContainer({
  children,
  className,
  safeArea = true,
  maxWidth = 1200,
  fixedWidth = true,
}: ResponsiveContainerProps) {
  const { isMobile, isTablet, isDesktop } = useBreakpoint()
  const insets = useSafeArea()

  const getMaxWidth = () => {
    if (!fixedWidth) return '100%'
    if (isDesktop) return maxWidth
    if (isTablet) return 960
    return '100%'
  }

  return (
    <div
      className={cn(
        'w-full mx-auto',
        isMobile ? 'px-4' : isTablet ? 'px-6' : 'px-8',
        className,
      )}
      style={{
        maxWidth: getMaxWidth(),
        paddingTop: safeArea && isMobile ? insets.top : undefined,
        paddingBottom: safeArea && isMobile ? insets.bottom : undefined,
        paddingLeft: safeArea && isMobile ? insets.left : undefined,
        paddingRight: safeArea && isMobile ? insets.right : undefined,
      }}
    >
      {children}
    </div>
  )
}
