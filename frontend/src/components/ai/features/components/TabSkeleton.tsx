/**
 * TabSkeleton — 统一的 Tab 内容骨架屏组件
 *
 * 根据 tabType 展示不同布局的骨架加载状态，
 * 保持与对应 Tab 页面布局一致，避免内容跳变。
 *
 * @example
 * <Suspense fallback={<TabSkeleton tabType="chat" />}>
 *   <ChatTab />
 * </Suspense>
 */
import React, { memo } from 'react'
import { Skeleton as SkeletonComp } from '@/components/ui/Skeleton'

interface TabSkeletonProps {
  /** Tab 类型，决定骨架屏布局 */
  tabType?: 'chat' | 'generate' | 'safety' | 'synergy' | 'taste' | 'stability'
    | 'genetic' | 'peptide' | 'knowledge' | 'config' | 'agent'
  /** 自定义 className */
  className?: string
}

const LAYOUTS: Record<string, React.ReactNode> = {
  chat: (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <SkeletonComp width="2.5rem" height="2.5rem" variant="circle" />
        <div className="flex-1 space-y-2">
          <SkeletonComp width="80%" height="1rem" />
          <SkeletonComp width="100%" height="1rem" />
          <SkeletonComp width="60%" height="1rem" />
        </div>
      </div>
      <div className="flex items-start gap-3 flex-row-reverse">
        <SkeletonComp width="2.5rem" height="2.5rem" variant="circle" />
        <div className="flex-1 space-y-2">
          <SkeletonComp width="70%" height="1rem" />
          <SkeletonComp width="100%" height="1rem" />
        </div>
      </div>
      <div className="flex items-start gap-3">
        <SkeletonComp width="2.5rem" height="2.5rem" variant="circle" />
        <div className="flex-1 space-y-2">
          <SkeletonComp width="90%" height="1rem" />
          <SkeletonComp width="50%" height="1rem" />
        </div>
      </div>
      <SkeletonComp width="100%" height="3.5rem" radius={12} />
    </div>
  ),

  generate: (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <SkeletonComp width="100%" height="2rem" radius={8} />
        <SkeletonComp width="100%" height="2rem" radius={8} />
      </div>
      <SkeletonComp width="100%" height="8rem" radius={8} />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <SkeletonComp key={i} width="100%" height="10rem" radius={8} />
        ))}
      </div>
    </div>
  ),

  safety: (
    <div className="space-y-4">
      <SkeletonComp width="100%" height="12rem" radius={8} />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <SkeletonComp key={i} width="100%" height="5rem" radius={8} />
        ))}
      </div>
      <SkeletonComp width="100%" height="6rem" radius={8} />
    </div>
  ),

  synergy: (
    <div className="space-y-4">
      <SkeletonComp width="100%" height="16rem" radius={8} />
      <SkeletonComp width="100%" height="4rem" radius={8} />
    </div>
  ),

  taste: (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <SkeletonComp width="100%" height="2rem" radius={8} />
        <SkeletonComp width="100%" height="8rem" radius={8} />
        <SkeletonComp width="100%" height="3rem" radius={8} />
      </div>
      <SkeletonComp width="100%" height="20rem" radius={8} />
    </div>
  ),

  stability: (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <SkeletonComp width="100%" height="2rem" radius={8} />
        <SkeletonComp width="100%" height="6rem" radius={8} />
        <SkeletonComp width="100%" height="3rem" radius={8} />
      </div>
      <SkeletonComp width="100%" height="20rem" radius={8} />
    </div>
  ),

  genetic: (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <SkeletonComp key={i} width="100%" height="5rem" radius={8} />
        ))}
      </div>
      <SkeletonComp width="100%" height="14rem" radius={8} />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <SkeletonComp key={i} width="100%" height="6rem" radius={8} />
        ))}
      </div>
    </div>
  ),

  peptide: (
    <div className="space-y-4">
      <SkeletonComp width="100%" height="3rem" radius={8} />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonComp key={i} width="100%" height="8rem" radius={8} />
        ))}
      </div>
    </div>
  ),

  knowledge: (
    <div className="space-y-3">
      <SkeletonComp width="60%" height="1.5rem" radius={6} />
      <SkeletonComp width="100%" height="10rem" radius={8} />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <SkeletonComp key={i} width="100%" height="3rem" radius={6} />
        ))}
      </div>
    </div>
  ),

  config: (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <SkeletonComp key={i} width="8rem" height="2.5rem" radius={8} />
        ))}
      </div>
      <SkeletonComp width="100%" height="16rem" radius={8} />
    </div>
  ),

  agent: (
    <div className="space-y-4">
      <SkeletonComp width="100%" height="3rem" radius={8} />
      <SkeletonComp width="100%" height="12rem" radius={8} />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <SkeletonComp key={i} width="100%" height="6rem" radius={8} />
        ))}
      </div>
    </div>
  ),
}

export const TabSkeleton = memo<TabSkeletonProps>(({
  tabType = 'chat',
  className = '',
}) => {
  const layout = LAYOUTS[tabType] ?? LAYOUTS.chat
  return (
    <div
      className={`p-4 animate-pulse ${className}`}
      aria-hidden="true"
      aria-label="加载中"
    >
      {layout}
    </div>
  )
})

TabSkeleton.displayName = 'TabSkeleton'
