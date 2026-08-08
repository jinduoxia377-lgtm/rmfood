import { Skeleton } from '@/components/ui/Skeleton'

export function FormulaFormSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 lg:px-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton width={200} height={32} animationType="pulse" />
          <Skeleton width={450} height={16} animationType="pulse" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton width={80} height={36} radius={8} animationType="pulse" />
          <Skeleton width={100} height={36} radius={8} animationType="pulse" />
        </div>
      </div>

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left - Form Fields */}
        <div className="space-y-6 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-6">
          {/* Basic Info Section */}
          <FormSectionSkeleton title="基本信息" fieldCount={4} />

          {/* Effects Section */}
          <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <FormSectionSkeleton title="目标功效" fieldCount={2} />
          </div>

          {/* Ingredients Section */}
          <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <IngredientsSectionSkeleton />
          </div>

          {/* Additional Info Section */}
          <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <FormSectionSkeleton title="其他信息" fieldCount={5} />
          </div>
        </div>

        {/* Right - Preview Panel */}
        <div className="space-y-6">
          <PreviewPanelSkeleton />
          <QuickActionsSkeleton />
        </div>
      </div>
    </div>
  )
}

function FormSectionSkeleton({ title, fieldCount }: { title?: string; fieldCount: number }) {
  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2 pb-2 border-b border-neutral-100 dark:border-neutral-800">
          <Skeleton width={20} height={20} radius={5} animationType="pulse" />
          <Skeleton width={80 + (title.length * 8)} height={18} animationType="pulse" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {Array.from({ length: fieldCount }).map((_, i) => (
          <div key={i} className={`space-y-2 ${i % 2 === 1 && fieldCount > 2 ? 'md:col-start-auto' : ''}`}>
            <Skeleton
              width={[70, 80, 90, 100, 85][i % 5]}
              height={13}
              animationType="pulse"
            />
            <Skeleton width="100%" height={40} radius={8} animationType="pulse" />
            {i === 0 && <Skeleton width="90%" height={12} animationType="pulse" />}
          </div>
        ))}
      </div>
    </div>
  )
}

function IngredientsSectionSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Skeleton width={20} height={20} radius={5} animationType="pulse" />
          <Skeleton width={80} height={18} animationType="pulse" />
        </div>
        <Skeleton width={120} height={32} radius={8} animationType="pulse" />
      </div>

      {/* Search Input */}
      <Skeleton width="100%" height={42} radius={8} animationType="pulse" />

      {/* Ingredients List Header */}
      <div className="flex items-center justify-between py-2 text-sm">
        <Skeleton width={140} height={14} animationType="pulse" />
        <Skeleton width={80} height={14} animationType="pulse" />
      </div>

      {/* Ingredient Items */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton width={24} height={24} radius={6} animationType="pulse" />
                <Skeleton width={70 + (i * 10)} height={16} animationType="pulse" />
                <Skeleton width={50} height={20} radius={10} animationType="pulse" />
              </div>
              <Skeleton width={24} height={24} radius={6} animationType="pulse" />
            </div>
            <div className="grid grid-cols-3 gap-4 pl-9">
              <div className="space-y-1">
                <Skeleton width={35} height={11} animationType="pulse" />
                <Skeleton width={50} height={14} animationType="pulse" />
              </div>
              <div className="space-y-1">
                <Skeleton width={35} height={11} animationType="pulse" />
                <Skeleton width={55} height={14} animationType="pulse" />
              </div>
              <div className="space-y-1">
                <Skeleton width={45} height={11} animationType="pulse" />
                <Skeleton width={60} height={14} animationType="pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PreviewPanelSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 space-y-4 sticky top-6">
      <div className="flex items-center gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
        <Skeleton width={20} height={20} radius={5} animationType="pulse" />
        <Skeleton width={80} height={18} animationType="pulse" />
      </div>

      {/* Preview Card */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden">
        {/* Card Header */}
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-4 space-y-2">
          <Skeleton width="80%" height={22} animationType="pulse" className="!bg-white/30" />
          <Skeleton width="60%" height={13} animationType="pulse" className="!bg-white/20" />
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton width={60} height={20} radius={10} animationType="pulse" />
            <Skeleton width={60} height={20} radius={10} animationType="pulse" />
          </div>

          <div className="space-y-2 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <Skeleton width={60 + (i * 15)} height={13} animationType="pulse" />
                <Skeleton width={30 + (i * 5)} height={13} animationType="pulse" />
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="text-center space-y-1">
                <Skeleton width={40} height={11} animationType="pulse" />
                <Skeleton width={35} height={16} animationType="pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Validation Status */}
      <div className="space-y-2 pt-2">
        <Skeleton width={90} height={13} animationType="pulse" />
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton width={16} height={16} radius={4} circular animationType="pulse" />
              <Skeleton width={100 + (i * 20)} height={13} animationType="pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function QuickActionsSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 space-y-3">
      <Skeleton width={80} height={18} animationType="pulse" />

      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <Skeleton width={20} height={20} radius={5} animationType="pulse" />
            <Skeleton width={90 + (i * 15)} height={14} animationType="pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
