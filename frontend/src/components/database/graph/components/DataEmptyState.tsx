export interface DataEmptyStateProps {
  isLoading: boolean
}

export default function DataEmptyState({ isLoading }: DataEmptyStateProps) {
  if (isLoading) return null
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-950/40 dark:to-blue-950/40 flex items-center justify-center">
          <svg className="w-8 h-8 text-primary-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
        </div>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium max-w-[240px] mx-auto leading-relaxed">
          搜索药材或化合物名称以查看知识图谱
        </p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          支持药材、化合物、靶点、疾病等多维度检索
        </p>
      </div>
    </div>
  )
}
