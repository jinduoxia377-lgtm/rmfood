import { Skeleton } from '@/components/ui/Skeleton'

interface FormulaDetailSkeletonProps {
  activeTab?: string
}

export function FormulaDetailSkeleton({ activeTab = 'basic' }: FormulaDetailSkeletonProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6 px-[var(--space-apple-md)] lg:px-6 animate-fade-in">
      {/* Back Navigation */}
      <div className="flex items-center gap-2">
        <Skeleton width={24} height={24} radius={6} animationType="pulse" />
        <Skeleton width={60} height={16} animationType="pulse" />
      </div>

      {/* Header Section */}
      <div className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-[var(--space-apple-lg)] space-y-[var(--space-apple-md)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-[var(--space-apple-sm)]">
            <div className="flex items-center gap-[var(--space-apple-sm)]">
              <Skeleton width={250} height={32} animationType="pulse" />
              <Skeleton width={80} height={24} radius={12} animationType="pulse" />
              <Skeleton width={60} height={24} radius={12} animationType="pulse" />
            </div>
            <Skeleton width="90%" height={14} animationType="pulse" />
            <div className="flex items-center gap-4 pt-1">
              <Skeleton width={100} height={13} animationType="pulse" />
              <Skeleton width={120} height={13} animationType="pulse" />
              <Skeleton width={140} height={13} animationType="pulse" />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Skeleton width={90} height={36} radius={8} animationType="pulse" />
            <Skeleton width={90} height={36} radius={8} animationType="pulse" />
            <Skeleton width={36} height={36} radius={8} circular animationType="pulse" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-[var(--space-apple-md)] border-t border-[var(--border-color)]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton width={70} height={12} animationType="pulse" />
              <Skeleton width={60 + (i * 10)} height={20} animationType="pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {['basic', 'ingredients', 'process', 'versions', 'recommendations'].map((tab) => (
            <div
              key={tab}
              className={`px-[var(--space-apple-md)] py-2 rounded-[var(--radius-Apple-sm)] ${tab === activeTab ? 'bg-[var(--bg-tertiary)]' : ''}`}
            >
              <Skeleton
                width={tab === 'basic' ? 70 : tab === 'ingredients' ? 80 : tab === 'process' ? 80 : tab === 'versions' ? 80 : 100}
                height={16}
                animationType="pulse"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="rounded-[var(--radius-Apple-md)] border border-[var(--border-color)] bg-[var(--bg-secondary)] p-[var(--space-apple-lg)] min-h-[400px]">
        {activeTab === 'basic' && <BasicInfoSkeleton />}
        {activeTab === 'ingredients' && <IngredientsSkeleton />}
        {activeTab === 'steps' && <ProcessSkeleton />}
        {activeTab === 'versions' && <VersionsSkeleton />}
        {activeTab === 'nutrition' && <BasicInfoSkeleton />}
        {activeTab === 'recommendations' && <RecommendationsSkeleton />}
      </div>
    </div>
  )
}

function BasicInfoSkeleton() {
  return (
    <div className="space-y-6">
      {/* Basic Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton width={80 + (i % 3) * 15} height={13} animationType="pulse" />
            <Skeleton width="100%" height={38} radius={8} animationType="pulse" />
          </div>
        ))}
      </div>

      {/* Description */}
      <div className="space-y-2 pt-[var(--space-apple-md)] border-t border-[var(--border-color)]">
        <Skeleton width={70} height={13} animationType="pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width={i === 2 ? '95%' : i === 3 ? '85%': '100%'} height={14} animationType="pulse" />
          ))}
        </div>
      </div>

      {/* Meta Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-4 pt-[var(--space-apple-md)] border-t border-[var(--border-color)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton width={60} height={11} animationType="pulse" />
            <Skeleton width={90 + (i * 5)} height={14} animationType="pulse" />
          </div>
        ))}
      </div>

      {/* AI Analysis Section */}
      <div className="space-y-[var(--space-apple-md)] pt-[var(--space-apple-md)] border-t border-[var(--border-color)]">
        <Skeleton width={120} height={18} animationType="pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)]">
              <Skeleton width={100} height={16} animationType="pulse" />
              <Skeleton width="100%" height={12} animationType="pulse" />
              <Skeleton width="90%" height={12} animationType="pulse" />
              <Skeleton width="95%" height={12} animationType="pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function IngredientsSkeleton() {
  return (
    <div className="space-y-[var(--space-apple-md)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton width={24} height={24} radius={6} animationType="pulse" />
          <Skeleton width={100} height={20} animationType="pulse" />
          <Skeleton width={40} height={18} radius={9} animationType="pulse" />
        </div>
        <Skeleton width={80} height={32} radius={8} animationType="pulse" />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-tertiary)] border-b border-[var(--border-color)]">
            <tr>
              {['#', '成分名称', '用量(g)', '分类', '来源', '药食同源'].map((_, i) => (
                <th key={i} className="p-[var(--space-apple-sm)]">
                  <Skeleton width={[30, 80, 60, 60, 60, 70][i]} height={13} animationType="pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--border-color)] last:border-0">
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="p-[var(--space-apple-sm)]">
                    <Skeleton
                      width={[25, 80 + (j * 10), 45, 55, 55, 65][j]}
                      height={14}
                      animationType="pulse"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Chart Placeholder */}
      <div className="pt-[var(--space-apple-md)]">
        <Skeleton width="100%" height={250} radius={12} animationType="pulse" />
      </div>
    </div>
  )
}

