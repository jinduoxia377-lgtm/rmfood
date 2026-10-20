import { Skeleton } from '@/components/ui/Skeleton'

export function FormulaListSkeleton() {
  return (
    <div className="max-w-[1520px] mx-auto space-y-8 px-[var(--space-apple-md)] lg:px-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton width={200} height={32} animationType="pulse" />
          <Skeleton width={400} height={16} animationType="pulse" />
        </div>
        <div className="flex items-center gap-[var(--space-apple-sm)]">
          <Skeleton width={100} height={36} radius={8} animationType="pulse" />
          <Skeleton width={120} height={36} radius={8} animationType="pulse" />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left Sidebar - Filter Panel */}
        <div className="space-y-6">
          <div className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 space-y-5">
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
          <div className="flex flex-wrap items-center justify-between gap-4 p-[var(--space-apple-md)] rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-[var(--space-apple-sm)]">
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
          <div className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] bg-[var(--bg-secondary)] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]">
                <tr>
                  {[40, 150, 100, 100, 100, 120, 140].map((w, i) => (
                    <th key={i} className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <Skeleton width={w} height={14} animationType="pulse" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--border-color)] last:border-0">
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <Skeleton width={20} height={14} animationType="pulse" />
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <Skeleton width={120 + (i % 3) * 20} height={16} animationType="pulse" />
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <Skeleton width={70} height={24} radius={12} animationType="pulse" />
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)]">
                      <Skeleton width={50} height={14} animationType="pulse" />
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] hidden md:table-cell">
                      <Skeleton width={60} height={14} animationType="pulse" />
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] hidden lg:table-cell">
                      <Skeleton width={90} height={14} animationType="pulse" />
                    </td>
                    <td className="px-[var(--space-apple-md)] py-[var(--space-apple-md)] hidden xl:table-cell">
                      <Skeleton width={110} height={14} animationType="pulse" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Skeleton */}
          <div className="flex items-center justify-between pt-[var(--space-apple-md)]">
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)]"
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
