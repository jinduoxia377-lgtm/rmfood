export interface ExportStatusBarProps {
  
  exportStatus?: string | null
}

export default function ExportStatusBar({ exportStatus }: ExportStatusBarProps) {
  if (!exportStatus) return null
  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-neutral-900/95 dark:bg-slate-950 backdrop-blur-md shadow-2xl animate-in fade-in zoom-in-95 duration-150">
      <span className="text-[11px] font-medium text-primary-400">{exportStatus}</span>
    </div>
  )
}