function ProcessSkeleton() {
  return (
    <div className="space-y-[var(--space-apple-md)]">
      <div className="flex items-center gap-2">
        <Skeleton width={24} height={24} radius={6} animationType="pulse" />
        <Skeleton width={100} height={20} animationType="pulse" />
      </div>

      <div className="space-y-[var(--space-apple-md)]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-[var(--space-apple-md)] rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)]">
            <Skeleton width={40} height={40} radius={20} circular animationType="pulse" />
            <div className="flex-1 space-y-2">
              <Skeleton width={120} height={16} animationType="pulse" />
              <Skeleton width="95%" height={14} animationType="pulse" />
              <Skeleton width="85%" height={14} animationType="pulse" />
              <div className="flex gap-4 pt-1">
                <Skeleton width={80} height={12} animationType="pulse" />
                <Skeleton width={60} height={12} animationType="pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VersionsSkeleton() {
  return (
    <div className="space-y-[var(--space-apple-md)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton width={24} height={24} radius={6} animationType="pulse" />
          <Skeleton width={100} height={20} animationType="pulse" />
          <Skeleton width={50} height={18} radius={9} animationType="pulse" />
        </div>
      </div>

      <div className="relative pl-8">
        {/* Timeline Line */}
        <div className="absolute left-[19px] top-[var(--space-apple-md)] bottom-4 w-0.5 bg-[var(--border-color)]" />

        <div className="space-y-[var(--space-apple-md)]">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="relative flex gap-4">
              {/* Version Node */}
              <div className="absolute left-[-28px] top-0 w-10 h-10 rounded-[var(--radius-pill)] bg-[var(--bg-tertiary)]" />

              {/* Content */}
              <div className="flex-1 rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)] ml-2">
                <div className="flex items-center justify-between">
                  <Skeleton width={100} height={16} animationType="pulse" />
                  <Skeleton width={110} height={13} animationType="pulse" />
                </div>
                <Skeleton width="90%" height={13} animationType="pulse" />
                <div className="flex gap-2 pt-1">
                  <Skeleton width={70} height={26} radius={13} animationType="pulse" />
                  <Skeleton width={70} height={26} radius={13} animationType="pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RecommendationsSkeleton() {
  return (
    <div className="space-y-[var(--space-apple-md)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton width={24} height={24} radius={6} animationType="pulse" />
          <Skeleton width={100} height={20} animationType="pulse" />
        </div>
        <Skeleton width={100} height={32} radius={8} animationType="pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius-Apple-sm)] border border-[var(--border-color)] p-[var(--space-apple-md)] space-y-[var(--space-apple-sm)] hover:border-[var(--color-primary-border)] transition-colors"
          >
            <div className="flex items-start justify-between">
              <Skeleton width={140} height={18} animationType="pulse" />
              <Skeleton width={50} height={22} radius={11} animationType="pulse" />
            </div>
            <Skeleton width="95%" height={14} animationType="pulse" />
            <div className="flex flex-wrap gap-1.5 pt-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} width={50 + (j * 10)} height={22} radius={11} animationType="pulse" />
              ))}
            </div>
            <div className="pt-2 border-t border-[var(--border-color)]">
              <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1.5">关键成分:</p>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 4 }).map((_, k) => (
                  <Skeleton key={k} width={45 + (k * 8)} height={20} radius={4} animationType="pulse" />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
