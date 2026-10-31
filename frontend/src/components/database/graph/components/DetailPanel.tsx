import { GraphNode, TYPE_CONFIG } from '../types'
import { Badge } from '@/components/ui'
import { EDGE_COLORS, EDGE_TYPE_LABELS } from '../types'

export interface ConnectionInfo {
  incoming: Array<{ edge: { type: string }; node: GraphNode }>
  outgoing: Array<{ edge: { type: string }; node: GraphNode }>
  totalConnections: number
  neighbors: GraphNode[]
  neighborTypeCount: Record<string, number>
}

export interface DetailPanelProps {
  selectedNode: GraphNode | null
  nodeConnections: ConnectionInfo
  detailTab: 'info' | 'connections' | 'properties'
  onSetDetailTab: (tab: 'info' | 'connections' | 'properties') => void
  setSelectedNode: (node: GraphNode | null) => void
  onNodeClick?: (node: GraphNode) => void
}

export default function DetailPanel({
  selectedNode,
  nodeConnections,
  detailTab,
  onSetDetailTab,
  setSelectedNode,
  onNodeClick,
}: DetailPanelProps) {
  if (!selectedNode) return null

  return (
    <div
      className="absolute top-14 left-3 z-40 w-80 rounded-2xl border shadow-2xl animate-in fade-in slide-in-from-left-3 duration-250 bg-white/[0.98] dark:bg-neutral-900/[0.97] backdrop-blur-xl border-neutral-200/80 dark:border-neutral-700/60 overflow-hidden"
      style={{ boxShadow: '0 25px 70px rgba(0,0,0,0.18), 0 0 0 1px rgba(148,163,184,0.08), inset 0 1px 0 rgba(255,255,255,0.06)' }}
    >
      {/* 面板头部 */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-5 h-5 rounded-lg shadow-md ring-2 ring-offset-1.5 shrink-0 flex items-center justify-center"
              style={{
                backgroundColor: TYPE_CONFIG[selectedNode.type]?.color,
                '--tw-ring-color': TYPE_CONFIG[selectedNode.type]?.color,
              } as React.CSSProperties}
            >
              <span className="text-xs text-white dark:text-neutral-900 font-bold">{TYPE_CONFIG[selectedNode.type]?.label?.[0]}</span>
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-neutral-800 dark:text-neutral-100 text-sm leading-tight block truncate" title={selectedNode.label}>
                {selectedNode.label}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge
                  variant={selectedNode.type === 'herb' ? 'primary' : selectedNode.type === 'compound' ? 'info' : selectedNode.type === 'target' ? 'warning' : selectedNode.type === 'disease' ? 'danger' : selectedNode.type === 'peptide' ? 'success' : 'neutral'}
                  size="sm"
                  className="text-[11px] px-1.5 py-0"
                >
                  {TYPE_CONFIG[selectedNode.type]?.label || selectedNode.type}
                </Badge>
                {selectedNode.degree != null && selectedNode.degree > 0 && (
                  <span className="text-[11px] font-mono tabular-nums text-neutral-400 dark:text-neutral-400">
                    度数 {selectedNode.degree}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => { setSelectedNode(null); onSetDetailTab('info') }}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-all p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700/60 shrink-0"
            aria-label="关闭详情面板"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 2l11 11M13 2L2 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>

        {/* 快速统计条 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 mt-3">
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 px-2 py-1.5 text-center">
            <div className="text-xs font-bold tabular-nums text-neutral-700 dark:text-neutral-300">{nodeConnections.totalConnections}</div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-400">关联数</div>
          </div>
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 px-2 py-1.5 text-center">
            <div className="text-xs font-bold tabular-nums text-neutral-700 dark:text-neutral-300">{nodeConnections.neighbors.length}</div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-400">邻居</div>
          </div>
          <div className="rounded-lg bg-neutral-50 dark:bg-neutral-800/60 px-2 py-1.5 text-center">
            <div className="text-xs font-bold tabular-nums text-neutral-700 dark:text-neutral-300">{Object.keys(nodeConnections.neighborTypeCount).length}</div>
            <div className="text-[11px] text-neutral-400 dark:text-neutral-400">类型</div>
          </div>
        </div>

        {/* 邻居类型分布 */}
        {nodeConnections.neighbors.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(nodeConnections.neighborTypeCount).slice(0, 5).map(([type, count]) => {
              const tconf = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG]
              return (
                <span key={type} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `color-mix(in srgb, ${tconf?.color || 'var(--color-knowledge-default, #9CA3AF)'} 10%, transparent)`, color: tconf?.color || 'var(--color-knowledge-text, #6B7280)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tconf?.color }} />
                  {tconf?.label || type} ×{count}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* 标签页导航 */}
      <div className="flex border-b border-neutral-200/70 dark:border-neutral-700/50 px-1">
        {(['info', 'connections', 'properties'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => onSetDetailTab(tab)}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-all relative ${
              detailTab === tab
                ? 'text-primary-700 dark:text-primary-700'
                : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-400'
            }`}
          >
            {tab === 'info' ? '概览' : tab === 'connections' ? `连接(${nodeConnections.totalConnections})` : `属性${selectedNode.properties ? Object.keys(selectedNode.properties).length : 0}`}
            {detailTab === tab && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary-500 dark:bg-primary-400" />
            )}
          </button>
        ))}
      </div>

      {/* 标签页内容区 */}
      <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '340px', minHeight: '120px' }}>
        {/* 概览标签页 */}
        {detailTab === 'info' && (
          <DetailInfoTab
            selectedNode={selectedNode}
            nodeConnections={nodeConnections}
            onSetSelectedNode={setSelectedNode}
            onNodeClick={onNodeClick}
            onSetDetailTab={onSetDetailTab}
          />
        )}

        {/* 连接标签页 */}
        {detailTab === 'connections' && (
          <DetailConnectionsTab
            nodeConnections={nodeConnections}
            onSetSelectedNode={setSelectedNode}
          />
        )}

        {/* 属性标签页 */}
        {detailTab === 'properties' && (
          <DetailPropertiesTab selectedNode={selectedNode} />
        )}
      </div>

      {/* 面板底部操作栏 */}
      <div className="px-4 py-2.5 border-t border-neutral-200/70 dark:border-neutral-700/50 bg-neutral-50/50 dark:bg-neutral-800/30 flex gap-2">
        <button
          onClick={() => onNodeClick?.(selectedNode)}
          className="flex-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[var(--color-primary-surface)] to-[var(--color-primary-surface-hover)] hover:from-[var(--color-primary-surface-hover)] hover:to-[var(--color-primary-surface-hover)] text-white text-xs font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          查看完整详情
        </button>
        <button
          onClick={() => setSelectedNode(null)}
          className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs font-medium transition-all active:scale-[0.98]"
        >
          关闭
        </button>
      </div>
    </div>
  )
}

function DetailInfoTab({ selectedNode, nodeConnections, onSetSelectedNode, onNodeClick, onSetDetailTab }: {
  selectedNode: GraphNode
  nodeConnections: ConnectionInfo
  onSetSelectedNode: (node: GraphNode | null) => void
  onNodeClick?: (node: GraphNode) => void
  onSetDetailTab: (tab: 'info' | 'connections' | 'properties') => void
}) {
  return (
    <div className="p-3 space-y-3">
      {/* 节点ID */}
      {selectedNode.id && selectedNode.id !== selectedNode.label && (
        <div className="text-xs text-neutral-400 dark:text-neutral-400 font-mono bg-neutral-50 dark:bg-neutral-800/40 rounded-lg px-2 py-1.5 break-all">
          ID: {selectedNode.id}
        </div>
      )}

      {/* 操作工具栏 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <button
          onClick={() => onNodeClick?.(selectedNode)}
          className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors group"
          title="查看完整详情"
        >
          <svg className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] group-hover:text-primary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] group-hover:text-primary-700 transition-colors">详情</span>
        </button>
        <button
          onClick={() => onSetDetailTab('connections')}
          className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-secondary-50 dark:hover:bg-secondary-950/30 transition-colors group"
          title="查看所有连接"
        >
          <svg className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] group-hover:text-secondary-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
          <span className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] group-hover:text-secondary-600 transition-colors">连接</span>
        </button>
        <button
          onClick={() => {
            onNodeClick?.({ ...selectedNode, properties: { ...selectedNode.properties, _action: 'highlight_neighbors' } })
          }}
          className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-warning-50 dark:hover:bg-warning-950/30 transition-colors group"
          title="高亮邻居节点"
        >
          <svg className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] group-hover:text-warning-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
          <span className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] group-hover:text-warning-600 transition-colors">高亮</span>
        </button>
        <button
          onClick={() => onSetSelectedNode(null)}
          className="flex flex-col items-center gap-0.5 p-2 rounded-xl hover:bg-error-50 dark:hover:bg-error-950/30 transition-colors group"
          title="关闭面板"
        >
          <svg className="w-4 h-4 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] group-hover:text-error-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] group-hover:text-error-600 transition-colors">关闭</span>
        </button>
      </div>

      {/* 邻居预览列表（最多显示8个） */}
      {nodeConnections.neighbors.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider text-neutral-400 dark:text-neutral-400 font-semibold px-1">
            直接邻居 ({nodeConnections.neighbors.length})
          </div>
          <div className="space-y-0.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
            {nodeConnections.neighbors.slice(0, 8).map(neighbor => {
              const nconf = TYPE_CONFIG[neighbor.type]
              return (
                <button
                  key={neighbor.id || neighbor.label}
                  onClick={() => onSetSelectedNode(neighbor)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors text-left group/item"
                >
                  <span className="w-2 h-2 rounded-full shrink-0 transition-transform group-hover/item:scale-150" style={{ backgroundColor: nconf?.color || 'var(--color-knowledge-default, #9CA3AF)' }} />
                  <span className="text-xs text-neutral-600 dark:text-neutral-300 truncate flex-1 font-medium group-hover/item:text-neutral-900 dark:group-hover/item:text-neutral-100">{neighbor.label}</span>
                  <span className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] shrink-0">{nconf?.label}</span>
                </button>
              )
            })}
            {nodeConnections.neighbors.length > 8 && (
              <button onClick={() => onSetDetailTab('connections')} className="w-full text-center text-xs text-primary-500 hover:text-primary-700 dark:text-primary-700 py-1 hover:bg-primary-50/50 dark:hover:bg-primary-950/20 rounded-lg transition-colors font-medium">
                查看全部 {nodeConnections.neighbors.length} 个邻居 →
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DetailConnectionsTab({ nodeConnections, onSetSelectedNode }: {
  nodeConnections: ConnectionInfo
  onSetSelectedNode: (node: GraphNode | null) => void
}) {
  return (
    <div className="p-3 space-y-3">
      {nodeConnections.totalConnections === 0 ? (
        <div className="text-center py-8 space-y-2">
          <div className="w-10 h-10 mx-auto rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
            </svg>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-400">该节点暂无连接关系</p>
        </div>
      ) : (
        <>
          {nodeConnections.incoming.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
                </svg>
                入站连接 ({nodeConnections.incoming.length})
              </div>
              <div className="space-y-0.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                {nodeConnections.incoming.map(({ edge, node }, idx) => {
                  const nconf = TYPE_CONFIG[node.type]
                  const econf = EDGE_COLORS[edge.type as keyof typeof EDGE_COLORS]
                  return (
                    <div key={`in-${idx}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-neutral-50/80 dark:bg-neutral-800/40 group hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors">
                      <button onClick={() => onSetSelectedNode(node)} className="min-w-0 flex-1 flex items-center gap-1.5 text-left">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: nconf?.color || 'var(--color-knowledge-default, #9CA3AF)' }} />
                        <span className="text-xs text-neutral-700 dark:text-neutral-300 truncate font-medium">{node.label}</span>
                        <span className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{nconf?.label}</span>
                      </button>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${econf?.color || 'var(--color-knowledge-default, #9CA3AF)'} 10%, transparent)`, color: econf?.color || 'var(--color-knowledge-text, #6B7280)' }}>
                        {EDGE_TYPE_LABELS[edge.type] || edge.type}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {nodeConnections.outgoing.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 11l7-7 7 7M5 19l7-7 7 7" />
                </svg>
                出站连接 ({nodeConnections.outgoing.length})
              </div>
              <div className="space-y-0.5 max-h-[140px] overflow-y-auto custom-scrollbar pr-1">
                {nodeConnections.outgoing.map(({ edge, node }, idx) => {
                  const nconf = TYPE_CONFIG[node.type]
                  const econf = EDGE_COLORS[edge.type as keyof typeof EDGE_COLORS]
                  return (
                    <div key={`out-${idx}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-neutral-50/80 dark:bg-neutral-800/40 group hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors">
                      <button onClick={() => onSetSelectedNode(node)} className="min-w-0 flex-1 flex items-center gap-1.5 text-left">
                        <span className="text-xs text-neutral-700 dark:text-neutral-300 truncate font-medium">{node.label}</span>
                        <span className="text-[11px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]">{nconf?.label}</span>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: nconf?.color || 'var(--color-knowledge-default, #9CA3AF)' }} />
                      </button>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${econf?.color || 'var(--color-knowledge-default, #9CA3AF)'} 10%, transparent)`, color: econf?.color || 'var(--color-knowledge-text, #6B7280)' }}>
                        {EDGE_TYPE_LABELS[edge.type] || edge.type}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DetailPropertiesTab({ selectedNode }: { selectedNode: GraphNode }) {
  if (!selectedNode.properties || Object.keys(selectedNode.properties).length === 0) {
    return (
      <div className="p-3">
        <div className="text-center py-8 space-y-2">
          <div className="w-10 h-10 mx-auto rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
            <svg className="w-5 h-5 text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-xs text-neutral-400 dark:text-neutral-400">该节点暂无属性数据</p>
        </div>
      </div>
    )
  }

  const priorityKeys = ['category', 'effects', 'ob_percent', 'dl_value', 'ob', 'dl',
    'activity_value', 'activity_type', 'source_protein', 'molecular_weight',
    'hydrolysis_enzyme', 'full_sequence', 'target_count', 'is_food_homology',
    'name_latin', 'source_herb']

  const keyLabelMap: Record<string, string> = {
    ob_percent: '口服生物利用度(OB)', dl_value: '类药性(DL)',
    ob: 'OB值', dl: 'DL值', activity_value: '活性值',
    activity_type: '活性类型', source_protein: '来源蛋白',
    molecular_weight: '分子量', hydrolysis_enzyme: '水解酶',
    full_sequence: '完整序列', target_count: '靶点数',
    is_food_homology: '药食同源', name_latin: '拉丁名',
    category: '分类', effects: '功效', source_herb: '来源药材',
  }

  const sortedProps = Object.entries(selectedNode.properties)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort((a, b) => {
      const aIdx = priorityKeys.indexOf(a[0])
      const bIdx = priorityKeys.indexOf(b[0])
      if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx
      if (aIdx >= 0) return -1
      if (bIdx >= 0) return 1
      return 0
    })

  return (
    <div className="p-3">
      <div className="space-y-0.5">
        {sortedProps.map(([key, val]) => {
          let displayVal: string
          let isHighlight = false
          if (typeof val === 'number') {
            displayVal = Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2)
            isHighlight = ['ob', 'dl', 'activity_value', 'molecular_weight'].includes(key)
          } else if (typeof val === 'boolean') {
            displayVal = val ? '是' : '否'
          } else if (key === 'full_sequence') {
            displayVal = String(val).length > 35 ? String(val).slice(0, 35) + '...' : String(val)
          } else {
            displayVal = String(val)
            if (displayVal.length > 50) displayVal = displayVal.slice(0, 50) + '...'
          }

          return (
            <div key={key} className="flex justify-between items-center text-xs group px-2 py-1.5 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
              <span className="text-neutral-500 dark:text-neutral-400 shrink-0" title={key}>
                {keyLabelMap[key] || key}
              </span>
              <span
                className={`font-medium max-w-[180px] truncate transition-colors text-right ${isHighlight ? 'text-primary-700 dark:text-primary-700 font-semibold' : 'text-neutral-700 dark:text-neutral-200 group-hover:text-primary-700 dark:group-hover:text-primary-400'}`}
                title={String(val)}
              >
                {displayVal}
              </span>
            </div>
          )
        })}
        {sortedProps.length === 0 && (
          <p className="text-xs text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] italic text-center py-4">属性值为空</p>
        )}
      </div>
    </div>
  )
}
