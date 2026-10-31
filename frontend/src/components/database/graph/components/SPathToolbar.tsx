import { GraphNode } from '../types'

export interface SmartPathData {
  path: string[]
  keyBridges: string[]
  alternativePaths: Array<{ path: string[]; length: number }>
}

export interface SPathToolbarProps {
  showPathPanel: boolean
  smartPathResult: SmartPathData | null
  filteredNodes: GraphNode[]
  pathSourceId: string
  pathTargetId: string
  onSetPathSourceId: (id: string) => void
  onSetPathTargetId: (id: string) => void
  onRunSearch: (sourceId: string, targetId: string) => void
  onClose: () => void
}

export default function SPathToolbar({
  showPathPanel,
  smartPathResult,
  filteredNodes,
  onClose,
}: SPathToolbarProps) {
  if (!showPathPanel || !smartPathResult) return null

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 w-[min(420px,calc(100vw-2rem))] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-secondary-200/60 dark:border-secondary-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-secondary-50 to-info-50 dark:from-secondary-950/50 dark:to-info-950/50 border-b border-secondary-100/50 dark:border-secondary-800/30 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span>🛤️</span>
          <span className="text-sm font-bold text-secondary-700 dark:text-secondary-700">智能路径分析</span>
          <span className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">跳数: {smartPathResult.path.length}</span>
        </div>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary-100 dark:hover:bg-secondary-800/30 text-neutral-400">✕</button>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="flex items-center gap-1 flex-wrap">
          {smartPathResult.path.map((nodeId, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-secondary-100 dark:bg-secondary-300/25 text-secondary-700 dark:text-secondary-700 max-w-[120px] truncate">
                {filteredNodes.find(n => (n.id || n.label) === nodeId)?.label?.slice(0, 12) || nodeId.slice(0, 10)}
              </span>
              {i < smartPathResult.path.length - 1 && <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-xs">→</span>}
            </div>
          ))}
        </div>
        {smartPathResult.keyBridges.length > 0 && (
          <div className="bg-warning-50/80 dark:bg-warning-950/20 rounded-lg p-2">
            <span className="text-xs font-semibold text-warning-700 dark:text-warning-700">🌉 关键桥梁:</span>
            <div className="flex gap-1 mt-1 flex-wrap">
              {smartPathResult.keyBridges.map(bid => (
                <span key={bid} className="px-1.5 py-0.5 rounded text-[11px] bg-warning-100 dark:bg-warning-300/25 text-warning-600 dark:text-warning-700">
                  {filteredNodes.find(n => (n.id || n.label) === bid)?.label?.slice(0, 8)}
                </span>
              ))}
            </div>
          </div>
        )}
        {smartPathResult.alternativePaths.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">替代路径 ({smartPathResult.alternativePaths.length}):</span>
            {smartPathResult.alternativePaths.map((alt, idx) => (
              <div key={idx} className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="font-mono text-secondary-400">#{idx + 1}</span>
                <span>{alt.path.join(' → ')}</span>
                <span className="ml-auto font-mono text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{alt.length}跳</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
