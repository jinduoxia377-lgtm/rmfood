import { Skeleton } from '@/components/ui/Skeleton'

interface FormulaDetailSkeletonProps {
  activeTab?: string
}

export function FormulaDetailSkeleton({ activeTab = 'basic' }: FormulaDetailSkeletonProps) {
  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 lg:px-6 animate-fade-in">
      {/* Back Navigation */}
      <div className="flex items-center gap-2">
        <Skeleton width={24} height={24} radius={6} animationType="pulse" />
        <Skeleton width={60} height={16} animationType="pulse" />
      </div>

      {/* Header Section */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton width={70} height={12} animationType="pulse" />
              <Skeleton width={60 + (i * 10)} height={20} animationType="pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {['basic', 'ingredients', 'process', 'versions', 'recommendations'].map((tab) => (
            <div
              key={tab}
              className={`px-4 py-2 rounded-lg ${tab === activeTab ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
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
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 min-h-[400px]">
        {activeTab === 'basic' && <BasicInfoSkeleton />}
        {activeTab === 'ingredients' && <IngredientsSkeleton />}
        {activeTab === 'process' && <ProcessSkeleton />}
        {activeTab === 'versions' && <VersionsSkeleton />}
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
      <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
        <Skeleton width={70} height={13} animationType="pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} width={i === 2 ? '95%' : i === 3 ? '85%': '100%'} height={14} animationType="pulse" />
          ))}
        </div>
      </div>

      {/* Meta Info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton width={60} height={11} animationType="pulse" />
            <Skeleton width={90 + (i * 5)} height={14} animationType="pulse" />
          </div>
        ))}
      </div>

      {/* AI Analysis Section */}
      <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <Skeleton width={120} height={18} animationType="pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
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
    <div className="space-y-4">
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
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr>
              {['#', '成分名称', '用量(g)', '分类', '来源', '药食同源'].map((_, i) => (
                <th key={i} className="p-3">
                  <Skeleton width={[30, 80, 60, 60, 60, 70][i]} height={13} animationType="pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                {Array.from({ length: 6 }).map((_, j) => (
                  <td key={j} className="p-3">
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
      <div className="pt-4">
        <Skeleton width="100%" height={250} radius={12} animationType="pulse" />
      </div>
    </div>
  )
}

function ProcessSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton width={24} height={24} radius={6} animationType="pulse" />
        <Skeleton width={100} height={20} animationType="pulse" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton width={24} height={24} radius={6} animationType="pulse" />
          <Skeleton width={100} height={20} animationType="pulse" />
          <Skeleton width={50} height={18} radius={9} animationType="pulse" />
        </div>
      </div>

      <div className="relative pl-8">
        {/* Timeline Line */}
        <div className="absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-700" />

        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="relative flex gap-4">
              {/* Version Node */}
              <div className="absolute left-[-28px] top-0 w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800" />

              {/* Content */}
              <div className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3 ml-2">
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
    <div className="space-y-4">
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
            className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3 hover:border-primary-300 transition-colors"
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
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-500 mb-1.5">关键成分:</p>
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
