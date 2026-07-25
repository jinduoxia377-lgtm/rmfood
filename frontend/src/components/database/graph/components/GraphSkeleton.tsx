export interface GraphSkeletonProps {
  isLoading: boolean
}

export default function GraphSkeleton({ isLoading }: GraphSkeletonProps) {
  if (!isLoading) return null
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm rounded-xl animate-fade-in z-50">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">图谱加载中...</p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">正在计算力导向布局</p>
      </div>
    </div>
  )
}
