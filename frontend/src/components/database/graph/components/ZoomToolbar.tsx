import * as d3 from 'd3'

export interface ZoomToolbarProps {
  zoomTransform: d3.ZoomTransform | null
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onReset: () => void
}

export default function ZoomToolbar({
  zoomTransform,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
}: ZoomToolbarProps) {
  const scale = zoomTransform?.k ?? 1
  const pct = `${Math.round(scale * 100)}%`

  return (
    <div className="absolute top-3 right-3 z-40 flex items-center gap-1 bg-white/95 dark:bg-neutral-800/95 backdrop-blur-md rounded-xl border border-neutral-200/70 dark:border-neutral-700/60 shadow-lg px-1.5 py-1">
      <button onClick={onZoomOut} title="缩小" className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        aria-label="缩小">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H4" />
        </svg>
      </button>

      <span className="text-[10px] font-mono font-medium text-neutral-500 dark:text-neutral-400 w-10 text-center tabular-nums">{pct}</span>

      <button onClick={onZoomIn} title="放大" className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        aria-label="放大">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
        </svg>
      </button>

      <div className="w-px h-4 bg-neutral-200 dark:bg-neutral-600 mx-0.5" />

      <button onClick={onFit} title="适应画布" className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        aria-label="适应画布">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>

      <button onClick={onReset} title="重置视图" className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        aria-label="重置视图">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  )
}
