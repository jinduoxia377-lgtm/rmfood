import { GraphNode } from '../types'
import type { ExternalData } from '../hooks/useGraphState'

// 兼容旧引用：外部数据条目即 useGraphState 的 ExternalData
export type ExternalDataItem = ExternalData

export interface ExternalDataPanelProps {
  showExternalPanel: boolean
  selectedNode: GraphNode | null
  syncStatus: 'connected' | 'syncing' | 'disconnected'
  externalLoadingId: string | null
  externalData: ExternalData | null
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
    connected: 'bg-primary-100 text-primary-700',
    syncing: 'bg-secondary-100 text-secondary-600 animate-pulse',
    disconnected: 'bg-error-100 text-error-600',
  }
  const statusText = {
    connected: '● 已连接',
    syncing: '◌ 同步中...',
    disconnected: '✕ 断开',
  }

  return (
    <div className="absolute top-14 left-3 z-45 w-[min(340px,calc(100vw-1.5rem))] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-2xl shadow-2xl border border-info-200/60 dark:border-info-700/40 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-info-50 to-success-50 dark:from-info-950/50 dark:to-success-950/50 border-b border-info-100/50 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span>🔬</span>
          <span className="text-sm font-bold text-info-700 dark:text-info-700">外部数据库</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${statusClasses[syncStatus]}`}>
            {statusText[syncStatus]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onQueryExternalData} disabled={!!externalLoadingId}
            className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-[var(--color-info-surface)] text-white hover:bg-[var(--color-info-surface-deep)] disabled:opacity-50">刷新</button>
          <button onClick={onTriggerAutoSync} className="px-1.5 py-0.5 rounded text-[11px] font-medium text-info-500 hover:bg-info-50 dark:hover:bg-info-900/20">同步</button>
          <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-info-100 dark:hover:bg-info-800/30 text-neutral-400">✕</button>
        </div>
      </div>
      <div className="p-3 max-h-[55vh] overflow-y-auto custom-scrollbar">
        {externalLoadingId === selectedNode.label ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <div className="w-6 h-6 border-2 border-info-200 border-t-info-500 rounded-full animate-spin" />
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">正在查询外部数据库...</p>
          </div>
        ) : externalData ? (
          <ExternalDataContent data={externalData} />
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-2">暂无外部数据</p>
            <button onClick={onQueryExternalData}
              className="text-xs text-info-500 hover:text-info-600 font-medium">查询 PubChem / TCMSP →</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ExternalDataContent({ data }: { data: ExternalData }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">{data.description || '暂无描述'}</p>
      {data.molecularFormula && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-lg bg-info-50/80 dark:bg-info-950/20 p-2">
            <div className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">分子式</div>
            <div className="text-xs font-mono font-bold text-info-700 dark:text-info-700">{data.molecularFormula}</div>
          </div>
          <div className="rounded-lg bg-info-50/80 dark:bg-info-950/20 p-2">
            <div className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">分子量</div>
            <div className="text-xs font-bold text-info-700 dark:text-info-700">{data.molecularWeight?.toFixed(1)}</div>
          </div>
        </div>
      )}
      {data.properties && Object.keys(data.properties).length > 0 && (
        <div className="bg-neutral-50/80 dark:bg-neutral-800/30 rounded-lg p-2">
          <span className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] mb-1 block">属性</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {Object.entries(data.properties).slice(0, 8).map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs">
                <span className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] truncate max-w-[70px]" title={k}>{k}</span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300 truncate max-w-[80px]">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.targets && data.targets.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">靶点 ({data.targets.length})</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.targets.map(t => (
              <span key={t} className="px-1.5 py-0.5 rounded-md text-[11px] bg-error-50 dark:bg-error-300/20 text-error-600 dark:text-error-600 font-mono">{t}</span>
            ))}
          </div>
        </div>
      )}
      {data.pathways && data.pathways.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">通路 ({data.pathways.length})</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.pathways.map(p => (
              <span key={p} className="px-1.5 py-0.5 rounded-md text-[11px] bg-accent-50 dark:bg-accent-300/20 text-accent-600 dark:text-accent-700">{p}</span>
            ))}
          </div>
        </div>
      )}
      {data.diseases && data.diseases.length > 0 && (
        <div>
          <span className="text-xs font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">相关疾病</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.diseases.map(d => (
              <span key={d} className="px-1.5 py-0.5 rounded-md text-[11px] bg-warning-50 dark:bg-warning-300/20 text-warning-600 dark:text-warning-700">{d}</span>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-700/30">
        <span className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">📚 {data.source.toUpperCase()} · 📄 {data.literatureCount?.toLocaleString()} 文献</span>
        <span className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">更新: {data.lastUpdated || '未知'}</span>
      </div>
    </div>
  )
}
