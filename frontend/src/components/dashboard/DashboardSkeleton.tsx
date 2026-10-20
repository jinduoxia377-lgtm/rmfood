/**
 * Dashboard 全局骨架屏
 * 当统计数据、趋势数据全部未加载时展示
 */
import { cn } from '@/lib/utils'

export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8', className)}>
      {/* 欢迎横幅骨架 */}
      <div className="rounded-xl bg-neutral-100 dark:bg-neutral-800 h-20 animate-pulse" />

      {/* 统计卡片行 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="skeleton h-4 w-16 rounded" />
              <div className="skeleton w-8 h-8 rounded-lg" />
            </div>
            <div className="skeleton h-8 w-20 rounded" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
        ))}
      </div>

      {/* 图表区：趋势图(2列) + 饼图(1列) + 柱图(1列) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2">
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="skeleton h-5 w-32 rounded" />
              <div className="skeleton h-8 w-20 rounded-lg" />
            </div>
            <div className="relative h-[200px] w-full">
              <div className="absolute left-0 top-0 bottom-6 w-8 space-y-3 flex flex-col justify-between">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-3 w-6 rounded ml-auto" />
                ))}
              </div>
              <div className="ml-10 h-[168px] flex items-end gap-3 pb-6 border-t border-[var(--border-subtle,#e2e8f0)] dark:border-[var(--border-subtle,#334155)]">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 skeleton rounded-t-md"
                    style={{ height: `${40 + i * 8}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4 pt-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="skeleton w-3 h-3 rounded-full" />
                  <div className="skeleton h-3 w-12 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="card p-5 space-y-4">
            <div className="skeleton h-5 w-28 rounded" />
            <div className="h-[200px] flex items-center justify-center">
              <div className="skeleton w-32 h-32 rounded-full" />
            </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="card p-5 space-y-4">
            <div className="skeleton h-5 w-28 rounded" />
            <div className="h-[200px] flex items-center justify-end gap-2 pb-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton rounded-t-md w-8"
                  style={{ height: `${30 + i * 15}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 底部区域：快捷操作 + 最近配方 + 最近实验 + 待办/动态 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 快捷操作骨架 */}
        <div className="card p-5 space-y-3">
          <div className="skeleton h-5 w-24 rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton w-9 h-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-2.5 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* 最近配方骨架 */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="skeleton h-5 w-20 rounded" />
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-2.5 w-1/2 rounded" />
                </div>
                <div className="skeleton h-5 w-12 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* 最近实验骨架 */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3">
            <div className="skeleton h-5 w-20 rounded" />
          </div>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="skeleton h-3 w-3/4 rounded" />
                  <div className="skeleton h-2.5 w-1/2 rounded" />
                </div>
                <div className="skeleton h-5 w-12 rounded-full shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* 待办/动态骨架 */}
        <div className="card p-5 space-y-3">
          <div className="skeleton h-5 w-24 rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton w-6 h-6 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3 w-3/4 rounded" />
                <div className="skeleton h-2.5 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI智能洞察骨架（当用户开启该卡片时占位） */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
            <div className="space-y-1.5">
              <div className="skeleton h-4 w-28 rounded" />
              <div className="skeleton h-3 w-40 rounded" />
            </div>
          </div>
          <div className="skeleton h-5 w-10 rounded-full" />
        </div>
        {/* 分类标签骨架 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-6 w-16 rounded-full shrink-0" />
          ))}
        </div>
        {/* 内容列表骨架 */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 space-y-3">
              <div className="flex items-start gap-3">
                <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="skeleton h-4 w-2/3 rounded" />
                    <div className="skeleton h-5 w-14 rounded-full" />
                  </div>
                  <div className="skeleton h-3 w-full rounded" />
                  <div className="flex items-center gap-3">
                    <div className="skeleton h-2 w-20 rounded-full" />
                    <div className="skeleton h-3 w-10 rounded" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
