import { GraphNode } from '../types'

export interface ExternalDataItem {
  description: string
  molecularFormula?: string
  molecularWeight?: number
  properties?: Record<string, unknown>
  targets?: string[]
  pathways?: string[]
  diseases?: string[]
  source: string
  literatureCount?: number
  lastUpdated: string
}

export interface ExternalDataPanelProps {
  showExternalPanel: boolean
  selectedNode: GraphNode | null
  syncStatus: 'connected' | 'syncing' | 'disconnected'
  externalLoadingId: string | null
  externalData: ExternalDataItem | null
  onQueryExternalData: () => void
  onTriggerAutoSync: () => void
  onClose: () => void
}

export default function ExternalDataPanel({
  showExternalPanel,
  selectedNode,
  syncStatus,
  externalLoadingId,
  externalData,
  onQueryExternalData,
  onTriggerAutoSync,
  onClose,
}: ExternalDataPanelProps) {
  if (!showExternalPanel || !selectedNode) return null

  const statusClasses = {
    connected: 'bg-primary-100 text-primary-600',
    syncing: 'bg-secondary-100 text-secondary-600 animate-pulse',
    disconnected: 'bg-error-100 text-error-600',
  }
  const statusText = {
    connected: '● 已连接',
    syncing: '◌ 同步中...',
    disconnected: '✕ 断开',
  }

  return (
    <div className="absolute top-14 left-3 z-45 w-[340px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-cyan-200/60 dark:border-cyan-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950/50 dark:to-teal-950/50 border-b border-cyan-100/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span>🔬</span>
          <span className="text-sm font-bold text-cyan-700 dark:text-cyan-300">外部数据库</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-medium ${statusClasses[syncStatus]}`}>
            {statusText[syncStatus]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onQueryExternalData} disabled={!!externalLoadingId}
            className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-50">刷新</button>
          <button onClick={onTriggerAutoSync} className="px-1.5 py-0.5 rounded text-[9px] font-medium text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20">同步</button>
          <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-cyan-100 dark:hover:bg-cyan-800/30 text-neutral-400">✕</button>
        </div>
      </div>
      <div className="p-3 max-h-[55vh] overflow-y-auto custom-scrollbar">
        {externalLoadingId === selectedNode.label ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <div className="w-6 h-6 border-2 border-cyan-200 border-t-cyan-500 rounded-full animate-spin" />
            <p className="text-[10px] text-neutral-400">正在查询外部数据库...</p>
          </div>
        ) : externalData ? (
          <ExternalDataContent data={externalData} />
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-neutral-400 mb-2">暂无外部数据</p>
            <button onClick={onQueryExternalData}
              className="text-xs text-cyan-500 hover:text-cyan-600 font-medium">查询 PubChem / TCMSP →</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ExternalDataContent({ data }: { data: ExternalDataItem }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">{data.description}</p>
      {data.molecularFormula && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-cyan-50/80 dark:bg-cyan-950/20 p-2">
            <div className="text-[9px] text-neutral-400">分子式</div>
            <div className="text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300">{data.molecularFormula}</div>
          </div>
          <div className="rounded-lg bg-cyan-50/80 dark:bg-cyan-950/20 p-2">
            <div className="text-[9px] text-neutral-400">分子量</div>
            <div className="text-xs font-bold text-cyan-700 dark:text-cyan-300">{data.molecularWeight?.toFixed(1)}</div>
          </div>
        </div>
      )}
      {data.properties && Object.keys(data.properties).length > 0 && (
        <div className="bg-slate-50/80 dark:bg-neutral-800/30 rounded-lg p-2">
          <span className="text-[10px] font-semibold text-neutral-500 mb-1 block">属性</span>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(data.properties).slice(0, 8).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[10px]">
                <span className="text-neutral-500 truncate max-w-[70px]" title={k}>{k}</span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300 truncate max-w-[80px]">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.targets && data.targets.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold text-neutral-500">靶点 ({data.targets.length})</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.targets.map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded-md text-[9px] bg-error-50 dark:bg-error-900/20 text-error-600 dark:text-error-300 font-mono">{t}</span>
            ))}
          </div>
        </div>
      )}
      {data.pathways && data.pathways.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold text-neutral-500">通路 ({data.pathways.length})</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.pathways.map(p => (
              <span key={p} className="px-1.5 py-0.5 rounded-md text-[9px] bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-300">{p}</span>
            ))}
          </div>
        </div>
      )}
      {data.diseases && data.diseases.length > 0 && (
        <div>
          <span className="text-[10px] font-semibold text-neutral-500">相关疾病</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.diseases.map(d => (
              <span key={d} className="px-1.5 py-0.5 rounded-md text-[9px] bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-300">{d}</span>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-700/30">
        <span className="text-[9px] text-neutral-400">📚 {data.source.toUpperCase()} · 📄 {data.literatureCount?.toLocaleString()} 文献</span>
        <span className="text-[8px] text-neutral-400">更新: {data.lastUpdated}</span>
      </div>
    </div>
  )
}
