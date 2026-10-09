export interface GraphSnapshot {
  id: string
  label: string
  nodeCount: number
}

export interface GraphSnapshotsProps {
  [key: string]: any;
  graphSnapshots: GraphSnapshot[]
  onTakeSnapshot?: () => void
}

export default function GraphSnapshots({ graphSnapshots }: GraphSnapshotsProps) {
  if (graphSnapshots.length === 0) return null

  return (
    <div className="absolute bottom-3 left-3 z-35 bg-white/92 dark:bg-neutral-800/92 backdrop-blur-md rounded-lg border border-neutral-200/60 dark:border-neutral-700/60 shadow-lg p-2 min-w-[140px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">📸 快照</span>
        <span className="text-[8px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{graphSnapshots.length}个</span>
      </div>
      <div className="space-y-0.5 max-h-[80px] overflow-y-auto custom-scrollbar">
        {graphSnapshots.slice(-5).reverse().map(snap => (
          <div key={snap.id} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded hover:bg-slate-50 dark:hover:bg-neutral-700/30 cursor-pointer group">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0" />
            <span className="text-[9px] text-neutral-600 dark:text-neutral-400 truncate flex-1">{snap.label}</span>
            <span className="text-[8px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] hidden group-hover:inline">{snap.nodeCount}节点</span>
          </div>
        ))}
      </div>
    </div>
  )
}
