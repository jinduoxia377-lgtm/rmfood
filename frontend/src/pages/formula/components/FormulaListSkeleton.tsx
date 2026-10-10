import { Skeleton } from '@/components/ui/Skeleton'

export function FormulaListSkeleton() {
  return (
    <div className="max-w-[1520px] mx-auto space-y-8 px-4 lg:px-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton width={200} height={32} animationType="pulse" />
          <Skeleton width={400} height={16} animationType="pulse" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton width={100} height={36} radius={8} animationType="pulse" />
          <Skeleton width={120} height={36} radius={8} animationType="pulse" />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left Sidebar - Filter Panel */}
        <div className="space-y-6">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 space-y-5">
            <div className="flex items-center justify-between">
              <Skeleton width={80} height={20} animationType="pulse" />
              <Skeleton width={60} height={24} radius={12} animationType="pulse" />
            </div>

            {/* Search Input */}
            <div className="space-y-2">
              <Skeleton width={70} height={14} animationType="pulse" />
              <Skeleton width="100%" height={38} radius={8} animationType="pulse" />
            </div>

            {/* Status Filters */}
            <div className="space-y-2">
              <Skeleton width={50} height={14} animationType="pulse" />
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton width={16} height={16} radius={4} circular animationType="pulse" />
                    <Skeleton width={80 + (i * 10)} height={16} animationType="pulse" />
                  </div>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Skeleton width={70} height={14} animationType="pulse" />
              <Skeleton width="100%" height={38} radius={8} animationType="pulse" />
              <Skeleton width="100%" height={38} radius={8} animationType="pulse" />
            </div>

            {/* Category Tree */}
            <div className="space-y-2">
              <Skeleton width={60} height={14} animationType="pulse" />
              <div className="space-y-1.5 pl-2">
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <Skeleton width={90 + (i * 15)} height={14} animationType="pulse" />
                    {i === 1 && (
                      <div className="ml-4 mt-1.5 space-y-1.5">
                        {[1, 2].map((j) => (
                          <Skeleton key={j} width={70 + (j * 10)} height={14} animationType="pulse" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="space-y-6">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900">
            <div className="flex items-center gap-3">
              <Skeleton width={140} height={36} radius={8} animationType="pulse" />
              <Skeleton width={100} height={36} radius={8} animationType="pulse" />
              <Skeleton width={100} height={36} radius={8} animationType="pulse" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton width={32} height={32} radius={6} animationType="pulse" />
              <Skeleton width={32} height={32} radius={6} animationType="pulse" />
            </div>
          </div>

          {/* Statistics Cards */}
          <StatisticsCardsSkeleton />

          {/* Table Skeleton */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-50 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                <tr>
                  {[40, 150, 100, 100, 100, 120, 140].map((w, i) => (
                    <th key={i} className="px-4 py-3">
                      <Skeleton width={w} height={14} animationType="pulse" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                    <td className="px-4 py-3">
                      <Skeleton width={20} height={14} animationType="pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton width={120 + (i % 3) * 20} height={16} animationType="pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton width={70} height={24} radius={12} animationType="pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton width={50} height={14} animationType="pulse" />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Skeleton width={60} height={14} animationType="pulse" />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <Skeleton width={90} height={14} animationType="pulse" />
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <Skeleton width={110} height={14} animationType="pulse" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Skeleton */}
          <div className="flex items-center justify-between pt-4">
            <Skeleton width={180} height={14} animationType="pulse" />
            <div className="flex items-center gap-2">
              {[32, 32, 32, 40, 32, 32].map((w, i) => (
                <Skeleton key={i} width={w} height={32} radius={6} animationType="pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatisticsCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <Skeleton width={24} height={24} radius={6} animationType="pulse" />
            <Skeleton width={50} height={18} radius={9} animationType="pulse" />
          </div>
          <Skeleton width={80 + (i * 15)} height={28} animationType="pulse" />
          <Skeleton width="100%" height={12} radius={6} animationType="pulse" />
        </div>
      ))}
    </div>
  )
}

export { StatisticsCardsSkeleton }
