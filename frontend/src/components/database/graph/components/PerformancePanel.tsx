import { PERF_THRESHOLD } from '../types'
import type { PerfStats, LODLevel } from '../types'

export interface PerformancePanelProps {
  
  showPerfPanel: boolean
  perfStats: PerfStats
  lodLevel: LODLevel
  dataChanged: boolean
  filteredNodeCount: number
  filteredEdgeCount: number
  onToggle: () => void
}

export default function PerformancePanel({
  showPerfPanel,
  perfStats,
  lodLevel,
  dataChanged,
  filteredNodeCount,
  filteredEdgeCount,
  onToggle,
}: PerformancePanelProps) {
  const lodLabels: Record<string, string> = {
    full: '完整', reduced: '简化', minimal: '精简'
  }

  return (
    <>
      {/* 性能监控面板 */}
      {showPerfPanel && (
        <div className="absolute top-14 right-3 z-40 w-56 rounded-xl bg-neutral-900/95 dark:bg-slate-950/95 backdrop-blur-xl border border-neutral-700/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-neutral-700/40 flex items-center justify-between">
            <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
              性能监控
            </span>
            <button onClick={onToggle} className="text-neutral-500 hover:text-neutral-300 transition-colors p-0.5" aria-label="关闭性能面板">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-2.5 space-y-2">
            {/* FPS 指示器 */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-neutral-400">帧率 FPS</span>
              <span className={`text-[11px] font-mono font-bold tabular-nums ${
                perfStats.fps >= 55 ? 'text-primary-400' : perfStats.fps >= 40 ? 'text-warning-400' : perfStats.fps >= 24 ? 'text-orange-400' : 'text-error-400'
              }`}>
                {perfStats.fps} <span className="text-[8px] font-normal text-neutral-500">fps</span>
              </span>
            </div>
            {/* 帧时间 */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-neutral-400">帧时间</span>
              <span className="text-[10px] font-mono text-neutral-300 tabular-nums">{perfStats.frameTime} <span className="text-[8px] text-neutral-500">ms</span></span>
            </div>
            {/* 性能评级 */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-neutral-400">性能评级</span>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                perfStats.rating === 'excellent' ? 'bg-primary-500/20 text-primary-400' :
                perfStats.rating === 'good' ? 'bg-secondary-500/20 text-secondary-400' :
                perfStats.rating === 'fair' ? 'bg-warning-500/20 text-warning-400' :
                'bg-error-500/20 text-error-400'
              }`}>
                {perfStats.rating === 'excellent' ? '优秀' : perfStats.rating === 'good' ? '良好' : perfStats.rating === 'fair' ? '一般' : '较差'}
              </span>
            </div>
            <div className="border-t border-neutral-700/30 pt-2 space-y-1.5">
              {/* 节点/边数 */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-neutral-400">节点 / 边</span>
                <span className="text-[9px] font-mono text-neutral-300">{filteredNodeCount} / {filteredEdgeCount}</span>
              </div>
              {/* LOD 级别 */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-neutral-400">渲染级别</span>
                <span className={`text-[9px] font-medium ${
                  lodLevel === 'full' ? 'text-primary-400' : lodLevel === 'reduced' ? 'text-warning-400' : 'text-error-400'
                }`}>{lodLabels[lodLevel] || lodLevel}</span>
              </div>
              {/* 内存估算 */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-neutral-400">内存估算</span>
                <span className="text-[9px] font-mono text-neutral-300">{perfStats.memoryEst}</span>
              </div>
            </div>
            {/* 增量更新状态 */}
            <div className="border-t border-neutral-700/30 pt-2 flex items-center justify-between">
              <span className="text-[9px] text-neutral-400">更新模式</span>
              <span className={`text-[9px] font-medium ${dataChanged ? 'text-warning-400' : 'text-primary-400'}`}>
                {dataChanged ? '全量重绘' : '增量更新'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 性能面板快捷触发按钮（始终可见） */}
      <button
        onClick={onToggle}
        className="absolute bottom-3 right-3 z-30 w-6 h-6 rounded-lg bg-white/85 dark:bg-neutral-800/85 backdrop-blur-sm border border-neutral-200/60 dark:border-neutral-700/50 shadow-sm hover:shadow-md transition-all flex items-center justify-center group"
        title="性能监控 (Shift+P)"
        aria-label="切换性能监控面板"
      >
        <svg className={`w-3 h-3 transition-colors ${showPerfPanel ? 'text-primary-500' : 'text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      </button>
    </>
  )
}
