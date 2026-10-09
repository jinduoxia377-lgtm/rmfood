export interface CommunityLegendProps {
  [key: string]: any;
  generatedCommunityColors: Record<number, string>
  communities: Map<string, number>
}

export default function CommunityLegend({ generatedCommunityColors, communities }: CommunityLegendProps) {
  if (communities.size === 0) return null
  return (
    <div className="absolute bottom-3 left-3 z-40 flex flex-wrap gap-1.5 p-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg border border-neutral-200/60 dark:border-neutral-700/40 shadow-md max-w-xs">
      <span className="text-[9px] font-semibold text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] w-full mb-0.5">社群着色 ({new Set(communities.values()).size}个)</span>
      {Object.entries(generatedCommunityColors).slice(0, 10).map(([id, color]) => {
        const count = [...communities.values()].filter(v => v === Number(id)).length
        return (
          <span key={id} className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-white dark:bg-neutral-800 shadow-sm">
            <span className="w-2 h-2 rounded-full ring-1 ring-white dark:ring-slate-900" style={{ backgroundColor: color }} />
            社群{Number(id)+1} ×{count}
          </span>
        )
      })}
      {Object.keys(generatedCommunityColors).length > 10 && (
        <span className="text-[9px] text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] italic">+{Object.keys(generatedCommunityColors).length - 10}...</span>
      )}
    </div>
  )
}
