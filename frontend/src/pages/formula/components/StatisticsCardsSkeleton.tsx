import { Skeleton } from '@/components/ui/Skeleton'

interface StatisticsCardsSkeletonProps {
  count?: number
}

export function StatisticsCardsSkeleton({ count = 4 }: StatisticsCardsSkeletonProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 space-y-3 hover:shadow-md transition-shadow"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                i === 0 ? 'bg-blue-50 dark:bg-blue-900/20' :
                i === 1 ? 'bg-emerald-50 dark:bg-emerald-900/20' :
                i === 2 ? 'bg-amber-50 dark:bg-amber-900/20' :
                'bg-purple-50 dark:bg-purple-900/20'
              }`}
            >
              <Skeleton width={22} height={22} radius={5} animationType="pulse" />
            </div>
            <Skeleton width={55} height={18} radius={9} animationType="pulse" />
          </div>

          {/* Value */}
          <Skeleton
            width={[70, 85, 95, 80][i]}
            height={32}
            animationType="pulse"
            className="!text-2xl font-bold"
          />

          {/* Description */}
          <Skeleton width="100%" height={12} radius={6} animationType="pulse" />

          {/* Trend Indicator */}
          {i > 0 && (
            <div className="flex items-center gap-1.5 pt-1">
              <Skeleton width={16} height={16} radius={4} animationType="pulse" />
              <Skeleton width={60} height={13} animationType="pulse" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
