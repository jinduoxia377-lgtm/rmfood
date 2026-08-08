import { GraphNode } from '../types'

export interface ContextMenuProps {
  contextMenu: { x: number; y: number; node?: GraphNode | null } | null
  selectedNodesCount: number
  communitiesSize: number
  onAction: (action: string, node?: GraphNode) => void
  onClearCommunities: () => void
  onDetectCommunities: () => void
  onResetView: () => void
}

export default function ContextMenu({
  contextMenu,
  selectedNodesCount,
  communitiesSize,
  onAction,
  onClearCommunities,
  onDetectCommunities,
  onResetView,
}: ContextMenuProps) {
  if (!contextMenu) return null

  return (
    <div
      className="absolute z-50 min-w-[180px] bg-white/97 dark:bg-neutral-900/97 backdrop-blur-xl rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 shadow-2xl py-1 animate-in fade-in zoom-in-95 duration-150"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {contextMenu.node ? (
        <>
          <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-700/50">
            {contextMenu.node.label}
          </div>
          <button onClick={() => onAction('focus', contextMenu.node!)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors">
            <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            聚焦此节点
          </button>
          <button onClick={() => onAction('selectNeighbors', contextMenu.node!)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-secondary-50 dark:hover:bg-blue-950/30 transition-colors">
            <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
            选中邻居节点
          </button>
          <button onClick={() => onAction('hide', contextMenu.node!)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-error-50 dark:hover:bg-red-950/30 transition-colors">
            <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
            隐藏此类型
          </button>
          <div className="border-t border-neutral-100 dark:border-neutral-700/50 my-1" />
        </>
      ) : selectedNodesCount > 0 ? (
        <>
          <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-700/50">
            已选中 {selectedNodesCount} 个节点
          </div>
          <button onClick={() => onAction('exportSubgraph')}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-primary-50 dark:hover:bg-emerald-950/30 transition-colors">
            <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            导出子图数据
          </button>
          <button onClick={() => onAction('clearSelection')}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors">
            <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            清除选择
          </button>
          <div className="border-t border-neutral-100 dark:border-neutral-700/50 my-1" />
        </>
      ) : null}

      <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-t border-neutral-100 dark:border-neutral-700/50">
        图谱工具
      </div>
      {communitiesSize > 0 ? (
        <button onClick={onClearCommunities}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-warning-50 dark:hover:bg-amber-950/30 transition-colors">
          <svg className="w-3.5 h-3.5 text-warning-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
          关闭社群着色 ({communitiesSize}个社群)
        </button>
      ) : (
        <button onClick={onDetectCommunities}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors">
          <svg className="w-3.5 h-3.5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
          社群自动检测着色
        </button>
      )}
      <button onClick={onResetView}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors">
        <svg className="w-3.5 h-3.5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        重置全部视图
      </button>
    </div>
  )
}
